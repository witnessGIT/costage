import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ActivityCard } from '../components/ActivityCard';
function key(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function Calendar() {
  const { data } = useStore();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState('');
  const [mine, setMine] = useState(false);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const dates = Array.from(
    { length: 42 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1),
  );
  const items = data.activities.filter((a) => a.status !== 'ended' && (!mine || a.reserved));
  const visible = items.filter((a) =>
    selected
      ? key(new Date(a.startsAt)) === selected
      : new Date(a.startsAt).getMonth() === month.getMonth() &&
        new Date(a.startsAt).getFullYear() === month.getFullYear(),
  );
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">SAVE A LITTLE TIME FOR WHAT YOU LOVE.</div>
          <h1>
            给热爱，<span className="serif-em">留个时间。</span>
          </h1>
          <p>下一场值得期待的相遇，先替自己预约好。</p>
        </div>
        <Link to="/studio" className="button outlined">
          发起活动
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="calendar-toolbar">
        <div>
          <button
            className="icon-button"
            aria-label="上个月"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
              setSelected('');
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <h2>
            {month.getFullYear()} 年 {month.getMonth() + 1} 月
          </h2>
          <button
            className="icon-button"
            aria-label="下个月"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
              setSelected('');
            }}
          >
            <ChevronRight size={20} />
          </button>
          <button
            className="button outlined compact"
            onClick={() => {
              setMonth(new Date());
              setSelected('');
            }}
          >
            今天
          </button>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          只看我的预约
        </label>
      </div>
      <div className="calendar-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div className="calendar-weekday" key={d}>
            周{d}
          </div>
        ))}
        {dates.map((d) => {
          const sessions = items.filter((a) => key(new Date(a.startsAt)) === key(d));
          return (
            <button
              key={key(d)}
              className={`calendar-day ${d.getMonth() !== month.getMonth() ? 'outside' : ''} ${key(d) === key(new Date()) ? 'today' : ''} ${key(d) === selected ? 'selected' : ''}`}
              onClick={() => setSelected(key(d) === selected ? '' : key(d))}
            >
              <span>{d.getDate()}</span>
              {sessions.slice(0, 2).map((a) => (
                <small key={a.id} className={a.reserved ? 'booked' : ''}>
                  {a.title}
                </small>
              ))}
              {sessions.length > 2 && <em>+{sessions.length - 2} 场活动</em>}
            </button>
          );
        })}
      </div>
      <section className="section-space">
        <div className="section-heading">
          <div>
            <h2>
              {selected ? '当天活动' : '本月共创日程'}{' '}
              <span className="count-label">{visible.length} 场</span>
            </h2>
            <p>预约成功的场次，也会出现在顶部活动通知中。</p>
          </div>
          {selected && (
            <button className="text-link" onClick={() => setSelected('')}>
              查看整月
            </button>
          )}
        </div>
        {visible.length ? (
          <div className="card-grid">
            {visible.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CalendarDays size={30} />
            <h3>这一天，还是一张空白画布</h3>
            <p>换个日期看看，或者发起你的共创活动。</p>
          </div>
        )}
      </section>
    </div>
  );
}
