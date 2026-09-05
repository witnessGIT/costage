import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowUpRight, Heart, Plus, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar } from '../components/ActivityCard';
import { Modal } from '../components/Modal';
import { WorkForm } from '../components/WorkForm';
export function Works() {
  const { data, requireAuth, mutate } = useStore();
  const [params, setParams] = useSearchParams();
  const [upload, setUpload] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const selected = data.works.find((w) => w.id === params.get('work'));
  const works = data.works.filter(
    (w) => filter === 'all' || (filter === 'liked' ? w.liked : w.userId === data.user?.id),
  );
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">A LITTLE LESS TALK. A LITTLE MORE ART.</div>
          <h1>
            让灵感，<span className="serif-em">有迹可循。</span>
          </h1>
          <p>这里收藏着每一次动手的勇气，也等待你的下一件作品。</p>
        </div>
        <div className="publish-actions">
          <Link to="/studio" className="button primary">
            开直播 <ArrowUpRight size={17} />
          </Link>
          <button
            className="button outlined"
            onClick={() => {
              if (requireAuth()) setUpload(true);
            }}
          >
            <Plus size={17} />
            发布作品
          </button>
        </div>
      </div>
      <div className="tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          发现作品
        </button>
        <button className={filter === 'liked' ? 'active' : ''} onClick={() => setFilter('liked')}>
          我的喜欢
        </button>
        <button className={filter === 'mine' ? 'active' : ''} onClick={() => setFilter('mine')}>
          我的作品
        </button>
      </div>
      <div className="works-grid">
        {works.map((w) => (
          <article key={w.id} className="work-card">
            <button className="work-image" onClick={() => setParams({ work: w.id })}>
              <img src={w.image} alt={w.title} />
              <span>
                展开作品
                <ArrowUpRight size={17} />
              </span>
            </button>
            <div className="work-title-row">
              <button onClick={() => setParams({ work: w.id })}>
                <h3>{w.title}</h3>
              </button>
              <button
                aria-label={'喜欢 ' + w.title}
                disabled={busy === w.id}
                className={`like-button ${w.liked ? 'liked' : ''}`}
                onClick={async () => {
                  setBusy(w.id);
                  await mutate('/works/' + w.id + '/like');
                  setBusy('');
                }}
              >
                <Heart size={17} fill={w.liked ? 'currentColor' : 'none'} />
                {w.likes}
              </button>
            </div>
            <div className="card-host">
              <Avatar name={w.author} small />
              {w.author}
              <span className="work-origin">{w.activityId ? '共创成果' : '独立创作'}</span>
            </div>
          </article>
        ))}
      </div>
      {!works.length && (
        <div className="empty-state">
          <Sparkles size={30} />
          <h3>{filter === 'liked' ? '遇见喜欢的作品，留一颗心' : '你的作品集，等你写下第一笔'}</h3>
          <p>每一件作品都值得被看见。</p>
        </div>
      )}
      <div className="manifesto">
        <span>✳</span>
        <p>
          美好的作品，
          <br />
          始于一句<span>「不如试试看」。</span>
        </p>
        <small>MAKE SOMETHING THAT MATTERS TO YOU.</small>
      </div>
      <Modal open={!!selected} onClose={() => setParams({})} title={selected?.title || '作品'} wide>
        {selected && (
          <div className="work-detail">
            <img src={selected.image} alt={selected.title} />
            <div className="card-host">
              <Avatar name={selected.author} />
              <strong>{selected.author}</strong>
              <span>{new Date(selected.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
            <p>{selected.description}</p>
            {selected.activityId && (
              <Link className="button outlined" to={'/live/' + selected.activityId}>
                来自：{selected.activityTitle}
                <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        )}
      </Modal>
      <WorkForm open={upload} onClose={() => setUpload(false)} />
    </div>
  );
}
