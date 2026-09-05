import { ArrowUpRight, CalendarPlus, Check, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { Activity } from '../../../../packages/shared/src';
import { useStore } from '../lib/store';
import { dateLabel } from '../lib/api';
export function Avatar({
  name,
  color,
  small = false,
}: {
  name: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${small ? 'small' : ''}`}
      style={{ background: color || ['#e1dfcf', '#e5d6f0', '#cedcce', '#f0d1bc'][name.length % 4] }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
export function ActivityCard({ activity: a }: { activity: Activity }) {
  const { mutate } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <article className="activity-card">
      <Link className="card-image" to={'/live/' + a.id}>
        <img src={a.cover} alt={a.title} loading="lazy" />
        <span className={`status-badge ${a.status}`}>
          <span />
          {a.status === 'live'
            ? a.demo
              ? '功能演示 · 非直播'
              : '正在直播'
            : a.status === 'scheduled'
              ? '即将开始'
              : '成果回顾'}
        </span>
        <span className="image-category">{a.category}</span>
        <span className="image-arrow">
          <ArrowUpRight size={22} />
        </span>
      </Link>
      <div className="card-tags">
        <span>{a.tag}</span>
        <span>
          <Clock3 size={12} />
          {a.duration} 分钟
        </span>
      </div>
      <Link className="card-title" to={'/live/' + a.id}>
        {a.title}
      </Link>
      <div className="card-host">
        <Avatar name={a.host} small />
        <span>{a.host}</span>
      </div>
      <div className="card-footer">
        <span>
          {a.status === 'scheduled' ? (
            <>
              <Clock3 size={14} />
              {dateLabel(a.startsAt)}
            </>
          ) : (
            <>
              <Users size={14} />
              {a.count} 人已加入 · {a.seats} 个参与席位
            </>
          )}
        </span>
        {a.status === 'scheduled' ? (
          <button
            className={`reserve-button ${a.reserved ? 'reserved' : ''}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await mutate(
                '/activities/' + a.id + '/reservation',
                {},
                a.reserved ? '已取消预约' : '预约成功，活动已加入你的日历',
              );
              setBusy(false);
            }}
          >
            {a.reserved ? <Check size={14} /> : <CalendarPlus size={14} />}
            <span>{a.reserved ? '已预约' : '预约'}</span>
          </button>
        ) : (
          <Link className="text-link" to={'/live/' + a.id}>
            {a.status === 'ended' ? '看成果' : '去现场'}
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
    </article>
  );
}
