import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, ReceiptText, QrCode, Wrench, ChevronRight, AlertCircle, Wallet } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { api, rupiah } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, LoadingBlock, billStatusBadge, complaintStatusBadge } from '../../components/ui.jsx';

dayjs.extend(relativeTime);

export default function WargaHome() {
  const { user } = useAuth();
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setD(data)).catch(console.error);
  }, []);

  if (!d) return <LoadingBlock />;

  const nextBill = (d.bills || []).find((b) => b.status === 'unpaid' || b.status === 'overdue');

  return (
    <div className="space-y-4">
      {/* Sapaan */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-600 text-white p-5 shadow-md">
        <p className="text-emerald-100 text-xs">{dayjs().format('dddd, D MMMM YYYY')}</p>
        <h1 className="text-xl font-bold mt-0.5">Halo, {user.name.split(' ')[0]}! 👋</h1>
        <p className="text-emerald-100 text-xs mt-1">
          {user.house_number ? `Blok ${user.block_name} No. ${user.house_number} — The Quality Garden Residence` : 'The Quality Garden Residence'}
        </p>
        {nextBill ? (
          <Link to="/m/bills" className="mt-4 block rounded-xl bg-white/15 backdrop-blur p-3.5 hover:bg-white/25 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-emerald-100">Tagihan IPL {dayjs(nextBill.period + '-01').format('MMMM YYYY')} — jatuh tempo {nextBill.due_date}</p>
                <p className="text-lg font-bold mt-0.5">{rupiah(nextBill.total)}</p>
              </div>
              <span className="rounded-lg bg-white text-emerald-800 text-xs font-bold px-3 py-2 whitespace-nowrap">Bayar →</span>
            </div>
          </Link>
        ) : (
          <div className="mt-4 rounded-xl bg-white/15 backdrop-blur p-3.5 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-sm">Iuran Anda sudah lunas semua</p>
              <p className="text-[11px] text-emerald-100">Terima kasih telah tertib membayar IPL.</p>
            </div>
          </div>
        )}
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/m/bills">
          <Card className="p-3 text-center hover:shadow-md transition-shadow h-full">
            <p className="text-[10px] text-slate-400 font-medium">Tunggakan</p>
            <p className={`font-bold text-sm mt-1 ${d.outstanding?.total > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {rupiah(d.outstanding?.total)}
            </p>
            <p className="text-[10px] text-slate-400">{d.outstanding?.n || 0} tagihan</p>
          </Card>
        </Link>
        <Link to="/m/guests">
          <Card className="p-3 text-center hover:shadow-md transition-shadow h-full">
            <p className="text-[10px] text-slate-400 font-medium">QR Tamu Aktif</p>
            <p className="font-bold text-sm mt-1 text-sky-700">{(d.myInvites || []).length}</p>
            <p className="text-[10px] text-slate-400">undangan</p>
          </Card>
        </Link>
        <Link to="/m/complaints">
          <Card className="p-3 text-center hover:shadow-md transition-shadow h-full">
            <p className="text-[10px] text-slate-400 font-medium">Laporan Saya</p>
            <p className="font-bold text-sm mt-1 text-amber-600">{(d.complaints || []).length}</p>
            <p className="text-[10px] text-slate-400">tiket</p>
          </Card>
        </Link>
      </div>

      {/* Menu cepat */}
      <div className="grid grid-cols-4 gap-2">
        {[
          ['/m/bills', ReceiptText, 'Iuran IPL', 'bg-emerald-100 text-emerald-700'],
          ['/m/guests', QrCode, 'Tamu QR', 'bg-sky-100 text-sky-700'],
          ['/m/complaints', Wrench, 'Pengaduan', 'bg-amber-100 text-amber-700'],
          ['/m/notifications', Megaphone, 'Info & Notif', 'bg-violet-100 text-violet-700'],
        ].map(([to, Icon, label, cls]) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-slate-200 hover:shadow-md transition-shadow">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls}`}><Icon size={19} /></span>
            <span className="text-[11px] font-medium text-slate-600">{label}</span>
          </Link>
        ))}
      </div>

      {/* Pengumuman */}
      <Card>
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Megaphone size={15} className="text-emerald-700" /> Pengumuman Terbaru
          </h3>
          <Link to="/m/notifications" className="text-[11px] text-emerald-700 font-medium">Semua →</Link>
        </div>
        <div className="p-3 space-y-2">
          {(d.announcements || []).slice(0, 3).map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base">{a.category === 'darurat' ? '🚨' : a.category === 'kegiatan' ? '🎉' : a.category === 'keamanan' ? '🛡️' : '📢'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 leading-snug">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5">{dayjs(a.published_at.replace(' ', 'T')).fromNow()}</p>
                </div>
              </div>
            </div>
          ))}
          {(d.announcements || []).length === 0 && <p className="text-center text-xs text-slate-400 py-4">Belum ada pengumuman.</p>}
        </div>
      </Card>

      {/* Laporan saya terbaru */}
      {(d.complaints || []).length > 0 && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-4">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Wrench size={15} className="text-amber-600" /> Pengaduan Saya
            </h3>
            <Link to="/m/complaints" className="text-[11px] text-emerald-700 font-medium">Semua →</Link>
          </div>
          <div className="p-3 space-y-2">
            {d.complaints.slice(0, 3).map((c) => (
              <Link key={c.id} to="/m/complaints" className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-mono text-slate-400">{c.code}</p>
                  <p className="text-sm font-medium text-slate-700 truncate">{c.title}</p>
                </div>
                {complaintStatusBadge(c.status)}
                <ChevronRight size={15} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
