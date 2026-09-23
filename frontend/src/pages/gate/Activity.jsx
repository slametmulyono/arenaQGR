import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Siren, Users, UserCheck, QrCode, Phone } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { api, errMsg } from '../../api.js';
import { Card, LoadingBlock, EmptyState, ErrorNote, Badge, complaintStatusBadge, fmtDateTime } from '../../components/ui.jsx';

dayjs.extend(relativeTime);

export default function GateActivity() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setD(data)).catch((e) => setError(errMsg(e)));
    const t = setInterval(() => api.get('/dashboard').then(({ data }) => setD(data)).catch(() => {}), 25000);
    return () => clearInterval(t);
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!d) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Aktivitas Keamanan</h1>
        <p className="text-xs text-slate-400 mt-0.5">Pantauan gerbang waktu nyata & laporan darurat warga.</p>
      </div>

      {/* Statistik pos */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [Users, 'Tamu Hari Ini', d.today, 'text-emerald-400'],
          [UserCheck, 'Masih Di Dalam', d.inside, 'text-sky-400'],
          [QrCode, 'QR Aktif', d.activeInvites, 'text-violet-400'],
        ].map(([Icon, label, val, cls]) => (
          <Card key={label} className="bg-slate-900 border-slate-800 p-3.5 text-center">
            <Icon size={17} className={`mx-auto ${cls}`} />
            <p className="text-xl font-bold mt-1.5">{val}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      {/* Laporan darurat */}
      <div>
        <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Siren size={13} /> Laporan Darurat / Prioritas ({d.emergency.length})
        </p>
        {d.emergency.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <EmptyState icon={Activity} title="Tidak ada laporan darurat" subtitle="Lingkungan dalam kondisi aman & terkendali." />
          </Card>
        ) : (
          <div className="space-y-2">
            {d.emergency.map((c) => (
              <Card key={c.id} className="bg-rose-950/40 border-rose-800/40 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🚨</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-rose-100">{c.title}</p>
                      {complaintStatusBadge(c.status)}
                    </div>
                    <p className="text-[11px] text-rose-300/70 mt-0.5 font-mono">{c.code} · {dayjs(c.created_at.replace(' ', 'T')).fromNow()}</p>
                    <p className="text-xs text-slate-300 mt-1.5">
                      Pelapor: <b>{c.reporter}</b>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="ml-2 inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <Phone size={11} /> {c.phone}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pergerakan terakhir */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pergerakan Gerbang Terakhir</p>
        {d.recent.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800"><EmptyState icon={Users} title="Belum ada pergerakan" /></Card>
        ) : (
          <Card className="bg-slate-900 border-slate-800 divide-y divide-slate-800">
            {d.recent.map((v) => (
              <div key={v.id} className="p-3.5 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${v.check_out_at ? 'bg-slate-600' : 'bg-emerald-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{v.guest_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {v.house_number ? `Blok ${v.block_name} No. ${v.house_number}` : v.purpose} · masuk {fmtDateTime(v.check_in_at)}
                    {v.check_out_at && ` · keluar ${fmtDateTime(v.check_out_at)}`}
                  </p>
                </div>
                <Badge color={v.method === 'qr' ? 'blue' : 'amber'}>{v.method === 'qr' ? 'QR' : 'Manual'}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>

      <p className="text-center text-[10px] text-slate-600 pt-2">
        Data diperbarui otomatis tiap 25 detik · <Link to="/gate" className="underline">kembali ke Scan QR</Link>
      </p>
    </div>
  );
}
