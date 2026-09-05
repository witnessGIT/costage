import { useEffect, useRef, useState } from 'react';
import { Radio, RotateCw } from 'lucide-react';

export function HlsPlayer({ activityId, muted }: { activityId: string; muted: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('正在接收直播画面…');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let dispose = () => {};
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setStatus('主播正在连接，请稍候…');
    setFailed(false);
    const url = '/api/activities/' + encodeURIComponent(activityId) + '/media/index.m3u8';
    async function load() {
      const Hls = (await import('hls.js')).default;
      // Wait for the encoder to publish its first complete segment. This also
      // handles viewers who enter between broadcast:start and the first keyframe.
      let available = false;
      for (let count = 0; active && count < 60; count++) {
        try {
          const response = await fetch(url, { cache: 'no-store', signal: abort.signal });
          if (response.ok) {
            available = true;
            break;
          }
        } catch {
          if (!active) return;
        }
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1000);
          abort.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
      if (!active) return;
      if (!available) throw new Error('暂未收到主播画面，请点击重新连接。');
      const element = video.current;
      if (!element) return;
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 6,
          maxBufferLength: 12,
          maxMaxBufferLength: 20,
          backBufferLength: 10,
        });
        let mediaRecoveries = 0;
        dispose = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!active || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries++ < 2)
            hls.recoverMediaError();
          else {
            setStatus('播放连接中断，请重新连接。');
            setFailed(true);
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void element.play().catch(() => {
            if (active) setStatus('点击画面播放直播');
          });
        });
        hls.loadSource(url);
        hls.attachMedia(element);
      } else if (element.canPlayType('application/vnd.apple.mpegurl')) {
        element.src = url;
        void element.play().catch(() => {
          if (active) setStatus('点击画面播放直播');
        });
      } else throw new Error('当前浏览器不支持直播播放，请使用新版 Safari、Chrome 或 Edge。');
    }
    void load().catch((error) => {
      if (active) {
        setStatus(error.message);
        setFailed(true);
      }
    });
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
      dispose();
      const element = video.current;
      if (element) {
        element.removeAttribute('src');
        element.load();
      }
    };
  }, [activityId, attempt]);
  return (
    <div className="hls-player">
      <video
        ref={video}
        autoPlay
        playsInline
        muted={muted}
        onPlaying={() => {
          setStatus('');
          setFailed(false);
        }}
        onError={() => {
          setStatus('画面暂时无法播放，请重新连接。');
          setFailed(true);
        }}
      />
      {status && (
        <div className="hls-status" role="status">
          <Radio size={28} />
          <p>{status}</p>
          {failed ? (
            <button className="button primary compact" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCw size={15} />
              重新连接
            </button>
          ) : (
            <button
              className="button outlined compact"
              onClick={() => void video.current?.play().catch(() => {})}
            >
              播放画面
            </button>
          )}
        </div>
      )}
    </div>
  );
}
