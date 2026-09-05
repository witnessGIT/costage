import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Flag,
  Maximize,
  MessageCircle,
  Mic,
  Radio,
  Send,
  Share2,
  Sparkles,
  Square,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Activity, ChatMessage, Poll } from '../../../../packages/shared/src';
import { useStore } from '../lib/store';
import { api, dateLabel, post } from '../lib/api';
import { useLive } from '../lib/useLive';
import { Avatar } from '../components/ActivityCard';
import { WorkForm } from '../components/WorkForm';
import { Modal } from '../components/Modal';
import { HlsPlayer } from '../components/HlsPlayer';
export function Live() {
  const { id = '' } = useParams();
  return <LiveRoom key={id} id={id} />;
}
function LiveRoom({ id }: { id: string }) {
  const { data, refresh, notify, requireAuth, mutate } = useStore();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [poll, setPoll] = useState<Poll>({ options: [], selected: null });
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('tasks');
  const [upload, setUpload] = useState(false);
  const [report, setReport] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [slide, setSlide] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const result = await api<{ activity: Activity; poll: Poll; messages: ChatMessage[] }>(
        '/activities/' + id,
      );
      setActivity(result.activity);
      setPoll(result.poll);
      setMessages((old) =>
        Array.from(new Map([...result.messages, ...old].map((m) => [m.id, m])).values())
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-100),
      );
      setLoadError('');
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load, data.user?.id]);
  const live = useLive(
    id,
    data.user?.id,
    (m) => setMessages((old) => [...old, m].slice(-100)),
    (p) => setPoll((old) => ({ ...p, selected: old.selected })),
    () => {
      void load();
      void refresh().catch(() => {});
    },
  );
  useEffect(() => {
    if (video.current) video.current.srcObject = live.stream;
  }, [live.stream]);
  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  if (loadError)
    return (
      <div className="page empty-state">
        <CircleHelp size={32} />
        <h2>暂时无法进入现场</h2>
        <p>{loadError}</p>
        <button className="button outlined" onClick={() => void load()}>
          重新尝试
        </button>
        <Link to="/" className="text-link">
          返回发现页
        </Link>
      </div>
    );
  if (!activity)
    return (
      <div className="page">
        <div className="skeleton-card large" />
      </div>
    );
  const a = activity;
  const owner = a.ownerId === data.user?.id;
  const total = poll.options.reduce((n, o) => n + o.votes, 0);
  const works = data.works.filter((w) => w.activityId === id);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!requireAuth() || !message.trim() || sending) return;
    setSending(true);
    const error = await live.send(message.trim());
    if (error) notify(error);
    else setMessage('');
    setSending(false);
  }
  return (
    <div className="page live-page">
      <div className="room-breadcrumb">
        <Link to="/">
          <ArrowLeft size={15} />
          返回发现
        </Link>
        <ChevronRight size={14} />
        <span>{a.category}</span>
        <span className="room-demo">{a.demo ? '体验内容 · 非真实主播在线' : '共创现场'}</span>
      </div>
      <div className="room-heading">
        <div>
          <div className="eyebrow">{a.tag} / COSTAGE LIVE</div>
          <h1>{a.title}</h1>
        </div>
        <button
          className="button outlined compact"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              notify('活动链接已复制，分享给同频的朋友吧。');
            } catch {
              notify('请复制浏览器地址栏中的活动链接。');
            }
          }}
        >
          <Share2 size={15} />
          分享现场
        </button>
      </div>
      <div className="room-grid">
        <div className="room-main">
          <div className="live-screen" ref={screen}>
            {!owner && !a.demo && a.status === 'live' && live.transport === 'hls' ? (
              <HlsPlayer activityId={id} muted={muted} />
            ) : live.stream ? (
              <video ref={video} autoPlay playsInline muted={owner || muted} />
            ) : (
              <>
                <img
                  src={a.demo && slide === 1 ? '/images/art.jpg' : a.cover}
                  alt={a.demo ? '示例创作画面' : a.title}
                />
                <div className="screen-overlay" />
                {!a.demo && (
                  <div className="screen-wait">
                    <Radio size={38} />
                    <h2>{a.status === 'ended' ? '这场共创已结束' : '好现场，值得等待'}</h2>
                    <p>
                      {owner
                        ? '准备好设备，就可以和大家见面了。'
                        : a.status === 'live'
                          ? '正在连接主播画面…'
                          : dateLabel(a.startsAt) + ' 开始'}
                    </p>
                    {owner && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          await live.start();
                          setBusy(false);
                        }}
                      >
                        {busy ? '正在连接设备…' : '开启摄像头，开始直播'}
                        <ArrowUpRight size={17} />
                      </button>
                    )}
                  </div>
                )}
                {a.demo && (
                  <div className="demo-screen-caption">
                    <span>CREATIVE SESSION / {String(slide + 1).padStart(2, '0')}</span>
                    <h2>{slide === 0 ? '把灵感，放上画布。' : '让颜色，自由生长。'}</h2>
                    <p>示例创作画面 · 可体验右侧聊天与下方共创投票</p>
                  </div>
                )}
              </>
            )}
            <div className="screen-top">
              <span className="status-badge live">
                <span />
                {live.broadcasting
                  ? '直播中'
                  : a.demo
                    ? '示例画面'
                    : a.status === 'live'
                      ? '实时连接'
                      : '共创现场'}
              </span>
              <span className="screen-quality">
                {live.transport === 'hls' && a.status === 'live' && !a.demo
                  ? 'HTTPS · 实时直播'
                  : live.stream
                    ? 'WebRTC · 实时画面'
                    : 'COSTAGE ORIGINAL'}
              </span>
            </div>
            <div className="screen-controls">
              <div>
                {a.demo ? (
                  <button onClick={() => setSlide(slide === 0 ? 1 : 0)}>
                    切换示例画面 <ChevronRight size={16} />
                  </button>
                ) : (
                  <span>
                    <Radio size={16} />
                    {live.broadcasting
                      ? '正在分享摄像头'
                      : a.status === 'live'
                        ? '正在观看直播'
                        : '等待现场信号'}
                  </span>
                )}
                {owner && live.broadcasting && (
                  <button onClick={() => live.stop()}>
                    <Square size={14} />
                    结束直播
                  </button>
                )}
              </div>
              <div>
                {!owner &&
                  (live.stream || (!a.demo && a.status === 'live' && live.transport === 'hls')) && (
                    <button
                      aria-label={muted ? '开启声音' : '静音'}
                      onClick={() => setMuted(!muted)}
                    >
                      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                  )}
                <button
                  aria-label="全屏观看"
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else
                      void screen.current
                        ?.requestFullscreen()
                        .catch(() => notify('当前浏览器不支持全屏。'));
                  }}
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
          </div>
          {live.error && (
            <p className="form-error" role="alert">
              {live.error}
            </p>
          )}
          <div className="host-bar">
            <Avatar name={a.host} />
            <div>
              <strong>{a.host}</strong>
              <p>
                {a.category}创作者 <span>· {a.duration} 分钟</span>
              </p>
            </div>
            <div className="host-bar-actions">
              <span>
                <Users size={15} />
                {a.count} / {a.seats} 席
              </span>
              {a.status !== 'ended' && (
                <button
                  disabled={busy}
                  className={`button compact ${a.reserved ? 'outlined' : 'primary'}`}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await mutate(
                      '/activities/' + id + '/reservation',
                      {},
                      a.reserved ? '已取消参与' : '已加入活动，期待你的作品！',
                    );
                    if (ok) await load();
                    setBusy(false);
                  }}
                >
                  {a.reserved ? <Check size={15} /> : <ArrowUpRight size={15} />}{' '}
                  {a.reserved ? '已加入 · 取消' : '加入这场共创'}
                </button>
              )}
            </div>
          </div>
          <div className="room-tabs tabs">
            <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
              今日共创
            </button>
            <button className={tab === 'works' ? 'active' : ''} onClick={() => setTab('works')}>
              作品墙 <span>{works.length}</span>
            </button>
            <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
              活动介绍
            </button>
          </div>
          {tab === 'tasks' && (
            <div className="task-panel">
              <div className="section-heading">
                <div>
                  <h2>把一个想法，一起完成。</h2>
                  <p>按照任务卡动手，也可以从你感兴趣的环节开始。</p>
                </div>
                <span className="small-pill">{a.tasks.length} 个环节</span>
              </div>
              <div className="task-list">
                {a.tasks.map((t, i) => (
                  <div key={t}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{t}</p>
                    <span className="task-line" />
                  </div>
                ))}
              </div>
              <div className="poll-card">
                <div>
                  <span className="eyebrow">YOUR VOICE MATTERS</span>
                  <h3>给今天的灵感，选一组颜色</h3>
                  <p>一人一票，可以更改选择 · {total} 人已参与</p>
                </div>
                <div className="poll-options">
                  {poll.options.map((o, i) => (
                    <button
                      disabled={busy || a.status !== 'live'}
                      key={o.label}
                      className={poll.selected === i ? 'selected' : ''}
                      onClick={async () => {
                        if (!requireAuth()) return;
                        setBusy(true);
                        try {
                          setPoll(await post<Poll>('/activities/' + id + '/vote', { choice: i }));
                        } catch (e) {
                          notify((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <span
                        className="poll-fill"
                        style={{ width: (total ? (o.votes / total) * 100 : 0) + '%' }}
                      />
                      <span>
                        {poll.selected === i ? (
                          <Check size={15} />
                        ) : (
                          <i className={'swatch swatch-' + i} />
                        )}{' '}
                        {o.label}
                      </span>
                      <strong>{total ? Math.round((o.votes / total) * 100) : 0}%</strong>
                    </button>
                  ))}
                </div>
                {a.status !== 'live' && <small>投票在直播进行时开放。</small>}
              </div>
              <div className="submit-strip">
                <div>
                  <Sparkles size={23} />
                  <span>
                    <strong>让大家看看你的创作</strong>
                    <small>不必完美，动手本身就很棒。</small>
                  </span>
                </div>
                <button
                  className="button dark compact"
                  onClick={() => {
                    if (requireAuth()) setUpload(true);
                  }}
                >
                  提交作品
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          )}
          {tab === 'works' && (
            <div className="room-works">
              {works.length ? (
                <div className="mini-work-grid">
                  {works.map((w) => (
                    <Link className="mini-work" key={w.id} to={'/works?work=' + w.id}>
                      <img src={w.image} alt={w.title} />
                      <div>
                        <h3>{w.title}</h3>
                        <p>{w.author}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <ImagesIcon />
                  <h3>第一件作品，或许就是你的</h3>
                  <p>记录你的过程，让灵感继续传递。</p>
                </div>
              )}
              <button
                className="button primary"
                onClick={() => {
                  if (requireAuth()) setUpload(true);
                }}
              >
                发布我的作品
                <ArrowUpRight size={16} />
              </button>
            </div>
          )}
          {tab === 'about' && (
            <div className="about-panel">
              <h2>关于这场共创</h2>
              <p>{a.description}</p>
              <div>
                <span>开场时间：{dateLabel(a.startsAt)}</span>
                <span>活动时长：{a.duration} 分钟</span>
                <span>参与费用：免费</span>
              </div>
              {a.demo && (
                <p className="muted">
                  这是用于体验平台功能的预置活动。封面、主持人和创作任务为示例；实际预约、聊天和作品来自使用者。
                </p>
              )}
            </div>
          )}
        </div>
        <aside className="chat-panel">
          <div className="chat-heading">
            <h3>
              现场聊聊
              <span className={live.connected ? 'connected-dot' : 'offline-dot'} />
            </h3>
            <span>{live.connected ? '已连接' : '连接中'}</span>
          </div>
          <div className="chat-welcome">
            <Sparkles size={18} />
            <p>欢迎来到共场！分享灵感、提出问题，让每个想法都被温柔接住。</p>
          </div>
          <div className="chat-messages" ref={chat}>
            {messages.length ? (
              messages.map((m) => (
                <div className="chat-message" key={m.id}>
                  <Avatar name={m.author} color={m.color} small />
                  <div>
                    <span>
                      {m.author}
                      <small>
                        {new Date(m.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </span>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="chat-empty">
                <MessageCircle size={26} />
                <p>聊聊你的第一个灵感吧。</p>
                <small>消息会实时同步给现场的朋友</small>
              </div>
            )}
          </div>
          <form onSubmit={send} className="chat-form">
            <textarea
              aria-label="聊天消息"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={data.user ? '说点什么，让灵感碰撞一下…' : '登录后，加入现场聊天'}
              maxLength={500}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(e);
                }
              }}
            />
            <div>
              <span>{message.length}/500</span>
              <button
                aria-label="发送消息"
                className="button dark compact"
                disabled={sending || !live.connected || !message.trim()}
              >
                {sending ? '发送中' : '发送'}
                <Send size={14} />
              </button>
            </div>
          </form>
          <button
            className="report-link"
            onClick={() => {
              if (requireAuth()) setReport(true);
            }}
          >
            <Flag size={12} />
            举报不当内容
          </button>
        </aside>
      </div>
      <WorkForm open={upload} onClose={() => setUpload(false)} activityId={id} />
      <Modal open={report} onClose={() => setReport(false)} title="反馈不当内容">
        <p className="muted">请说明具体情况。反馈会保存到平台的待处理记录中。</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setReportBusy(true);
            const form = new FormData(e.currentTarget);
            const ok = await mutate(
              '/activities/' + id + '/report',
              { reason: form.get('reason') },
              '反馈已记录，感谢你维护共创环境。',
            );
            setReportBusy(false);
            if (ok) setReport(false);
          }}
        >
          <label>
            反馈说明
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={500}
              rows={4}
              placeholder="请描述不当内容、出现时间或相关消息"
            />
          </label>
          <button className="button dark" disabled={reportBusy}>
            {reportBusy ? '提交中…' : '提交反馈'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
function ImagesIcon() {
  return <Sparkles size={32} />;
}
