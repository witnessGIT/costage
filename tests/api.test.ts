import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { io, type Socket } from 'socket.io-client';
const temp = mkdtempSync(join(tmpdir(), 'costage-api-'));
const base = 'http://127.0.0.1:3102';
let server: ChildProcess;
let logs = '';
async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get('set-cookie')?.split(';')[0] || '',
  };
}
async function register(name: string) {
  const res = await request('/auth/register', 'POST', {
    name,
    email: name + '@example.com',
    password: 'test-password-123',
  });
  assert.equal(res.status, 201);
  return res.cookie;
}
function socket(cookie = '') {
  return io(base, { extraHeaders: { Cookie: cookie }, transports: ['websocket'], forceNew: true });
}
async function connected(s: Socket) {
  if (s.connected) return;
  await new Promise<void>((resolve, reject) => {
    s.once('connect', resolve);
    s.once('connect_error', reject);
  });
}
function ack(s: Socket, event: string, ...args: unknown[]) {
  return new Promise<any>((resolve, reject) => {
    s.timeout(4000).emit(event, ...args, (err: Error | null, r: unknown) =>
      err ? reject(err) : resolve(r),
    );
  });
}
before(async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3102', DATABASE_PATH: join(temp, 'test.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (b) => (logs += b));
  server.stderr?.on('data', (b) => (logs += b));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await request('/health')).status === 200) return;
    } catch {}
    await delay(100);
  }
  throw new Error(logs);
});
after(async () => {
  server?.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once('exit', () => resolve());
  });
  rmSync(temp, { recursive: true, force: true });
});
test('public catalog is seeded; protected writes reject unauthenticated requests', async () => {
  const r = await request('/bootstrap');
  assert.equal(r.status, 200);
  assert.equal(r.data.user, null);
  assert.equal(r.data.activities.length, 6);
  assert.equal((await request('/activities', 'POST', {})).status, 401);
  assert.equal((await request('/works/nope/like', 'POST')).status, 401);
});
test('registration, duplicate accounts, password verification and session logout', async () => {
  const cookie = await register('auth-tester');
  const boot = await request('/bootstrap', 'GET', undefined, cookie);
  assert.equal(boot.data.user.name, 'auth-tester');
  assert.equal(boot.data.user.password, undefined);
  assert.equal(
    (
      await request('/auth/register', 'POST', {
        name: 'duplicate',
        email: 'auth-tester@example.com',
        password: 'test-password-123',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/auth/login', 'POST', {
        email: 'auth-tester@example.com',
        password: 'wrong-password',
      })
    ).status,
    401,
  );
  const login = await request('/auth/login', 'POST', {
    email: 'auth-tester@example.com',
    password: 'test-password-123',
  });
  assert.equal(login.status, 200);
  await request('/auth/logout', 'POST', {}, login.cookie);
  assert.equal((await request('/bootstrap', 'GET', undefined, login.cookie)).data.user, null);
});
test('reservation capacity, cancellation, per-user isolation and single vote', async () => {
  const owner = await register('capacity-owner');
  const c1 = await register('capacity-one');
  const c2 = await register('capacity-two');
  const c3 = await register('capacity-three');
  const created = await request(
    '/activities',
    'POST',
    {
      title: '容量边界测试活动',
      description: '测试最后一个席位和取消后重新预约的行为。',
      category: '视觉设计',
      startsAt: new Date(Date.now() + 3600000).toISOString(),
      duration: 60,
      seats: 2,
      tasks: ['分享创作灵感'],
    },
    owner,
  );
  assert.equal(created.status, 201);
  const id = created.data.id;
  const results = await Promise.all(
    [c1, c2, c3].map((c) => request('/activities/' + id + '/reservation', 'POST', {}, c)),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 2);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const winner = [c1, c2, c3][results.findIndex((r) => r.status === 200)];
  const loser = [c1, c2, c3][results.findIndex((r) => r.status === 409)];
  assert.equal(
    (await request('/activities/' + id, 'GET', undefined, loser)).data.activity.reserved,
    false,
  );
  await request('/activities/' + id + '/reservation', 'POST', {}, winner);
  assert.equal(
    (await request('/activities/' + id + '/reservation', 'POST', {}, loser)).status,
    200,
  );
  await request('/activities/poster-lab/vote', 'POST', { choice: 0 }, c1);
  const changed = await request('/activities/poster-lab/vote', 'POST', { choice: 2 }, c1);
  assert.equal(
    changed.data.options.reduce((n: number, o: { votes: number }) => n + o.votes, 0),
    1,
  );
  assert.equal(changed.data.selected, 2);
  assert.equal(
    (await request('/activities/' + id + '/vote', 'POST', { choice: 0 }, c1)).status,
    409,
  );
});
test('memberships, image validation, work ownership and likes persist', async () => {
  const cookie = await register('artist');
  assert.equal((await request('/circles/design/membership', 'POST', {}, cookie)).data.joined, true);
  assert.equal(
    (await request('/bootstrap', 'GET', undefined, cookie)).data.circles.find(
      (c: { id: string }) => c.id === 'design',
    ).joined,
    true,
  );
  assert.equal(
    (
      await request(
        '/works',
        'POST',
        { title: 'Bad SVG', description: 'should reject', image: 'data:image/svg+xml;base64,abcd' },
        cookie,
      )
    ).status,
    400,
  );
  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const work = await request(
    '/works',
    'POST',
    { title: '一份新作品', description: '记录共同创作的过程', image, activityId: 'poster-lab' },
    cookie,
  );
  assert.equal(work.status, 201);
  await request('/works/' + work.data.id + '/like', 'POST', {}, cookie);
  const boot = await request('/bootstrap', 'GET', undefined, cookie);
  const found = boot.data.works.find((w: { id: string }) => w.id === work.data.id);
  assert.equal(found.likes, 1);
  assert.equal(found.liked, true);
  assert.equal(found.userId, boot.data.user.id);
});
test('same-origin protection and non-existent resources', async () => {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 403);
  assert.equal((await request('/activities/missing')).status, 404);
});
test('chat is realtime, stored and authenticated; non-owner cannot broadcast', async () => {
  const cookie = await register('chat-user');
  const a = socket(cookie),
    b = socket();
  try {
    await Promise.all([connected(a), connected(b)]);
    a.emit('room:join', 'poster-lab');
    b.emit('room:join', 'poster-lab');
    await delay(80);
    assert.equal((await ack(b, 'chat:send', 'anonymous')).error, '请先登录后发言。');
    const incoming = new Promise<any>((resolve) => b.once('chat:message', resolve));
    assert.equal((await ack(a, 'chat:send', '这是一条实时同步的消息')).ok, true);
    const message = await incoming;
    assert.equal(message.text, '这是一条实时同步的消息');
    const room = await request('/activities/poster-lab');
    assert.ok(room.data.messages.some((m: { id: string }) => m.id === message.id));
    assert.ok((await ack(a, 'broadcast:start')).error);
    assert.ok((await ack(a, 'chat:send', 'too fast')).error);
  } finally {
    a.disconnect();
    b.disconnect();
  }
});

test('registration normalizes copied emails and reports invalid input in Chinese', async () => {
  const registered = await request('/auth/register', 'POST', {
    name: ' 邮箱测试 ',
    email: '  Copied-Email@Example.com  ',
    password: 'test-password-123',
  });
  assert.equal(registered.status, 201);
  const login = await request('/auth/login', 'POST', {
    email: ' copied-email@example.com ',
    password: 'test-password-123',
  });
  assert.equal(login.status, 200);
  const duplicate = await request('/auth/register', 'POST', {
    name: '重复账号',
    email: 'COPIED-EMAIL@EXAMPLE.COM',
    password: 'test-password-123',
  });
  assert.equal(duplicate.status, 409);
  const invalid = await request('/auth/register', 'POST', {
    name: '测试',
    email: 'not-an-email',
    password: 'test-password-123',
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /请输入有效的邮箱地址/);
});
