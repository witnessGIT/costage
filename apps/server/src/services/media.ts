import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const mediaTransport = process.env.MEDIA_TRANSPORT === 'webrtc' ? 'webrtc' : 'hls';
interface Session {
  process: ChildProcessWithoutNullStreams;
  directory: string;
  stopped: boolean;
  bytes: number;
  windowStart: number;
}
const sessions = new Map<string, Session>();
const root = resolve(process.env.MEDIA_PATH || './data/live');
const codecs = new Map([
  ['video/webm;codecs=vp8,opus', 'matroska'],
  ['video/webm;codecs=vp9,opus', 'matroska'],
  ['video/webm', 'matroska'],
  ['video/mp4', 'mov'],
]);
export function startMedia(id: string, mime: string, fail: (message: string) => void) {
  if (!codecs.has(mime))
    throw new Error('浏览器不支持当前推流格式，请使用新版 Chrome、Edge 或 Safari。');
  if (sessions.has(id)) throw new Error('直播已经开始。');
  if (sessions.size >= Number(process.env.MAX_LIVE_STREAMS || 4))
    throw new Error('当前直播席位已满，请稍后开播。');
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, 'stream-'));
  const child = spawn(
    process.env.FFMPEG_PATH || 'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-nostdin',
      '-fflags',
      '+genpts+discardcorrupt',
      '-analyzeduration',
      '1000000',
      '-probesize',
      '1000000',
      '-protocol_whitelist',
      'pipe',
      '-f',
      codecs.get(mime)!,
      '-i',
      'pipe:0',
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-r',
      '25',
      '-g',
      '25',
      '-keyint_min',
      '25',
      '-sc_threshold',
      '0',
      '-b:v',
      '1400k',
      '-maxrate',
      '1800k',
      '-bufsize',
      '2800k',
      '-threads',
      '2',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-f',
      'hls',
      '-hls_time',
      '1',
      '-hls_list_size',
      '8',
      '-hls_flags',
      'delete_segments+independent_segments+temp_file',
      '-hls_segment_filename',
      join(directory, 'segment%06d.ts'),
      join(directory, 'index.m3u8'),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const session: Session = {
    process: child,
    directory,
    stopped: false,
    bytes: 0,
    windowStart: Date.now(),
  };
  sessions.set(id, session);
  let diagnostics = '';
  child.stderr.on('data', (b: Buffer) => {
    diagnostics = (diagnostics + b.toString()).slice(-1500);
  });
  child.stdout.resume();
  child.stdin.on('error', () => {
    if (!session.stopped) fail('直播上传已断开，请重新开播。');
  });
  child.on('error', () => {
    if (!session.stopped) fail('直播分发服务暂时不可用，请稍后重新开播。');
  });
  child.on('close', (code) => {
    if (sessions.get(id) === session) sessions.delete(id);
    if (!session.stopped) {
      console.error('Live encoder exited', { activityId: id, code, diagnostics });
      fail('直播编码中断，请重新开播。');
    }
    rmSync(directory, { recursive: true, force: true });
  });
  return session;
}
export function appendMedia(id: string, chunk: unknown) {
  const session = sessions.get(id);
  if (!session || session.stopped) throw new Error('直播上传尚未准备好。');
  if (!Buffer.isBuffer(chunk) || chunk.length < 1 || chunk.length > 1_048_576)
    throw new Error('直播数据包格式不正确。');
  if (Date.now() - session.windowStart > 10_000) {
    session.bytes = 0;
    session.windowStart = Date.now();
  }
  session.bytes += chunk.length;
  if (session.bytes > 10_000_000 || session.process.stdin.writableLength > 4_000_000)
    throw new Error('上传速度异常，请降低画质后重新开播。');
  session.process.stdin.write(chunk);
}
export function stopMedia(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  session.stopped = true;
  session.process.stdin.end();
  session.process.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (session.process.exitCode === null) session.process.kill('SIGKILL');
  }, 3000);
  killTimer.unref();
  session.process.once('close', () => clearTimeout(killTimer));
}
export function mediaFile(id: string, file: string) {
  const session = sessions.get(id);
  if (!session || !/^(index\.m3u8|segment\d+\.ts)$/.test(file)) return null;
  const path = join(session.directory, file);
  try {
    return statSync(path).isFile() ? path : null;
  } catch {
    return null;
  }
}
export function stopAllMedia() {
  for (const id of sessions.keys()) stopMedia(id);
}
