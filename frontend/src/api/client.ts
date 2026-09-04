/**
 * Lớp gọi API .NET. Front-end và back-end nằm ở hai domain khác nhau nên mọi request
 * đều gửi kèm cookie (`credentials: 'include'`) và địa chỉ API lấy từ biến môi trường.
 */

import type { HistoryEntry, MediaItem, SiteConfig } from '../types';

export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:5080').replace(/\/$/, '');

/** Đổi đường dẫn ảnh tương đối (/media/…) thành URL đầy đủ trên domain của API. */
export function assetUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  return API_BASE + (src.startsWith('/') ? src : '/' + src);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(`Không kết nối được tới API (${API_BASE}). Back-end đã chạy chưa?`, 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error
      ?? `${init.method ?? 'GET'} ${path} → ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const jsonBody = (body: unknown): RequestInit => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  me: () => request<{ authenticated: boolean; usingDefaultPassword: boolean }>('/api/auth/me'),
  login: (password: string) =>
    request<{ ok: boolean; usingDefaultPassword: boolean }>('/api/auth/login', { method: 'POST', ...jsonBody({ password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getSite: () => request<SiteConfig>('/api/site'),
  saveSite: (config: SiteConfig) => request<SiteConfig>('/api/site', { method: 'PUT', ...jsonBody(config) }),
  history: () => request<HistoryEntry[]>('/api/site/history'),
  restore: (file: string) => request<SiteConfig>('/api/site/restore/' + encodeURIComponent(file), { method: 'POST' }),

  getMedia: () => request<{ items: MediaItem[] }>('/api/media'),
  deleteMedia: (id: string) => request<{ ok: boolean }>('/api/media/' + encodeURIComponent(id), { method: 'DELETE' }),
  uploadDataUrl: (dataUrl: string, fileName: string) =>
    request<MediaItem>('/api/media/from-data-url', { method: 'POST', ...jsonBody({ dataUrl, fileName }) }),

  /** Upload nhiều file kèm tiến trình (XHR vì fetch chưa báo progress khi upload). */
  upload(files: File[], onProgress?: (ratio: number) => void) {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);

    return new Promise<{ saved: MediaItem[]; skipped: string[] }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/media');
      xhr.withCredentials = true;
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      });
      xhr.addEventListener('load', () => {
        const data = xhr.responseText ? (safeJson(xhr.responseText) as { saved?: MediaItem[]; skipped?: string[]; error?: string }) : null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ saved: data?.saved ?? [], skipped: data?.skipped ?? [] });
        } else {
          reject(new ApiError(data?.error ?? `Upload thất bại (${xhr.status})`, xhr.status));
        }
      });
      xhr.addEventListener('error', () => reject(new ApiError('Mất kết nối khi upload.', 0)));
      xhr.send(form);
    });
  },
};
