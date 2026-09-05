import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { api } from './routes/api.js';
import { realtime } from './services/realtime.js';
import { stopAllMedia } from './services/media.js';
const app = express();
// The application only listens on loopback; its local reverse proxies supply
// client addresses. Never trust arbitrary forwarded headers from the internet.
app.set('trust proxy', 'loopback');
const http = createServer(app);
const origins = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001'
).split(',');
const allowed = (origin?: string) => !origin || origins.includes(origin);
const io = new Server(http, {
  maxHttpBufferSize: 1_100_000,
  allowRequest: (req, cb) => cb(null, allowed(req.headers.origin)),
  cors: { origin: origins, credentials: true },
});
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        workerSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    skip: (req) =>
      req.method === 'GET' &&
      /^\/activities\/[^/]+\/media\/(index\.m3u8|segment\d+\.ts)$/.test(req.path),
    message: { error: '请求过于频繁，请稍后重试。' },
  }),
);
app.use('/api', (req, res, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (!allowed(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site')
  ) {
    res.status(403).json({ error: '不允许跨站请求。' });
    return;
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/api', api(io));
app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在。' }));
const web = resolve('apps/web/dist');
if (existsSync(web)) {
  app.use(express.static(web));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(web, 'index.html')));
}
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: '请检查填写内容：' + err.issues[0].message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: '请求格式不正确。' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: '服务暂时遇到问题，请稍后重试。' });
  },
);
realtime(io);
const port = Number(process.env.PORT || 3001);
http.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`CoStage running at http://${process.env.HOST || '127.0.0.1'}:${port}`),
);
function shutdown() {
  stopAllMedia();
  io.close();
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
