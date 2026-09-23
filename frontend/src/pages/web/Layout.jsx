import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Home, Users, ReceiptText, CreditCard, Wallet,
  MessageSquareWarning, Megaphone, ScrollText, Settings, LogOut,
  Bell, Menu, X, Smartphone,
} from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';

dayjs.extend(relativeTime);

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/housing', label: 'Data Hunian', icon: Home },
  { to: '/app/users', label: 'Manajemen User', icon: Users, adminOnly: true },
  { to: '/app/bills', label: 'Tagihan IPL', icon: ReceiptText },
  { to: '/app/payments', label: 'Pembayaran', icon: CreditCard },
  { to: '/app/finance', label: 'Laporan Keuangan', icon: Wallet },
  { to: '/app/complaints', label: 'Pengaduan Warga', icon: MessageSquareWarning },
  { to: '/app/announcements', label: 'Pengumuman', icon: Megaphone },
  { to: '/app/logs', label: 'Log Aktivitas', icon: ScrollText, adminOnly: true },
  { to: '/app/settings', label: 'Pengaturan', icon: Settings, adminOnly: true },
];

const ROLE_LABEL = { super_admin: 'Super Admin', pengurus: 'Pengurus' };

export default function WebLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const fetchNotif = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.unread);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotif();
    const t = setInterval(fetchNotif, 20000);
    return () => clearInterval(t);
  }, [fetchNotif]);

  async function openNotifs() {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      const { data } = await api.get('/notifications');
      setNotifs(data.notifications.slice(0, 15));
    }
  }

  async function markAllRead() {
    await api.put('/notifications/read-all');
    setNotifs((n) => n.map((x) => ({ ...x, is_read: 1 })));
    setUnread(0);
  }

  const items = NAV.filter((n) => !n.adminOnly || user.role === 'super_admin');

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-emerald-950 text-emerald-100 flex flex-col transition-transform lg:translate-x-0 lg:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-emerald-900/60">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-lg">🏡</div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight">QGR Smart System</p>
            <p className="text-[11px] text-emerald-400 truncate">The Quality Garden Residence</p>
          </div>
          <button className="ml-auto lg:hidden text-emerald-300" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-200 hover:bg-emerald-900 hover:text-white'
              )}
            >
              <n.icon size={17} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 space-y-1 border-t border-emerald-900/60 pt-3">
          <NavLink to="/m" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-200 hover:bg-emerald-900 hover:text-white">
            <Smartphone size={17} /> Tampilan Mobile Warga
          </NavLink>
          <button
            onClick={() => { logout(); nav('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-300 hover:bg-rose-950/60 hover:text-rose-200"
          >
            <LogOut size={17} /> Keluar
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Konten */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center gap-3">
          <button className="lg:hidden p-2 -ml-2 text-slate-600" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">Dashboard {ROLE_LABEL[user.role]}</p>
            <p className="text-xs text-slate-400">{dayjs().format('dddd, D MMMM YYYY')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 relative">
            <button onClick={openNotifs} className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-700">{user.name}</p>
                <p className="text-[11px] text-slate-400">{user.position || ROLE_LABEL[user.role]}</p>
              </div>
            </div>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-12 w-[360px] max-w-[92vw] bg-white rounded-xl shadow-xl border border-slate-200 z-40 slide-down overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <p className="font-semibold text-sm text-slate-700">Notifikasi</p>
                    <button onClick={markAllRead} className="text-xs text-emerald-700 hover:underline">Tandai dibaca semua</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                    {notifs.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Tidak ada notifikasi.</p>}
                    {notifs.map((n) => (
                      <div key={n.id} className={clsx('px-4 py-3', !n.is_read && 'bg-emerald-50/60')}>
                        <p className="text-sm font-medium text-slate-700">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">{dayjs(n.created_at.replace(' ', 'T')).fromNow()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 fade-up">
          <Outlet />
        </main>

        <footer className="px-8 py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
          QGR Smart System v1.0 — Fase 1 (Core MVP) · REST API + JWT/RBAC + Event-Driven Workers
        </footer>
      </div>
    </div>
  );
}
