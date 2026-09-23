import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('qgr_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('qgr_token')) {
      localStorage.removeItem('qgr_token');
      localStorage.removeItem('qgr_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = 'Terjadi kesalahan.') =>
  e?.response?.data?.error || e?.message || fallback;

export const rupiah = (n) =>
  'Rp ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
