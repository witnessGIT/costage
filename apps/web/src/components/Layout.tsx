import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Compass,
  Hash,
  Images,
  Menu,
  Plus,
  Radio,
  Search,
  Sparkles,
  Users,
  X,
  LogOut,
  Check,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar } from './ActivityCard';
import { AuthModal } from './AuthModal';
import { post, dateLabel } from '../lib/api';
const nav = [
  { to: '/', label: '发现现场', icon: Compass },
  { to: '/circles', label: '我的圈子', icon: Users },
  { to: '/works', label: '灵感作品', icon: Images },
  { to: '/calendar', label: '活动日历', icon: CalendarDays },
];
export function Layout() {
  const { data, toast, notify, setAuthOpen, refresh } = useStore();
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setMobile(false);
    setNotifications(false);
    setProfile(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const reserved = data.activities.filter((a) => a.reserved && a.status !== 'ended');
  return (
    <div className="app-shell">
      {mobile && (
        <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-symbol">
            <Hash strokeWidth={3} size={29} />
          </span>
          <span className="brand-name">
            共场<span>CoStage</span>
          </span>
        </Link>
        <div className="sidebar-caption">让灵感相遇，让创作发生。</div>
        <div className="nav-label">
          探索共场 <span>EXPLORE</span>
        </div>
        <nav>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === '/' && <span className="nav-dot" />}
              {to === '/calendar' && reserved.length > 0 && (
                <span className="nav-count">{reserved.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="nav-label">
          我的兴趣圈{' '}
          <Link to="/circles" aria-label="探索更多圈子">
            <Plus size={15} />
          </Link>
        </div>
        <div className="sidebar-circles">
          {data.circles.slice(0, 3).map((c, i) => (
            <Link to={'/circles?circle=' + c.id} key={c.id}>
              <span className={`circle-dot dot-${i}`}>
                <Hash size={14} />
              </span>
              <span>{c.title}</span>
              {c.joined && <span className="tiny-dot" />}
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="creator-promo">
            <Sparkles size={22} />
            <h3>让你的热爱，自带舞台</h3>
            <p>开一场直播，让好想法被看见。</p>
            <Link to="/studio">
              成为创作者 <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link to="/studio" className="workspace-link">
            <Radio size={17} />
            直播工作台
            <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-foot">
            <span>共场 © 2026</span>
            <span>保持好奇 ↗</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-title">
              一个让创作发生的地方<span className="topbar-star">✳</span>
            </span>
          </div>
          <form
            className="search-field"
            onSubmit={(e) => {
              e.preventDefault();
              navigate('/?q=' + encodeURIComponent(search));
            }}
          >
            <Search size={17} />
            <input
              placeholder="搜一搜，你的下一场灵感"
              aria-label="搜索活动"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="header-actions">
            <div className="popover-anchor">
              <button
                className={`icon-button notification-button ${notifications ? 'selected' : ''}`}
                aria-label="活动通知"
                onClick={() => {
                  setNotifications(!notifications);
                  setProfile(false);
                }}
              >
                <Bell size={19} />
                {reserved.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="header-popover">
                  <strong>我的活动提醒</strong>
                  {reserved.length ? (
                    reserved.map((a) => (
                      <Link key={a.id} to={'/live/' + a.id}>
                        <span>{a.title}</span>
                        <small>{dateLabel(a.startsAt)}</small>
                      </Link>
                    ))
                  ) : (
                    <p>还没有预约活动。发现一场喜欢的现场，让期待发生。</p>
                  )}
                </div>
              )}
            </div>
            <Link to="/studio" className="button dark compact header-live-button">
              <Plus size={16} />
              开直播
            </Link>
            <div className="popover-anchor">
              {data.user ? (
                <button
                  className="profile-button"
                  onClick={() => {
                    setProfile(!profile);
                    setNotifications(false);
                  }}
                  aria-label="账号菜单"
                >
                  <Avatar name={data.user.name} small />
                  <ChevronDown size={13} />
                </button>
              ) : (
                <button className="login-button" onClick={() => setAuthOpen(true)}>
                  登录 / 加入
                </button>
              )}
              {profile && data.user && (
                <div className="header-popover profile-popover">
                  <strong>{data.user.name}</strong>
                  <p>{data.user.email}</p>
                  <Link to="/studio">
                    我的创作空间
                    <ArrowUpRight size={14} />
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        await post('/auth/logout');
                        await refresh();
                        setProfile(false);
                        notify('已安全退出账号');
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    <LogOut size={15} />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>
            CoStage® <span className="muted">让每一份热爱，都有回响。</span>
          </span>
          <span>
            MADE FOR CURIOUS MINDS <Sparkles size={13} />
          </span>
        </footer>
      </div>
      <AuthModal />
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
