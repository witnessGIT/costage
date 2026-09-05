import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { ImagePlus, ArrowUpRight } from 'lucide-react';
import { Modal } from './Modal';
import { useStore } from '../lib/store';
export function WorkForm({
  open,
  onClose,
  activityId,
}: {
  open: boolean;
  onClose: () => void;
  activityId?: string;
}) {
  const { mutate, data } = useStore();
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!image) {
      setError('请先选择一张作品图片。');
      return;
    }
    const element = e.currentTarget;
    const form = new FormData(element);
    setBusy(true);
    const ok = await mutate(
      '/works',
      {
        title: form.get('title'),
        description: form.get('description'),
        image,
        activityId: activityId || form.get('activityId') || undefined,
      },
      '作品发布成功，你的灵感已经落地。',
    );
    setBusy(false);
    if (ok) {
      setImage('');
      element.reset();
      onClose();
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="发布图文作品">
      <p className="muted">这里用于上传作品图片。想实时分享摄像头画面？</p>
      <Link to="/studio" className="button primary full publish-live-link" onClick={onClose}>
        去开直播 <ArrowUpRight size={18} />
      </Link>
      <form className="form-stack" onSubmit={submit}>
        <label className="upload-field">
          {image ? (
            <img src={image} alt="作品预览" />
          ) : (
            <>
              <ImagePlus size={30} />
              <span>选择一张作品图片</span>
              <small>JPG / PNG / WebP，最大 1 MB</small>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="选择作品图片"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setError('');
              if (!f) return;
              if (f.size > 1024 * 1024) {
                setError('图片需小于 1 MB，请压缩后再上传。');
                e.target.value = '';
                return;
              }
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
                setError('请选择 JPG、PNG 或 WebP 图片。');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setImage(String(reader.result));
              reader.readAsDataURL(f);
            }}
          />
        </label>
        <label>
          作品名称
          <input
            name="title"
            required
            minLength={2}
            maxLength={60}
            placeholder="给这份灵感起个名字"
          />
        </label>
        <label>
          创作故事
          <textarea
            name="description"
            required
            minLength={2}
            maxLength={1000}
            placeholder="灵感从哪里来？过程中发生了什么？"
            rows={3}
          />
        </label>
        {!activityId && (
          <label>
            关联共创活动
            <select name="activityId">
              <option value="">独立创作</option>
              {data.activities.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox-label">
          <input type="checkbox" required />
          我有权发布此作品，同意在共场公开展示。
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? '正在发布…' : '发布作品'}
          <ArrowUpRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
