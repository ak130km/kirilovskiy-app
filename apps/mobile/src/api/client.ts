import type { ApiErrorBody } from '@kirilovskiy/shared';
import { API_URL } from '@/lib/config';
import { useSession } from '@/store/session';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  body?: unknown;
  /** Токен гостевого заказа (X-Order-Token) */
  orderToken?: string;
  /** Не отправлять токен клиента */
  anonymous?: boolean;
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.anonymous ? null : useSession.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.orderToken ? { 'X-Order-Token': opts.orderToken } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Токен устарел или аккаунт удалён — продолжаем как гость
    if (res.status === 401 && token && path.startsWith('/me')) void useSession.getState().signOut();
    const err = data as ApiErrorBody | null;
    const message = Array.isArray(err?.message) ? err.message[0] : err?.message;
    throw new ApiError(res.status, message || 'Что-то пошло не так. Попробуйте ещё раз.');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Что-то пошло не так');
