import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Camera,
  ChevronRight,
  Flower2,
  Grid2X2,
  Lightbulb,
  Palette,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { categories } from '../../../../packages/shared/src';
import { ActivityCard, Avatar } from '../components/ActivityCard';
import { useStore } from '../lib/store';
import { dateLabel } from '../lib/api';
const icons = [Grid2X2, Palette, Flower2, Camera, AudioLines, Lightbulb];
export function Discover() {
  const { data, loading, error, refresh } = useStore();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '全部';
  const q = params.get('q') || '';
  const [sort, setSort] = useState('recommended');
  const [status, setStatus] = useState('all');
  let activities = data.activities.filter(
    (a) =>
      a.status !== 'ended' &&
      (category === '全部' || a.category === category) &&
      (!q ||
        (a.title + a.host + a.category + a.description).toLowerCase().includes(q.toLowerCase())) &&
      (status === 'all' || (status === 'demo' ? a.demo : !a.demo && a.status === status)),
  );
  if (sort === 'new')
    activities = [...activities].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  if (sort === 'popular') activities = [...activities].sort((a, b) => b.count - a.count);
  const upcoming = data.activities.find((a) => a.status === 'scheduled');
  return (
    <div className="page discover-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="green-dot" /> THE CREATIVE SIDE OF LIVE
          </div>
          <h1>
            今天，一起做点<span className="serif-em">有趣的。</span>
            <Sparkles className="title-spark" size={27} />
          </h1>
          <p>遇见同频的人，把一闪而过的灵感，变成真实发生的作品。</p>
        </div>
        <Link to="/calendar" className="intro-link">
          你的下一场灵感 <ArrowUpRight size={17} />
        </Link>
      </div>
      {!q && category === '全部' && (
        <div className="hero-grid">
          <Link to="/live/poster-lab" className="hero-feature">
            <img
              className="hero-photo"
              src="/images/studio.jpg"
              alt="桌面上的手作工具、纸张与彩色胶带"
            />
            <div className="hero-shade" />
            <div className="hero-top">
              <span className="hero-kicker">
                <span /> 编辑精选 · 功能演示
              </span>
              <span className="hero-issue">VOL. 026 — CREATIVE SESSION</span>
            </div>
            <div className="hero-copy">
              <span className="hero-overline">好想法，值得一起完成。</span>
              <h2>
                让灵感碰个面，
                <br />
                把热爱做成作品。
              </h2>
              <p>和阿澈一起，从零开始设计一张夏日海报。</p>
              <div className="hero-cta">
                <span>
                  体验共创功能 <ArrowUpRight size={20} />
                </span>
                <div className="hero-avatars">
                  <Avatar name="夏" small />
                  <Avatar name="阿" small />
                  <Avatar name="林" small />
                  <span>下一个创作者，就是你</span>
                </div>
              </div>
            </div>
            <span className="hero-caption">LESS SCROLLING. MORE CREATING.</span>
            <span className="hero-sticker">
              一起
              <br />
              搞点创作 <Sparkles size={18} />
            </span>
          </Link>
          <div className="weekly-feature">
            <div className="weekly-header">
              <span>本周灵感预告</span>
              <ArrowUpRight size={19} />
            </div>
            <div className="weekly-art">
              <span className="weekend-text">
                SLOW
                <br />
                <i>DOWN.</i>
              </span>
              <img src="/images/interior.jpg" alt="安静的创作角落与自然光" />
              <span className="weekly-star">✳</span>
              <span className="weekend-number">
                WEEKEND
                <br />
                CLUB / 01
              </span>
            </div>
            <div className="weekly-bottom">
              <span className="eyebrow">留一点时间，给喜欢的事</span>
              <h3>{upcoming?.title || '周末，留给灵感'}</h3>
              <p>
                {upcoming ? dateLabel(upcoming.startsAt) : '发现下一场共创'} ·{' '}
                {upcoming?.duration || 60} 分钟
              </p>
              <Link to={upcoming ? '/live/' + upcoming.id : '/calendar'}>
                查看活动，预约入场 <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      )}
      <div className="category-list" role="group" aria-label="活动分类">
        {categories.map((c, i) => {
          const Icon = icons[i];
          return (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('category', c);
                setParams(next);
              }}
            >
              <Icon size={17} />
              {c}
            </button>
          );
        })}
      </div>
      <section id="sessions">
        <div className="section-heading">
          <div>
            <h2>
              {q ? `「${q}」的搜索结果` : '发现下一场共创'}
              {!q && (
                <span className="live-label">
                  <i /> LIVE & UPCOMING
                </span>
              )}
            </h2>
            <p>
              {q ? '找到你的下一次灵感碰撞。' : '有人分享热爱，有人动手创造。选一场，一起加入。'}
            </p>
          </div>
          <div className="list-controls">
            <select
              aria-label="活动状态"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">所有现场</option>
              <option value="live">正在直播</option>
              <option value="demo">功能演示</option>
              <option value="scheduled">即将开始</option>
            </select>
            <select aria-label="活动排序" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">为你精选</option>
              <option value="new">最新活动</option>
              <option value="popular">最多预约</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="card-grid">
            {[0, 1, 2].map((i) => (
              <div className="skeleton-card" key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>现场暂时没有连接上</h3>
            <p>{error}</p>
            <button className="button dark" onClick={() => void refresh().catch(() => {})}>
              重新连接
            </button>
          </div>
        ) : activities.length ? (
          <div className="card-grid">
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <SearchPlaceholder />
            <h3>灵感还没在这里开场</h3>
            <p>换个关键词，或发起属于你的第一场共创。</p>
            <Link className="button dark" to="/studio">
              发起共创
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
      <section className="community-strip">
        <div className="strip-icon">
          <Users size={30} />
          <span>✳</span>
        </div>
        <div>
          <span className="eyebrow">FIND YOUR PEOPLE</span>
          <h2>热爱这件事，一群人更有意思。</h2>
          <p>设计、手作、摄影、音乐……总有一个圈子，接得住你的灵感。</p>
        </div>
        <Link to="/circles" className="button outlined">
          找到我的圈子
          <ArrowUpRight size={17} />
        </Link>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>
              灵感落地的样子 <span className="heading-note">MADE TOGETHER</span>
            </h2>
            <p>每一场相遇，都留下了一点不一样的东西。</p>
          </div>
          <Link className="text-link" to="/works">
            探索作品
            <ChevronRight size={17} />
          </Link>
        </div>
        <div className="mini-work-grid">
          {data.works.slice(0, 3).map((w) => (
            <Link key={w.id} to={'/works?work=' + w.id} className="mini-work">
              <img src={w.image} alt={w.title} loading="lazy" />
              <div>
                <h3>{w.title}</h3>
                <p>
                  {w.author} <span>· 共创成果</span>
                </p>
              </div>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      </section>
      <div className="demo-footnote">
        精选场次与作品为初始体验内容 · 预约、聊天与发布由真实用户产生
      </div>
    </div>
  );
}
function SearchPlaceholder() {
  return <Lightbulb size={30} />;
}
