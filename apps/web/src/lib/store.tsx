import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Bootstrap } from '../../../../packages/shared/src';
import { api, post } from './api';
type Store = {
  data: Bootstrap;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  toast: string;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  requireAuth: () => boolean;
  mutate: (path: string, body?: unknown, message?: string) => Promise<boolean>;
};
const Context = createContext<Store | null>(null);
const empty: Bootstrap = { user: null, activities: [], circles: [], works: [] };
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      setData(await api<Bootstrap>('/bootstrap'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    return () => clearTimeout(timer.current);
  }, [refresh]);
  const requireAuth = () => {
    if (!data.user) {
      setAuthOpen(true);
      return false;
    }
    return true;
  };
  const mutate = async (path: string, body?: unknown, message?: string) => {
    if (!requireAuth()) return false;
    try {
      await post(path, body);
      await refresh();
      if (message) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        notify,
        toast,
        authOpen,
        setAuthOpen,
        requireAuth,
        mutate,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const state = useContext(Context);
  if (!state) throw new Error('Provider missing');
  return state;
}
