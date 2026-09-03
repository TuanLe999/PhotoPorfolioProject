/* ==========================================================================
   api.js — bọc các endpoint của backend .NET
   ========================================================================== */

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = data?.error || `${options.method || 'GET'} ${url} → ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

const safeJson = (text) => { try { return JSON.parse(text); } catch { return { raw: text }; } };

const jsonBody = (body) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

export const api = {
  me: () => request('/api/auth/me'),
  login: (password) => request('/api/auth/login', { method: 'POST', ...jsonBody({ password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  getSite: () => request('/api/site'),
  saveSite: (config) => request('/api/site', { method: 'PUT', ...jsonBody(config) }),
  history: () => request('/api/site/history'),
  restore: (file) => request('/api/site/restore/' + encodeURIComponent(file), { method: 'POST' }),

  getMedia: () => request('/api/media'),
  deleteMedia: (id) => request('/api/media/' + encodeURIComponent(id), { method: 'DELETE' }),
  uploadDataUrl: (dataUrl, fileName) =>
    request('/api/media/from-data-url', { method: 'POST', ...jsonBody({ dataUrl, fileName }) }),

  /** Upload nhiều file kèm callback tiến trình (XHR vì fetch chưa báo progress upload). */
  upload(files, onProgress) {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media');
      xhr.withCredentials = true;
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      });
      xhr.addEventListener('load', () => {
        const data = xhr.responseText ? safeJson(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error || 'Upload thất bại (' + xhr.status + ')'));
      });
      xhr.addEventListener('error', () => reject(new Error('Mất kết nối khi upload.')));
      xhr.send(form);
    });
  }
};
