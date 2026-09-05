import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import type { User } from '../../../../packages/shared/src/index.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await scrypt(password, salt, 64)) as Buffer).toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  return timingSafeEqual((await scrypt(password, salt, 64)) as Buffer, Buffer.from(key, 'hex'));
}
export function getUser(token?: string): User | null {
  if (!token) return null;
  return (
    (db
      .prepare(
        'SELECT u.id,u.name,u.email,u.color FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',
      )
      .get(token, Date.now()) as unknown as User) || null
  );
}
export function cookieToken(header?: string) {
  return header
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('costage_session='))
    ?.slice(16);
}
export function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, userId, Date.now() + 30 * 86400000);
  res.cookie('costage_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 30 * 86400000,
    path: '/',
  });
}
export function currentUser(req: Request) {
  return getUser(req.cookies.costage_session);
}
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: '请先登录，再参与共创。' });
    return;
  }
  res.locals.user = user;
  next();
}
