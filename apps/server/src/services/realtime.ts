import type { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { cookieToken, getUser } from './auth.js';
import { z } from 'zod';
import { mediaTransport, startMedia, appendMedia, stopMedia } from './media.js';
export function realtime(io: Server) {
  const broadcasters = new Map<string, string>();
  // A previous process cannot still be broadcasting after a restart.
  db.prepare("UPDATE activities SET status='scheduled' WHERE demo=0 AND status='live'").run();
  io.on('connection', (socket) => {
    let room = '';
    let lastMessage = 0;
    const user = () => getUser(cookieToken(socket.request.headers.cookie));
    const stop = () => {
      if (room && broadcasters.get(room) === socket.id) {
        broadcasters.delete(room);
        stopMedia(room);
        db.prepare("UPDATE activities SET status='ended' WHERE id=?").run(room);
        io.to(room).emit('broadcast:ended');
        io.to(room).emit('catalog:update');
      }
    };
    socket.on('room:join', (id: unknown) => {
      if (typeof id !== 'string' || id.length > 80 || room === id) return;
      if (!db.prepare('SELECT id FROM activities WHERE id=?').get(id)) return;
      stop();
      if (room) socket.leave(room);
      room = id;
      socket.join(id);
      const broadcaster = broadcasters.get(id);
      if (mediaTransport === 'webrtc' && broadcaster && broadcaster !== socket.id)
        io.to(broadcaster).emit('viewer:joined', socket.id);
    });
    socket.on('chat:send', (input: unknown, ack?: (r: unknown) => void) => {
      const respond = (r: unknown) => {
        if (typeof ack === 'function') ack(r);
      };
      const u = user();
      if (!u) return respond({ error: '请先登录后发言。' });
      const parsed = z.string().trim().min(1).max(500).safeParse(input);
      if (!room || !parsed.success) return respond({ error: '消息需要 1–500 个字符。' });
      if (Date.now() - lastMessage < 800) return respond({ error: '发送太快了，稍等一下。' });
      lastMessage = Date.now();
      const message = {
        id: randomUUID(),
        userId: u.id,
        author: u.name,
        color: u.color,
        text: parsed.data,
        createdAt: new Date().toISOString(),
      };
      db.prepare('INSERT INTO messages VALUES (?,?,?,?,?)').run(
        message.id,
        room,
        u.id,
        message.text,
        message.createdAt,
      );
      io.to(room).emit('chat:message', message);
      respond({ ok: true });
    });
    socket.on('broadcast:start', (input: unknown, callback?: (r: unknown) => void) => {
      const ack = typeof input === 'function' ? (input as (r: unknown) => void) : callback;
      const respond = (r: unknown) => {
        if (typeof ack === 'function') ack(r);
      };
      const u = user();
      const row = db.prepare('SELECT owner_id,demo FROM activities WHERE id=?').get(room) as
        { owner_id: string; demo: number } | undefined;
      if (!u || !row || row.owner_id !== u.id || row.demo)
        return respond({ error: '只有活动创建者可以开播。' });
      if (broadcasters.has(room) && broadcasters.get(room) !== socket.id)
        return respond({ error: '活动已在另一个窗口开播。' });
      if (mediaTransport === 'hls') {
        const parsed = z.object({ mime: z.string().max(100) }).safeParse(input);
        if (!parsed.success) return respond({ error: '直播服务已更新，请刷新页面后重新开播。' });
        try {
          startMedia(room, parsed.data.mime, (message) => {
            socket.emit('broadcast:error', message);
            stop();
          });
        } catch (error) {
          return respond({ error: (error as Error).message });
        }
      }
      broadcasters.set(room, socket.id);
      db.prepare("UPDATE activities SET status='live' WHERE id=?").run(room);
      io.to(room).emit('catalog:update');
      respond({ ok: true });
      for (const viewer of io.sockets.adapter.rooms.get(room) || [])
        if (mediaTransport === 'webrtc' && viewer !== socket.id)
          socket.emit('viewer:joined', viewer);
    });
    socket.on('media:chunk', (chunk: unknown, ack?: (result: unknown) => void) => {
      const respond = (value: unknown) => {
        if (typeof ack === 'function') ack(value);
      };
      if (mediaTransport !== 'hls' || broadcasters.get(room) !== socket.id || !user())
        return respond({ error: '无权上传直播画面。' });
      try {
        appendMedia(room, chunk);
        respond({ ok: true });
      } catch (error) {
        const message = (error as Error).message;
        respond({ error: message });
        socket.emit('broadcast:error', message);
        stop();
      }
    });
    socket.on('rtc:signal', (input: unknown) => {
      const parsed = z
        .object({
          target: z.string().max(100),
          description: z
            .object({ type: z.enum(['offer', 'answer']), sdp: z.string().max(100000) })
            .optional(),
          candidate: z
            .object({
              candidate: z.string().max(10000),
              sdpMid: z.string().nullable().optional(),
              sdpMLineIndex: z.number().nullable().optional(),
              usernameFragment: z.string().nullable().optional(),
            })
            .optional(),
        })
        .safeParse(input);
      if (!parsed.success || !room) return;
      const data = parsed.data;
      const target = io.sockets.sockets.get(data.target);
      if (!target?.rooms.has(room)) return;
      const host = broadcasters.get(room);
      if (host !== socket.id && host !== data.target) return;
      if (data.description?.type === 'offer' && host !== socket.id) return;
      if (data.description?.type === 'answer' && host !== data.target) return;
      if (host === socket.id && !user()) {
        stop();
        return;
      }
      io.to(data.target).emit('rtc:signal', { ...data, from: socket.id });
    });
    socket.on('broadcast:stop', stop);
    socket.on('disconnect', () => {
      const host = broadcasters.get(room);
      if (host && host !== socket.id) io.to(host).emit('viewer:left', socket.id);
      stop();
    });
  });
}
