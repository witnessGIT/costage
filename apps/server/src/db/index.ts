import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const filename = process.env.DATABASE_PATH || './data/costage.sqlite';
if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
export const db = new DatabaseSync(filename);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#e9e6dc');
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, host TEXT NOT NULL, owner_id TEXT NOT NULL, cover TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', starts_at TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 60, seats INTEGER NOT NULL DEFAULT 30, demo INTEGER NOT NULL DEFAULT 0, tag TEXT NOT NULL DEFAULT '一起创作', tasks TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reservations (activity_id TEXT NOT NULL REFERENCES activities(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(activity_id,user_id));
CREATE TABLE IF NOT EXISTS circles (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, cover TEXT NOT NULL, color TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (circle_id TEXT NOT NULL REFERENCES circles(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(circle_id,user_id));
CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL, user_id TEXT NOT NULL, author TEXT NOT NULL, activity_id TEXT REFERENCES activities(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS likes (work_id TEXT NOT NULL REFERENCES works(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(work_id,user_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), user_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS votes (activity_id TEXT NOT NULL REFERENCES activities(id), user_id TEXT NOT NULL REFERENCES users(id), choice INTEGER NOT NULL CHECK(choice BETWEEN 0 AND 2), PRIMARY KEY(activity_id,user_id));
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_activity ON messages(activity_id,created_at);
`);
// Seed only when empty. Never recreate or overwrite user content on restart.
if (!(db.prepare('SELECT count(*) AS n FROM activities').get() as { n: number }).n) {
  const insert = db.prepare('INSERT INTO activities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  const next = new Date(tomorrow);
  next.setDate(next.getDate() + 1);
  const rows = [
    [
      'poster-lab',
      '把夏天，做成一张海报',
      '从一张空白画布开始，聊聊颜色、字体和留白。一起完成一张属于夏末的音乐节海报，带走自己的创作。',
      '视觉设计',
      '阿澈 / A-CHE',
      'seed',
      '/images/poster.svg',
      'live',
      new Date().toISOString(),
      90,
      30,
      1,
      '共创工作坊',
      JSON.stringify([
        '寻找灵感，确定主题',
        '一起选择海报的配色',
        '排版与字体实验',
        '作品分享与现场反馈',
      ]),
    ],
    [
      'clay-time',
      '慢下来，捏一只不完美的杯子',
      '把手交给泥土，和陶艺师一起探索手捏陶的温度。准备好陶泥，也可以先来看看。',
      '手作生活',
      '小满的陶艺室',
      'seed',
      '/images/pottery.jpg',
      'live',
      new Date().toISOString(),
      60,
      20,
      1,
      '零基础友好',
      JSON.stringify(['认识泥土与工具', '捏出器物的形状', '给表面一点肌理', '分享今天的作品']),
    ],
    [
      'city-walk',
      '街头散步，收集城市的光',
      '带上相机或手机，从日常中发现被忽略的光影。聊聊构图，也聊聊我们生活的城市。',
      '摄影影像',
      '野生摄影师 Leo',
      'seed',
      '/images/camera.jpg',
      'live',
      new Date().toISOString(),
      75,
      40,
      1,
      '灵感漫游',
      JSON.stringify(['发现光与影', '构图练习', '调色与照片分享']),
    ],
    [
      'bedroom-music',
      '卧室音乐会：让旋律自由生长',
      '今晚把耳朵交给音乐，从一个和弦开始，写一段属于大家的旋律。',
      '音乐现场',
      '陈粒粒',
      'seed',
      '/images/music.jpg',
      'scheduled',
      tomorrow.toISOString(),
      60,
      50,
      1,
      '声音实验',
      JSON.stringify(['听一段即兴', '一起选择和弦', '完成一段旋律']),
    ],
    [
      'creative-desk',
      '周末灵感局：整理你的创作角落',
      '从桌上的一束花和一本书开始，让日常空间成为灵感的容器。',
      '灵感闲聊',
      'Nana 的日常',
      'seed',
      '/images/interior.jpg',
      'scheduled',
      next.toISOString(),
      60,
      30,
      1,
      '周末特别企划',
      JSON.stringify(['分享你的桌面', '整理灵感清单', '一起布置创作角落']),
    ],
    [
      'color-story',
      '一场关于颜色的自由实验',
      '用三种颜色，画出此刻的心情。没有标准答案，只有不断发生的灵感。',
      '视觉设计',
      '阿澈 / A-CHE',
      'seed',
      '/images/art.jpg',
      'ended',
      new Date(Date.now() - 86400000).toISOString(),
      90,
      30,
      1,
      '成果已发布',
      JSON.stringify(['颜色采集', '形状实验', '作品回顾']),
    ],
  ];
  for (const row of rows) insert.run(...row);
  const circle = db.prepare('INSERT INTO circles VALUES (?,?,?,?,?,?)');
  for (const row of [
    [
      'design',
      '不正经设计俱乐部',
      '分享新鲜灵感，认真做点不一样的设计。',
      '视觉设计',
      '/images/poster.svg',
      '#edc9ff',
    ],
    [
      'craft',
      '用手创造的日常',
      '在一针一线、一捏一揉里，找回生活的温度。',
      '手作生活',
      '/images/pottery.jpg',
      '#edddd1',
    ],
    [
      'photo',
      '城市光线收集所',
      '带着相机散步，收藏日常里的不期而遇。',
      '摄影影像',
      '/images/camera.jpg',
      '#dfe6d7',
    ],
    [
      'music',
      '卧室音乐人',
      '从第一段和弦开始，让好声音在这里相遇。',
      '音乐现场',
      '/images/music.jpg',
      '#d8ddf0',
    ],
  ])
    circle.run(...row);
  const work = db.prepare('INSERT INTO works VALUES (?,?,?,?,?,?,?,?)');
  for (const row of [
    [
      'summer',
      '夏末的一点橙',
      '把夏天的热烈留在这张海报上。',
      '/images/poster.svg',
      'seed',
      '林小夏',
      'poster-lab',
      new Date().toISOString(),
    ],
    [
      'ceramic',
      '我的第一只手捏杯',
      '有点歪，但刚好装得下一杯喜欢。',
      '/images/pottery.jpg',
      'seed',
      '慢慢来',
      'clay-time',
      new Date().toISOString(),
    ],
    [
      'light',
      '光经过的地方',
      '平常街角，也有属于它的黄金时刻。',
      '/images/camera.jpg',
      'seed',
      'Leonie',
      'city-walk',
      new Date().toISOString(),
    ],
  ])
    work.run(...row);
}
