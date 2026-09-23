import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, ReceiptText, QrCode, Wrench, Bell, LogOut, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';

const TABS = [
  { to: '/m', label: 'Beranda', icon: Home, end: true },
  { to: '/m/bills', label: 'Tagihan', icon: ReceiptText },
  { to: '/m/guests', label: 'Tamu QR', icon: QrCode },
  { to: '/m/complaints', label: 'Lapor', icon: Wrench },
  { to: '/m/notifications', label: 'Notif', icon: Bell },
];

export default function WargaLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.unread);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 15000);
    return () => clearInterval(t);
  }, [fetchUnread]);

  const isStaff = user.role !== 'warga'; // admin/pengurus/satpam boleh preview

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-50 shadow-2xl relative">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-emerald-800 text-white px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-base">🏡</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate">QGR Smart System</p>
            <p className="text-[11px] text-emerald-200 truncate">
              {isStaff ? `Mode pratinjau Warga · ${user.name}` : (user.house_number ? `${user.name.split(' ')[0]} · Blok ${user.block_name} No. ${user.house_number}` : user.name)}
            </p>
          </div>
          <button onClick={fetchUnread} className="relative p-2 rounded-lg hover:bg-white/10">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <div className="flex flex-col">
            <button onClick={() => { logout(); nav('/login'); }} className="p-2 rounded-lg hover:bg-white/10" title="Keluar">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {isStaff && (
          <div className="bg-amber-100 text-amber-800 text-[11px] px-4 py-1.5 text-center">
            Anda masuk sebagai <b>{user.role}</b> — sedang melihat pratinjau aplikasi Warga.
            {' '}<button className="underline font-semibold" onClick={() => nav(user.role === 'satpam' ? '/gate' : '/app')}>
              <Monitor size={11} className="inline" /> kembali ke dashboard
            </button>
          </div>
        )}

        {/* Konten */}
        <main className="flex-1 px-4 py-4 pb-24 fade-up" key={loc.pathname}>
          <Outlet context={{ unread, refreshUnread: fetchUnread }} />
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 z-30 grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => clsx(
                'relative flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-[10px] font-medium transition-colors',
                isActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
              )}>
              {({ isActive }) => (
                <>
                  <span className={clsx('p-1 rounded-lg', isActive && 'bg-emerald-100')}>
                    <t.icon size={18} />
                  </span>
                  {t.label}
                  {t.to === '/m/notifications' && unread > 0 && (
                    <span className="absolute top-1 right-1/4 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
