import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, CalendarPlus, Check, Images, Plus, Radio, Users, X } from 'lucide-react';
import { categories } from '../../../../packages/shared/src';
import { useStore } from '../lib/store';
import { post, dateLabel } from '../lib/api';
import { ActivityCard } from '../components/ActivityCard';
export function Studio() {
  const { data, requireAuth, refresh, notify, setAuthOpen } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tasks, setTasks] = useState([
    '认识彼此，寻找灵感',
    '动手创作，一起完成',
    '分享作品与交流反馈',
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('create');
  const [startMode, setStartMode] = useState('now');
  const own = data.activities.filter((a) => a.ownerId === data.user?.id);
  const date = new Date(Date.now() + 3600000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireAuth()) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const { id } = await post<{ id: string }>('/activities', {
        title: f.get('title'),
        description: f.get('description'),
        category: f.get('category'),
        startsAt:
          startMode === 'now'
            ? new Date().toISOString()
            : new Date(String(f.get('startsAt'))).toISOString(),
        duration: Number(f.get('duration')),
        seats: Number(f.get('seats')),
        tasks: tasks.filter((t) => t.trim()),
      });
      await refresh();
      notify('直播间已创建，点击开启摄像头即可开始直播。');
      navigate('/live/' + id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">YOUR IDEAS DESERVE A STAGE.</div>
          <h1>
            把热爱，<span className="serif-em">带上场。</span>
          </h1>
          <p>
            {data.user
              ? `${data.user.name}，欢迎来到你的直播工作台。`
              : '一个好想法，就是开始的全部理由。'}
          </p>
        </div>
        <span className="studio-badge">
          <Radio size={15} /> CREATOR STUDIO
        </span>
      </div>
      <div className="stats-grid">
        <div>
          <span>
            我发起的共创
            <Radio size={18} />
          </span>
          <strong>
            {own.length}
            <small>场</small>
          </strong>
        </div>
        <div>
          <span>
            收到的活动预约
            <Users size={18} />
          </span>
          <strong>
            {own.reduce((n, a) => n + a.count, 0)}
            <small>次</small>
          </strong>
        </div>
        <div>
          <span>
            我的作品
            <Images size={18} />
          </span>
          <strong>
            {data.works.filter((w) => w.userId === data.user?.id).length}
            <small>件</small>
          </strong>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
          <Plus size={16} />
          创建直播
        </button>
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
          我的活动 <span>{own.length}</span>
        </button>
      </div>
      {tab === 'mine' ? (
        own.length ? (
          <div className="card-grid">
            {own.map((a) => (
              <ActivityCard activity={a} key={a.id} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Radio size={32} />
            <h3>你的第一场共创，从这里开始</h3>
            <p>分享你的拿手好戏，让更多人一起参与。</p>
            <button className="button dark" onClick={() => setTab('create')}>
              创建活动
              <Plus size={17} />
            </button>
          </div>
        )
      ) : (
        <div className="studio-grid">
          <form className="studio-form form-stack" onSubmit={submit}>
            <div className="broadcast-guide">
              <Radio size={23} />
              <div>
                <strong>摄像头实时直播</strong>
                <p>填写直播信息 → 进入直播间 → 授权摄像头与麦克风 → 开始直播</p>
              </div>
            </div>
            <fieldset className="start-mode">
              <legend>开播方式</legend>
              <label>
                <input
                  type="radio"
                  name="startMode"
                  value="now"
                  checked={startMode === 'now'}
                  onChange={() => setStartMode('now')}
                />
                立即开播
              </label>
              <label>
                <input
                  type="radio"
                  name="startMode"
                  value="scheduled"
                  checked={startMode === 'scheduled'}
                  onChange={() => setStartMode('scheduled')}
                />
                预约开播
              </label>
            </fieldset>
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>今天，一起做什么？</h2>
                <p>具体的小目标，更容易让大家加入。</p>
              </div>
            </div>
            <label>
              活动名称
              <input
                name="title"
                placeholder="例如：一起做一张属于秋天的海报"
                required
                minLength={4}
                maxLength={60}
              />
            </label>
            <label>
              活动介绍
              <textarea
                name="description"
                placeholder="介绍你的创作主题、参与方式，以及结束时大家可以带走的成果。"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
              />
            </label>
            <div className="form-row">
              <label>
                兴趣分类
                <select name="category" defaultValue={params.get('category') || '视觉设计'}>
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                参与席位
                <input name="seats" type="number" min={2} max={100} defaultValue={20} required />
              </label>
            </div>
            <div className="form-row">
              {startMode === 'scheduled' && (
                <label>
                  开场时间
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={date.toISOString().slice(0, 16)}
                    required
                  />
                </label>
              )}
              <label>
                预计时长
                <select name="duration" defaultValue="60">
                  <option value="30">30 分钟</option>
                  <option value="60">60 分钟</option>
                  <option value="90">90 分钟</option>
                  <option value="120">120 分钟</option>
                </select>
              </label>
            </div>
            <div className="form-section-title">
              <span>02</span>
              <div>
                <h2>给灵感一点路线</h2>
                <p>任务卡让参与者知道，现在能做些什么。</p>
              </div>
            </div>
            {tasks.map((task, i) => (
              <div className="task-input" key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <input
                  aria-label={'任务 ' + (i + 1)}
                  value={task}
                  onChange={(e) => setTasks(tasks.map((t, j) => (j === i ? e.target.value : t)))}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button
                  type="button"
                  disabled={tasks.length === 1}
                  className="icon-button"
                  aria-label={'删除任务 ' + (i + 1)}
                  onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            {tasks.length < 6 && (
              <button type="button" className="text-link" onClick={() => setTasks([...tasks, ''])}>
                <Plus size={15} />
                添加一个环节
              </button>
            )}
            <label className="checkbox-label">
              <input type="checkbox" required />
              我会尊重参与者，分享有权传播的内容。
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? '正在创建直播间…'
                : startMode === 'now'
                  ? '创建直播间，进入开播页'
                  : '发布直播预告'}
              <ArrowUpRight size={19} />
            </button>
            {!data.user && (
              <p className="muted form-hint">
                填写后需要{' '}
                <button type="button" className="inline-link" onClick={() => setAuthOpen(true)}>
                  登录或注册
                </button>{' '}
                才能发布，已填写的内容会保留。
              </p>
            )}
          </form>
          <aside className="studio-advice">
            <span className="advice-star">✳</span>
            <div className="eyebrow">SMALL STARTS. BIG POSSIBILITIES.</div>
            <h2>
              不用万事俱备，
              <br />
              先让创作发生。
            </h2>
            <p>一场好的共创，不需要复杂的设备。一个清晰的主题，加上愿意分享的你，就足够开始。</p>
            <ul>
              <li>
                <Check size={16} />
                让目标具体一点
              </li>
              <li>
                <Check size={16} />
                给大家留出参与时间
              </li>
              <li>
                <Check size={16} />
                记录作品，预约下一次相遇
              </li>
            </ul>
            <div className="advice-note">
              <Radio size={19} />
              <div>
                <strong>浏览器就能开播</strong>
                <p>
                  发布后，在活动页开启摄像头。使用 HTTPS 或 localhost，并允许摄像头和麦克风权限。
                </p>
              </div>
            </div>
            <p className="muted">
              当前版本的活动免费参与。直播通过服务器分发，观众可跨网络观看，画面会有几秒延迟。
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
