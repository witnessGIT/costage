import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { useStore } from '../lib/store';
import { post } from '../lib/api';
export function AuthModal() {
  const { authOpen, setAuthOpen, refresh, notify } = useStore();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await post('/auth/' + (register ? 'register' : 'login'), {
        name: form.get('name') || undefined,
        email: form.get('email'),
        password: form.get('password'),
      });
      await refresh();
      setAuthOpen(false);
      notify(register ? '欢迎来到共场，让创作发生。' : '欢迎回来，今天一起做点什么？');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={authOpen}
      onClose={() => setAuthOpen(false)}
      title={register ? '你的灵感，在这里有回应' : '好久不见，欢迎回场'}
    >
      <div className="auth-mark">
        <Sparkles size={24} />
        <span>EVERY IDEA NEEDS A STAGE.</span>
      </div>
      <p className="muted">加入共场，遇见同好，留下属于你的作品。</p>
      <form onSubmit={submit} className="form-stack">
        {register && (
          <label>
            怎么称呼你
            <input
              name="name"
              placeholder="你的创作昵称"
              required
              maxLength={24}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          邮箱
          <input
            name="email"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          密码
          <input
            name="password"
            type="password"
            placeholder="至少 8 位字符"
            minLength={8}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? '正在处理…' : register ? '创建账号' : '登录共场'}
          <ArrowUpRight size={18} />
        </button>
      </form>
      <p className="auth-switch">
        {register ? '已经有账号了？' : '第一次来到共场？'}
        <button
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? '直接登录' : '创建一个账号'}
        </button>
      </p>
    </Modal>
  );
}
