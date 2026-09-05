import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowUpRight, Check, Hash, Plus, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { ActivityCard } from '../components/ActivityCard';
export function Circles() {
  const { data, mutate } = useStore();
  const [params, setParams] = useSearchParams();
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState('');
  const selected = data.circles.find((c) => c.id === params.get('circle'));
  const circles = data.circles.filter((c) => !onlyMine || c.joined);
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">GOOD PEOPLE. GREAT IDEAS.</div>
          <h1>
            找到你的<span className="serif-em">同频圈。</span>
          </h1>
          <p>把共同的喜欢，变成可以一起做的事情。</p>
        </div>
        <span className="page-number">02 / COMMUNITY</span>
      </div>
      <div className="community-banner">
        <div>
          <Hash size={32} />
          <h2>独自有灵感，一起有回响。</h2>
          <p>一个长期在线的创作角落，等你来坐坐。</p>
        </div>
        <div className="circle-orbits">
          <span>DESIGN</span>
          <span>CRAFT</span>
          <span>MUSIC</span>
          <span>YOU ✳</span>
        </div>
      </div>
      <div className="tabs">
        <button className={!onlyMine ? 'active' : ''} onClick={() => setOnlyMine(false)}>
          发现圈子
        </button>
        <button className={onlyMine ? 'active' : ''} onClick={() => setOnlyMine(true)}>
          已加入 <span>{data.circles.filter((c) => c.joined).length}</span>
        </button>
      </div>
      <div className="circle-grid">
        {circles.map((c) => (
          <article key={c.id} className={`circle-card ${selected?.id === c.id ? 'selected' : ''}`}>
            <button className="circle-image" onClick={() => setParams({ circle: c.id })}>
              <img src={c.cover} alt={c.title} />
              <span style={{ background: c.color }}>
                <Hash size={24} />
              </span>
            </button>
            <div className="circle-body">
              <span className="eyebrow">{c.category}</span>
              <button className="title-button" onClick={() => setParams({ circle: c.id })}>
                <h2>{c.title}</h2>
              </button>
              <p>{c.description}</p>
              <div className="circle-bottom">
                <span>
                  <Users size={15} />
                  {c.members} 位成员
                </span>
                <button
                  disabled={busy === c.id}
                  className={`button compact ${c.joined ? 'outlined' : 'dark'}`}
                  onClick={async () => {
                    setBusy(c.id);
                    await mutate(
                      '/circles/' + c.id + '/membership',
                      {},
                      c.joined ? '已退出圈子' : '加入成功，欢迎找到同频的人',
                    );
                    setBusy('');
                  }}
                >
                  {c.joined ? <Check size={15} /> : <Plus size={15} />}{' '}
                  {c.joined ? '已加入' : '加入圈子'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!circles.length && (
        <div className="empty-state">
          <Users size={32} />
          <h3>还没有加入圈子</h3>
          <p>从一个你喜欢的话题开始吧。</p>
          <button className="button dark" onClick={() => setOnlyMine(false)}>
            探索兴趣圈
          </button>
        </div>
      )}
      {selected && (
        <section className="section-space">
          <div className="section-heading">
            <div>
              <h2>{selected.title} · 圈内现场</h2>
              <p>和同好一起，让喜欢的事持续发生。</p>
            </div>
            <Link
              to={'/studio?category=' + encodeURIComponent(selected.category)}
              className="text-link"
            >
              发起一场
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="card-grid">
            {data.activities
              .filter((a) => a.category === selected.category)
              .map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
