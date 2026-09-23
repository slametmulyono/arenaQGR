import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, ReceiptText, Zap, Eye } from 'lucide-react';
import { api, rupiah, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Modal, LoadingBlock, EmptyState, ErrorNote, Badge,
  billStatusBadge, payStatusBadge, fmtPeriod, fmtDateTime,
} from '../../components/ui.jsx';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (period) params.period = period;
      if (status) params.status = status;
      if (q) params.q = q;
      const [b, p] = await Promise.all([api.get('/bills', { params }), api.get('/bills/periods')]);
      setBills(b.data.bills);
      setSummary(b.data.summary);
      setPeriods(p.data.periods);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [period, status, q]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    if (!confirm('Terbitkan tagihan IPL untuk periode bulan berjalan sekarang?\n(Sistem menerbitkan otomatis setiap tanggal 1 — tombol ini untuk demo/perbaikan.)')) return;
    setGenBusy(true);
    try {
      const { data } = await api.post('/bills/generate', {});
      alert(data.created > 0 ? `${data.created} tagihan periode ${data.period} berhasil diterbitkan.` : 'Semua tagihan periode berjalan sudah terbit sebelumnya.');
      load();
    } catch (e) { setError(errMsg(e)); } finally { setGenBusy(false); }
  }

  async function openDetail(id) {
    const { data } = await api.get(`/bills/${id}`);
    setDetail(data);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tagihan IPL</h1>
          <p className="text-sm text-slate-500">Terbit otomatis setiap tanggal 1 — IPL, kebersihan & keamanan.</p>
        </div>
        <Button className="ml-auto" onClick={generate} loading={genBusy}><Zap size={15} /> Terbitkan Sekarang</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Card className="p-3 text-center"><p className="text-xs text-slate-400">Total Ditagihkan</p><p className="font-bold text-slate-700">{rupiah(summary.total)}</p></Card>
          <Card className="p-3 text-center"><p className="text-xs text-slate-400">Sudah Lunas</p><p className="font-bold text-emerald-700">{rupiah(summary.paid)}</p></Card>
          <Card className="p-3 text-center"><p className="text-xs text-slate-400">Belum Lunas</p><p className="font-bold text-rose-600">{rupiah(summary.unpaid)}</p></Card>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari blok / nomor rumah..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
            <option value="">Semua Periode</option>
            {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">Semua Status</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="overdue">Terlambat</option>
            <option value="paid">Lunas</option>
          </Select>
        </div>

        {loading ? <LoadingBlock /> : bills.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Tidak ada tagihan" subtitle="Ubah filter atau terbitkan tagihan periode berjalan." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Rumah</th>
                  <th className="py-2 pr-3">Periode</th>
                  <th className="py-2 pr-3 text-right">IPL</th>
                  <th className="py-2 pr-3 text-right">Kebersihan</th>
                  <th className="py-2 pr-3 text-right">Keamanan</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3">Jatuh Tempo</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 font-medium text-slate-700">Blok {b.block_name} No. {b.house_number}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{fmtPeriod(b.period)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{rupiah(b.ipl_amount)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{rupiah(b.kebersihan_amount)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{rupiah(b.keamanan_amount)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">{rupiah(b.total)}</td>
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">{b.due_date}</td>
                    <td className="py-2.5 pr-3">{billStatusBadge(b.status)}</td>
                    <td className="py-2.5 text-right">
                      <button onClick={() => openDetail(b.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Detail"><Eye size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bills.length >= 200 && <p className="text-center text-xs text-slate-400 py-3">Menampilkan 200 baris teratas — gunakan filter.</p>}
          </div>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Tagihan Blok ${detail.bill.block_name} No. ${detail.bill.house_number} — ${fmtPeriod(detail.bill.period)}` : ''} wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">IPL</p><p className="font-semibold">{rupiah(detail.bill.ipl_amount)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Kebersihan</p><p className="font-semibold">{rupiah(detail.bill.kebersihan_amount)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Keamanan</p><p className="font-semibold">{rupiah(detail.bill.keamanan_amount)}</p></div>
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100"><p className="text-xs text-emerald-600">Total</p><p className="font-bold text-emerald-800">{rupiah(detail.bill.total)}</p></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              Status: {billStatusBadge(detail.bill.status)} · Jatuh tempo: <b>{detail.bill.due_date}</b> · Terbit: {fmtDateTime(detail.bill.issued_at)}
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-700 mb-2">Riwayat Pembayaran</p>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Belum ada pembayaran tercatat.</p>
              ) : (
                <div className="space-y-2">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border border-slate-100 p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium text-slate-700">{p.channel_label || p.method}</span>
                      {p.va_number && <span className="font-mono text-xs text-slate-400">VA {p.va_number}</span>}
                      <span className="text-slate-600">{rupiah(p.amount)}</span>
                      {payStatusBadge(p.status)}
                      {p.paid_at && <span className="text-xs text-slate-400 ml-auto">{fmtDateTime(p.paid_at)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
