import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreePine, ShieldCheck, Users, Banknote, ScanLine, LogIn } from 'lucide-react';
import { useAuth, homeFor } from '../auth.jsx';
import { errMsg } from '../api.js';
import { Button, Input, Field, ErrorNote } from '../components/ui.jsx';

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', label: 'Super Admin', desc: 'Rina Wijaya — konfigurasi sistem', icon: ShieldCheck, to: '/app' },
  { username: 'pengurus', password: 'pengurus123', label: 'Pengurus', desc: 'Budi Santoso — Ketua RT 007', icon: Users, to: '/app' },
  { username: 'bendahara', password: 'bendahara123', label: 'Bendahara', desc: 'Siti Rahayu — verifikasi & kas', icon: Banknote, to: '/app' },
  { username: 'warga1', password: 'warga123', label: 'Warga', desc: 'Ahmad Fauzi — Blok A No. 12', icon: TreePine, to: '/m' },
  { username: 'satpam', password: 'satpam123', label: 'Satpam', desc: 'Agus Salim — Pos Gerbang Utama', icon: ScanLine, to: '/gate' },
];

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e, u = username, p = password) {
    e?.preventDefault();
    setError('');
    try {
      const user = await login(u, p);
      nav(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errMsg(err, 'Gagal masuk. Periksa username & password.'));
    }
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Panel kiri: branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] max-w-xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 text-white p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="absolute -left-16 bottom-10 w-80 h-80 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl">🏡</div>
            <div>
              <p className="font-bold text-lg leading-tight">QGR Smart System</p>
              <p className="text-emerald-200 text-sm">The Quality Garden Residence</p>
            </div>
          </div>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold leading-snug">
            Tata kelola lingkungan perumahan yang modern, transparan & aman.
          </h1>
          <ul className="space-y-3 text-emerald-100 text-sm">
            {[
              ['💳', 'Iuran IPL otomatis & pembayaran digital real-time'],
              ['📱', 'QR code tamu berbatas waktu untuk keamanan gerbang'],
              ['🛠️', 'Ticketing pengaduan fasilitas dengan alur resolusi'],
              ['📢', 'Broadcast pengumuman & notifikasi ke seluruh warga'],
            ].map(([ic, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base">{ic}</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-emerald-300/70 text-xs">
          API-First Architecture · JWT + RBAC · Event-Driven Async Jobs
        </p>
      </div>

      {/* Panel kanan: form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center text-xl">🏡</div>
            <div>
              <p className="font-bold text-slate-800">QGR Smart System</p>
              <p className="text-slate-500 text-xs">The Quality Garden Residence</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
            <h2 className="text-xl font-bold text-slate-800">Masuk ke akun Anda</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Akses sesuai peran: dashboard web untuk pengurus, aplikasi mobile untuk warga & satpam.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Username" required>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="contoh: warga1" autoFocus autoComplete="username" />
              </Field>
              <Field label="Password" required>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {!loading && <LogIn size={16} />} Masuk
              </Button>
            </form>
          </div>

          {/* Akun demo sekali klik */}
          <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Akun Demo — klik untuk masuk</p>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.username}
                  onClick={(e) => submit(e, a.username, a.password)}
                  disabled={loading}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <a.icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-700">{a.label}
                      <span className="ml-2 text-[11px] font-normal text-slate-400">{a.username}</span>
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{a.desc}</span>
                  </span>
                  <span className="text-emerald-600"><LogIn size={15} /></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
