import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Server } from 'socket.io';
import { db } from '../db/index.js';
import {
  createSession,
  currentUser,
  hashPassword,
  requireUser,
  verifyPassword,
} from '../services/auth.js';
import { activities, circles, works, poll, messages } from '../services/catalog.js';
import { mediaTransport, mediaFile } from '../services/media.js';
const nameSchema = z.string().trim().min(1, '请输入昵称').max(24, '昵称最多 24 个字符');
const authSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200, '邮箱地址过长')
    .pipe(z.email('请输入有效的邮箱地址，例如 name@example.com')),
  password: z.string().min(8, '密码至少需要 8 位').max(128, '密码最多 128 位'),
  name: nameSchema.optional(),
});
export function api(io: Server) {
  const router = Router();
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: { error: '尝试次数过多，请稍后再试。' },
  });
  router.get('/health', (_req, res) => res.json({ ok: true, service: 'costage' }));
  router.get('/bootstrap', (req, res) => {
    const user = currentUser(req);
    res.json({
      user,
      activities: activities(user?.id),
      circles: circles(user?.id),
      works: works(user?.id),
    });
  });
  router.post('/auth/register', authLimit, async (req, res) => {
    const data = authSchema.extend({ name: nameSchema }).parse(req.body);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(data.email)) {
      res.status(409).json({ error: '这个邮箱已经注册，请直接登录。' });
      return;
    }
    const id = randomUUID();
    const password = await hashPassword(data.password);
    const inserted = db
      .prepare(
        'INSERT INTO users(id,name,email,password) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING',
      )
      .run(id, data.name, data.email, password);
    if (!inserted.changes) {
      res.status(409).json({ error: '这个邮箱已经注册，请直接登录。' });
      return;
    }
    createSession(res, id);
    res.status(201).json({ ok: true });
  });
  router.post('/auth/login', authLimit, async (req, res) => {
    const data = authSchema.parse(req.body);
    const row = db.prepare('SELECT id,password FROM users WHERE email=?').get(data.email) as
      { id: string; password: string } | undefined;
    if (!row || !(await verifyPassword(data.password, row.password))) {
      res.status(401).json({ error: '邮箱或密码不正确。' });
      return;
    }
    createSession(res, row.id);
    res.json({ ok: true });
  });
  router.post('/auth/logout', (req, res) => {
    const token = req.cookies.costage_session;
    if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    res.clearCookie('costage_session', { path: '/' });
    res.json({ ok: true });
  });
  router.get('/activities/:id', (req, res) => {
    const user = currentUser(req);
    const activity = activities(user?.id).find((a) => a.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: '这个活动不存在或已移除。' });
      return;
    }
    res.json({ activity, poll: poll(activity.id, user?.id), messages: messages(activity.id) });
  });
  router.post('/activities', requireUser, (req, res) => {
    const data = z
      .object({
        title: z.string().trim().min(4).max(60),
        description: z.string().trim().min(10).max(1000),
        category: z.enum(['视觉设计', '手作生活', '摄影影像', '音乐现场', '灵感闲聊']),
        startsAt: z.iso.datetime(),
        duration: z.number().int().min(15).max(240),
        seats: z.number().int().min(2).max(100),
        tasks: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
      })
      .parse(req.body);
    if (new Date(data.startsAt).getTime() < Date.now() - 60000) {
      res.status(400).json({ error: '请选择现在或未来的开播时间。' });
      return;
    }
    const id = randomUUID();
    const cover: Record<string, string> = {
      视觉设计: 'poster.svg',
      手作生活: 'pottery.jpg',
      摄影影像: 'camera.jpg',
      音乐现场: 'music.jpg',
      灵感闲聊: 'interior.jpg',
    };
    db.prepare('INSERT INTO activities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id,
      data.title,
      data.description,
      data.category,
      res.locals.user.name,
      res.locals.user.id,
      '/images/' + cover[data.category],
      'scheduled',
      data.startsAt,
      data.duration,
      data.seats,
      0,
      '新鲜开场',
      JSON.stringify(data.tasks),
    );
    res.status(201).json({ id });
  });
  router.post('/activities/:id/reservation', requireUser, (req, res) => {
    const id = String(req.params.id);
    const row = db.prepare('SELECT seats,status FROM activities WHERE id=?').get(id) as
      { seats: number; status: string } | undefined;
    if (!row) {
      res.status(404).json({ error: '活动不存在' });
      return;
    }
    if (row.status === 'ended') {
      res.status(409).json({ error: '活动已结束，可以浏览作品成果。' });
      return;
    }
    const reserved = db
      .prepare('SELECT 1 FROM reservations WHERE activity_id=? AND user_id=?')
      .get(id, res.locals.user.id);
    if (reserved)
      db.prepare('DELETE FROM reservations WHERE activity_id=? AND user_id=?').run(
        id,
        res.locals.user.id,
      );
    else {
      const count = Number(
        (
          db.prepare('SELECT count(*) AS n FROM reservations WHERE activity_id=?').get(id) as {
            n: number;
          }
        ).n,
      );
      if (count >= row.seats) {
        res.status(409).json({ error: '这场活动已满，看看其他活动吧。' });
        return;
      }
      db.prepare('INSERT INTO reservations VALUES (?,?)').run(id, res.locals.user.id);
    }
    io.to(id).emit('catalog:update');
    res.json({ reserved: !reserved });
  });
  router.post('/activities/:id/vote', requireUser, (req, res) => {
    const { choice } = z.object({ choice: z.number().int().min(0).max(2) }).parse(req.body);
    const id = String(req.params.id);
    const activity = activities().find((a) => a.id === id);
    if (!activity) {
      res.status(404).json({ error: '活动不存在' });
      return;
    }
    if (activity.status !== 'live') {
      res.status(409).json({ error: '投票在直播进行时开放。' });
      return;
    }
    db.prepare(
      'INSERT INTO votes VALUES (?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET choice=excluded.choice',
    ).run(id, res.locals.user.id, choice);
    io.to(id).emit('poll:update', poll(id));
    res.json(poll(id, res.locals.user.id));
  });
  router.post('/activities/:id/report', requireUser, (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);
    if (!db.prepare('SELECT id FROM activities WHERE id=?').get(String(req.params.id))) {
      res.status(404).json({ error: '活动不存在' });
      return;
    }
    db.prepare('INSERT INTO reports VALUES (?,?,?,?,?)').run(
      randomUUID(),
      String(req.params.id),
      res.locals.user.id,
      reason,
      new Date().toISOString(),
    );
    res.status(201).json({ ok: true });
  });
  router.post('/circles/:id/membership', requireUser, (req, res) => {
    const id = String(req.params.id);
    if (!db.prepare('SELECT id FROM circles WHERE id=?').get(id)) {
      res.status(404).json({ error: '圈子不存在' });
      return;
    }
    const row = db
      .prepare('SELECT 1 FROM memberships WHERE circle_id=? AND user_id=?')
      .get(id, res.locals.user.id);
    if (row)
      db.prepare('DELETE FROM memberships WHERE circle_id=? AND user_id=?').run(
        id,
        res.locals.user.id,
      );
    else db.prepare('INSERT INTO memberships VALUES (?,?)').run(id, res.locals.user.id);
    res.json({ joined: !row });
  });
  router.post('/works', requireUser, (req, res) => {
    const data = z
      .object({
        title: z.string().trim().min(2).max(60),
        description: z.string().trim().min(2).max(1000),
        image: z
          .string()
          .max(1500000)
          .regex(
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
            '请上传 JPG、PNG 或 WebP 图片',
          ),
        activityId: z.string().optional(),
      })
      .parse(req.body);
    if (
      data.activityId &&
      !db.prepare('SELECT id FROM activities WHERE id=?').get(data.activityId)
    ) {
      res.status(404).json({ error: '活动不存在' });
      return;
    }
    const id = randomUUID();
    db.prepare('INSERT INTO works VALUES (?,?,?,?,?,?,?,?)').run(
      id,
      data.title,
      data.description,
      data.image,
      res.locals.user.id,
      res.locals.user.name,
      data.activityId || null,
      new Date().toISOString(),
    );
    res.status(201).json({ id });
  });
  router.post('/works/:id/like', requireUser, (req, res) => {
    const id = String(req.params.id);
    if (!db.prepare('SELECT id FROM works WHERE id=?').get(id)) {
      res.status(404).json({ error: '作品不存在' });
      return;
    }
    const row = db
      .prepare('SELECT 1 FROM likes WHERE work_id=? AND user_id=?')
      .get(id, res.locals.user.id);
    if (row)
      db.prepare('DELETE FROM likes WHERE work_id=? AND user_id=?').run(id, res.locals.user.id);
    else db.prepare('INSERT INTO likes VALUES (?,?)').run(id, res.locals.user.id);
    res.json({ liked: !row });
  });
  router.get('/activities/:id/media/:file', (req, res) => {
    const path = mediaFile(String(req.params.id), String(req.params.file));
    res.set('Cache-Control', 'no-store');
    if (!path) {
      res.status(404).json({ error: '直播画面正在准备中。' });
      return;
    }
    res.type(path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
    res.sendFile(path);
  });
  router.get('/rtc-config', (_req, res) => {
    let iceServers = [];
    try {
      iceServers = JSON.parse(process.env.ICE_SERVERS || '[]');
    } catch {
      /* local-only fallback */
    }
    res.json({ iceServers, transport: mediaTransport });
  });
  return router;
}
