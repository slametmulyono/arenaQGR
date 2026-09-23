import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Users, ReceiptText, AlertTriangle, UserCheck, ScanLine, TrendingUp, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { api, rupiah } from '../../api.js';
import { Card, CardHeader, LoadingBlock, complaintStatusBadge, priorityBadge } from '../../components/ui.jsx';

function Stat({ icon: Icon, label, value, sub, color = 'emerald', to }) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
    teal: 'bg-teal-100 text-teal-700',
  };
  const body = (
    <Card className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow h-full">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setD(data)).catch(console.error);
  }, []);

  if (!d) return <LoadingBlock />;

  const b = d.billsMonth || {};
  const collectRate = b.billed > 0 ? Math.round(((b.collected || 0) / b.billed) * 100) : 0;
  const trendData = (d.trend || []).map((t) => ({
    ...t,
    label: dayjs(t.period + '-01').format('MMM'),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ringkasan Lingkungan</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pemantauan hunian, iuran, keamanan, dan layanan warga — periode {b.period && dayjs(b.period + '-01').format('MMMM YYYY')}.
        </p>
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat icon={Home} label="Total Hunian" value={d.houses?.total || 0}
          sub={`${d.houses?.ditempati || 0} ditempati · ${d.houses?.kosong || 0} kosong · ${d.houses?.perbaikan || 0} perbaikan`}
          color="emerald" to="/app/housing" />
        <Stat icon={Users} label="Warga Terdaftar" value={d.residents || 0} sub="akun warga aktif" color="sky" to="/app/users" />
        <Stat icon={ReceiptText} label="Tagihan Bulan Ini" value={rupiah(b.billed)}
          sub={`${b.paid || 0}/${b.total || 0} lunas · kolektibilitas ${collectRate}%`} color="violet" to="/app/bills" />
        <Stat icon={TrendingUp} label="Tertagih" value={rupiah(b.collected)}
          sub={`outstanding ${rupiah(b.outstanding)}`} color="teal" to="/app/payments" />
        <Stat icon={AlertTriangle} label="Pengaduan Aktif" value={(d.complaints?.menunggu || 0) + (d.complaints?.diproses || 0)}
          sub={`${d.complaints?.menunggu || 0} menunggu · ${d.complaints?.diproses || 0} diproses`} color="amber" to="/app/complaints" />
        <Stat icon={ScanLine} label="Tamu Hari Ini" value={d.guestsToday || 0}
          sub={`${d.guestsInside || 0} masih di dalam · ${d.activeInvites || 0} QR aktif`} color="rose" to="/app/bills" />
      </div>

      {/* Grafik */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Penagihan vs Kolektibilitas IPL" subtitle="6 bulan terakhir (nilai tagihan & yang berhasil tertagih)" />
          <div className="px-2 pb-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${v / 1000}rb`)} />
                <Tooltip formatter={(v) => rupiah(v)} labelStyle={{ fontWeight: 600 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed" name="Ditagihkan" fill="#a7f3d0" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="Tertagih" fill="#047857" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Status Pengaduan" subtitle="distribusi seluruh tiket" />
          <div className="px-5 pb-4 space-y-3">
            {[
              ['Menunggu', d.complaints?.menunggu || 0, 'bg-amber-400'],
              ['Diproses', d.complaints?.diproses || 0, 'bg-sky-500'],
              ['Selesai', d.complaints?.selesai || 0, 'bg-emerald-600'],
            ].map(([label, n, cls]) => {
              const totalC = d.complaints?.total || 1;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="text-slate-400">{n} tiket</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, (n / totalC) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <CardHeader title="Kas Bulan Ini" subtitle="catatan keuangan non-IPL" />
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            {(() => {
              const inc = (d.cash || []).find((c) => c.type === 'pemasukan')?.total || 0;
              const exp = (d.cash || []).find((c) => c.type === 'pengeluaran')?.total || 0;
              return (
                <>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><Wallet size={12} /> Pemasukan</p>
                    <p className="text-sm font-bold text-emerald-800 mt-1">{rupiah(inc)}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1"><Wallet size={12} /> Pengeluaran</p>
                    <p className="text-sm font-bold text-rose-800 mt-1">{rupiah(exp)}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      </div>

      {/* Pengaduan terbaru */}
      <Card>
        <CardHeader
          title="Pengaduan Terbaru"
          subtitle="5 tiket terakhir dari warga"
          action={<Link to="/app/complaints" className="text-xs text-emerald-700 font-medium hover:underline">Lihat semua →</Link>}
        />
        <div className="px-5 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3">Kode</th>
                <th className="py-2 pr-3">Judul</th>
                <th className="py-2 pr-3 hidden md:table-cell">Pelapor</th>
                <th className="py-2 pr-3">Prioritas</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(d.recentComplaints || []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{c.code}</td>
                  <td className="py-2.5 pr-3 font-medium text-slate-700 max-w-[280px] truncate">{c.title}</td>
                  <td className="py-2.5 pr-3 text-slate-500 hidden md:table-cell">{c.reporter}</td>
                  <td className="py-2.5 pr-3">{priorityBadge(c.priority)}</td>
                  <td className="py-2.5">{complaintStatusBadge(c.status)}</td>
                </tr>
              ))}
              {(d.recentComplaints || []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-sm">Belum ada pengaduan 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
