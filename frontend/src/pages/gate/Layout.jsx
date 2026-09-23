import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ScanLine, BookUser, Activity, LogOut, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../auth.jsx';

const TABS = [
  { to: '/gate', label: 'Scan QR', icon: ScanLine, end: true },
  { to: '/gate/book', label: 'Buku Tamu', icon: BookUser },
  { to: '/gate/activity', label: 'Aktivitas', icon: Activity },
];

export default function GateLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isStaff = user.role !== 'satpam';

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-950 text-slate-100 shadow-2xl relative">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-base">🛡️</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight">Pos Gerbang QGR</p>
            <p className="text-[11px] text-slate-400 truncate">
              {isStaff ? `Mode pratinjau Satpam · ${user.name}` : `${user.name}${user.position ? ` · ${user.position}` : ''}`}
            </p>
          </div>
          <button onClick={() => { logout(); nav('/login'); }} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="Keluar">
            <LogOut size={17} />
          </button>
        </header>

        {isStaff && (
          <div className="bg-amber-500/15 text-amber-300 text-[11px] px-4 py-1.5 text-center border-b border-amber-500/20">
            Anda masuk sebagai <b>{user.role}</b> — pratinjau aplikasi Satpam.
            {' '}<button className="underline font-semibold" onClick={() => nav('/app')}><Monitor size={11} className="inline" /> dashboard</button>
          </div>
        )}

        <main className="flex-1 px-4 py-4 pb-24 fade-up">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900 border-t border-slate-800 z-30 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors',
                isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              )}>
              {({ isActive }) => (
                <>
                  <span className={clsx('p-1 rounded-lg', isActive && 'bg-emerald-500/15')}>
                    <t.icon size={19} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
