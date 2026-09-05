import { db } from '../db/index.js';
import type { Activity, Circle, Work, Poll } from '../../../../packages/shared/src/index.js';
export function activities(userId = ''): Activity[] {
  return (
    db
      .prepare(
        `SELECT a.*, (SELECT count(*) FROM reservations r WHERE r.activity_id=a.id) AS count, EXISTS(SELECT 1 FROM reservations r WHERE r.activity_id=a.id AND r.user_id=?) AS reserved FROM activities a ORDER BY a.rowid`,
      )
      .all(userId) as Record<string, unknown>[]
  ).map((a) => ({
    id: String(a.id),
    title: String(a.title),
    description: String(a.description),
    category: String(a.category),
    host: String(a.host),
    ownerId: String(a.owner_id),
    cover: String(a.cover),
    status: a.status as Activity['status'],
    startsAt: String(a.starts_at),
    duration: Number(a.duration),
    seats: Number(a.seats),
    count: Number(a.count),
    reserved: !!a.reserved,
    demo: !!a.demo,
    tag: String(a.tag),
    tasks: JSON.parse(String(a.tasks)),
  }));
}
export function circles(userId = ''): Circle[] {
  return (
    db
      .prepare(
        `SELECT c.*, (SELECT count(*) FROM memberships m WHERE m.circle_id=c.id) AS members, EXISTS(SELECT 1 FROM memberships m WHERE m.circle_id=c.id AND m.user_id=?) AS joined FROM circles c`,
      )
      .all(userId) as unknown as Circle[]
  ).map((c) => ({ ...c, joined: !!c.joined }));
}
export function works(userId = ''): Work[] {
  return (
    db
      .prepare(
        `SELECT w.id,w.user_id AS userId,w.title,w.description,w.image,w.author,w.activity_id AS activityId,a.title AS activityTitle,w.created_at AS createdAt,(SELECT count(*) FROM likes l WHERE l.work_id=w.id) AS likes, EXISTS(SELECT 1 FROM likes l WHERE l.work_id=w.id AND l.user_id=?) AS liked FROM works w LEFT JOIN activities a ON a.id=w.activity_id ORDER BY w.created_at DESC`,
      )
      .all(userId) as unknown as Work[]
  ).map((w) => ({ ...w, liked: !!w.liked }));
}
export function poll(activityId: string, userId = ''): Poll {
  const options = ['明亮暖色 · 橙与奶油', '自然清新 · 绿与白', '自由碰撞 · 紫与黄'].map(
    (label, i) => ({
      label,
      votes: Number(
        (
          db
            .prepare('SELECT count(*) AS n FROM votes WHERE activity_id=? AND choice=?')
            .get(activityId, i) as { n: number }
        ).n,
      ),
    }),
  );
  const vote = db
    .prepare('SELECT choice FROM votes WHERE activity_id=? AND user_id=?')
    .get(activityId, userId) as { choice: number } | undefined;
  return { options, selected: vote?.choice ?? null };
}
export function messages(id: string) {
  return db
    .prepare(
      'SELECT m.id,m.user_id AS userId,u.name AS author,u.color,m.text,m.created_at AS createdAt FROM messages m JOIN users u ON u.id=m.user_id WHERE m.activity_id=? ORDER BY m.created_at DESC LIMIT 100',
    )
    .all(id)
    .reverse();
}
