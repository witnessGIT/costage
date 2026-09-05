import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage, Poll } from '../../../../packages/shared/src';
import { api } from './api';
type LiveConfig = RTCConfiguration & { transport: 'hls' | 'webrtc' };
type Signal = {
  from: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
export function useLive(
  id: string,
  userId: string | undefined,
  onMessage: (m: ChatMessage) => void,
  onPoll: (p: Poll) => void,
  onRefresh: () => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const local = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const callbacks = useRef({ onMessage, onPoll, onRefresh });
  callbacks.current = { onMessage, onPoll, onRefresh };
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const config = useRef<LiveConfig>({ iceServers: [], transport: 'hls' });
  const ready = useRef<Promise<LiveConfig> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [transport, setTransport] = useState<'hls' | 'webrtc' | null>(null);
  function stopRecording() {
    const current = recorder.current;
    recorder.current = null;
    if (current && current.state !== 'inactive') current.stop();
  }
  const pending = useRef(new Map<string, RTCIceCandidateInit[]>());
  useEffect(() => {
    let active = true;
    ready.current = api<LiveConfig>('/rtc-config').then((v) => {
      if (active) {
        config.current = v;
        setTransport(v.transport);
      }
      return v;
    });
    void ready.current.catch(() => {
      if (active) setError('无法连接直播配置服务，请刷新后重试。');
    });
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const cleanupPeers = () => {
      peers.current.forEach((p) => p.close());
      peers.current.clear();
      pending.current.clear();
    };
    const stopLocal = () => {
      stopRecording();
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      setBroadcasting(false);
      setStream(null);
      cleanupPeers();
    };
    function peer(target: string) {
      const old = peers.current.get(target);
      if (old) return old;
      const p = new RTCPeerConnection(config.current);
      peers.current.set(target, p);
      p.onicecandidate = (e) => {
        if (e.candidate) socket.emit('rtc:signal', { target, candidate: e.candidate.toJSON() });
      };
      p.ontrack = (e) => {
        if (active) setStream(e.streams[0] || new MediaStream([e.track]));
      };
      p.onconnectionstatechange = () => {
        if (p.connectionState === 'failed' && active)
          setError('视频连接失败，请检查网络或中继配置后重试。');
      };
      return p;
    }
    socket.on('connect', async () => {
      setConnected(true);
      try {
        await ready.current;
        if (active && socket.connected) {
          setError('');
          socket.emit('room:join', id);
        }
      } catch {}
    });
    socket.on('disconnect', () => {
      setConnected(false);
      stopLocal();
    });
    socket.on('connect_error', () => {
      setConnected(false);
      setError('互动连接暂时中断，正在重试。');
    });
    socket.on('broadcast:error', (message: string) => {
      stopLocal();
      setError(message);
      callbacks.current.onRefresh();
    });
    socket.on('chat:message', (m: ChatMessage) => callbacks.current.onMessage(m));
    socket.on('poll:update', (p: Poll) => callbacks.current.onPoll(p));
    socket.on('catalog:update', () => callbacks.current.onRefresh());
    socket.on('broadcast:ended', () => {
      if (!local.current) {
        setStream(null);
        cleanupPeers();
      }
      callbacks.current.onRefresh();
    });
    socket.on('viewer:joined', async (target: string) => {
      try {
        if (!local.current) return;
        const p = peer(target);
        local.current.getTracks().forEach((track) => p.addTrack(track, local.current!));
        await p.setLocalDescription(await p.createOffer());
        socket.emit('rtc:signal', { target, description: p.localDescription });
      } catch {
        setError('有位观众暂时未连接成功。');
      }
    });
    socket.on('viewer:left', (target: string) => {
      peers.current.get(target)?.close();
      peers.current.delete(target);
      pending.current.delete(target);
    });
    socket.on('rtc:signal', async (signal: Signal) => {
      try {
        const p = peer(signal.from);
        if (signal.description) {
          await p.setRemoteDescription(signal.description);
          for (const candidate of pending.current.get(signal.from) || [])
            await p.addIceCandidate(candidate);
          pending.current.delete(signal.from);
          if (signal.description.type === 'offer') {
            await p.setLocalDescription(await p.createAnswer());
            socket.emit('rtc:signal', { target: signal.from, description: p.localDescription });
          }
        }
        if (signal.candidate) {
          if (p.remoteDescription) await p.addIceCandidate(signal.candidate);
          else
            pending.current.set(signal.from, [
              ...(pending.current.get(signal.from) || []),
              signal.candidate,
            ]);
        }
      } catch {
        setError('视频连接未能建立，请刷新后重试。');
      }
    });
    return () => {
      active = false;
      stopRecording();
      socket.disconnect();
      socketRef.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      cleanupPeers();
    };
  }, [id, userId]);
  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('摄像头需要安全连接：请使用 HTTPS 或 localhost 打开本页。');
      return;
    }
    if (!socketRef.current?.connected) {
      setError('互动服务尚未连接，请稍后再试。');
      return;
    }
    const initiatingSocket = socketRef.current;
    try {
      await ready.current;
      if (socketRef.current !== initiatingSocket || !initiatingSocket.connected) return;
      const mime =
        config.current.transport === 'hls' && typeof MediaRecorder !== 'undefined'
          ? [
              'video/webm;codecs=vp8,opus',
              'video/webm;codecs=vp9,opus',
              'video/webm',
              'video/mp4',
            ].find((value) => MediaRecorder.isTypeSupported(value))
          : undefined;
      if (config.current.transport === 'hls' && !mime) {
        setError('当前浏览器不支持摄像头推流，请使用新版 Chrome、Edge 或 Safari。');
        return;
      }

      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      // Permission dialogs may outlive the page. Never retain a camera stream
      // after its owning room has been left or its connection has changed.
      if (socketRef.current !== initiatingSocket || !initiatingSocket.connected) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      local.current = media;
      setStream(media);
      await new Promise<void>((resolve) => {
        initiatingSocket
          .timeout(10000)
          .emit('broadcast:start', { mime }, (err: Error | null, result: { error?: string }) => {
            if (socketRef.current !== initiatingSocket) {
              media.getTracks().forEach((track) => track.stop());
              resolve();
              return;
            }
            if (err || result?.error) {
              media.getTracks().forEach((t) => t.stop());
              local.current = null;
              setStream(null);
              setError(result?.error || '开播请求超时，请重试。');
            } else {
              if (config.current.transport === 'hls' && mime) {
                try {
                  const recording = new MediaRecorder(media, {
                    mimeType: mime,
                    videoBitsPerSecond: 1_600_000,
                    audioBitsPerSecond: 96_000,
                  });
                  recorder.current = recording;
                  let queue = Promise.resolve();
                  let queuedBytes = 0;
                  recording.ondataavailable = (event) => {
                    if (!event.data.size || recorder.current !== recording) return;
                    queuedBytes += event.data.size;
                    if (queuedBytes > 4_000_000) {
                      setError('网络上传速度不足，直播已暂停，请换个网络重新开播。');
                      stop();
                      return;
                    }
                    queue = queue
                      .then(async () => {
                        if (recorder.current !== recording) return;
                        const chunk = await event.data.arrayBuffer();
                        if (recorder.current !== recording) return;
                        await new Promise<void>((done, reject) =>
                          initiatingSocket
                            .timeout(10000)
                            .emit(
                              'media:chunk',
                              chunk,
                              (error: Error | null, result: { error?: string }) =>
                                error || result?.error
                                  ? reject(new Error(result?.error || '直播上传中断，请重新开播。'))
                                  : done(),
                            ),
                        );
                      })
                      .catch((error) => {
                        if (recorder.current === recording) {
                          setError(error.message);
                          stop();
                        }
                      })
                      .finally(() => {
                        queuedBytes -= event.data.size;
                      });
                  };
                  recording.onerror = () => {
                    setError('摄像头编码中断，请重新开播。');
                    stop();
                  };
                  recording.start(500);
                } catch {
                  setError('摄像头推流初始化失败，请换用新版浏览器后重试。');
                  stop();
                  resolve();
                  return;
                }
              }
              setBroadcasting(true);
            }
            resolve();
          });
      });
    } catch {
      setError('无法访问摄像头或麦克风。请检查设备和浏览器权限后重试。');
    }
  }
  function stop() {
    stopRecording();
    socketRef.current?.emit('broadcast:stop');
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    peers.current.forEach((p) => p.close());
    peers.current.clear();
    setStream(null);
    setBroadcasting(false);
  }
  async function send(text: string) {
    return new Promise<string | null>((resolve) => {
      if (!socketRef.current?.connected) {
        resolve('连接尚未就绪，请稍后重试。');
        return;
      }
      socketRef.current
        .timeout(7000)
        .emit('chat:send', text, (err: Error | null, result: { error?: string }) =>
          resolve(err ? '消息发送超时，请重试。' : result?.error || null),
        );
    });
  }
  return { stream, broadcasting, connected, error, start, stop, send, transport };
}
