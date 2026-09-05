export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试。', 0);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('服务暂时不可用，请稍后刷新页面重试。', response.status);
  }
  if (!response.ok) throw new ApiError(data.error || '请求失败，请稍后重试。', response.status);
  return data as T;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body || {}) });
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
