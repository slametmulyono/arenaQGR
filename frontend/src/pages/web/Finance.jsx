import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Wallet, ArrowDownCircle, ArrowUpCircle, Paperclip } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { api, rupiah, errMsg } from '../../api.js';
import {
  Card, CardHeader, Button, Input, Select, Field, Textarea, Modal, LoadingBlock, EmptyState,
  ErrorNote, Badge, fmtPeriod, fmtDate,
} from '../../components/ui.jsx';

const CATEGORIES = ['keamanan', 'kebersihan', 'utilitas', 'fasilitas', 'perbaikan', 'kegiatan', 'sewa fasilitas', 'lainnya'];

export default function Finance() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    period: dayjs().format('YYYY-MM'), title: '', type: 'pengeluaran',
    category: 'lainnya', amount: '', description: '', published: true,
  });
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (period) params.period = period;
      if (type) params.type = type;
      const [r, s, p] = await Promise.all([
        api.get('/finance/reports', { params }),
        api.get('/finance/summary'),
        api.get('/finance/periods'),
      ]);
      setReports(r.data.reports);
      setSummary(r.data.summary);
      setTrend(s.data.months.map((m) => ({ ...m, label: dayjs(m.period + '-01').format('MMM') })));
      setPeriods(p.data.periods);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [period, type]);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);
      await api.post('/finance/reports', fd);
      setShowNew(false); setFile(null);
      setForm({ ...form, title: '', amount: '', description: '' });
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function remove(r) {
    if (!confirm(`Hapus laporan "${r.title}"?`)) return;
    try { await api.delete(`/finance/reports/${r.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Keuangan</h1>
          <p className="text-sm text-slate-500">Kas masuk & keluar lingkungan — dipublikasikan ringkas ke warga (transparansi).</p>
        </div>
        <Button className="ml-auto" onClick={() => setShowNew(true)}><Plus size={15} /> Catat Transaksi</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><ArrowDownCircle size={18} /></div>
            <div><p className="text-xs text-slate-400">Pemasukan (non-IPL)</p><p className="font-bold text-emerald-700">{rupiah(summary.income)}</p></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><ArrowUpCircle size={18} /></div>
            <div><p className="text-xs text-slate-400">Pengeluaran</p><p className="font-bold text-rose-600">{rupiah(summary.expense)}</p></div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center"><Wallet size={18} /></div>
            <div><p className="text-xs text-slate-400">Selisih Kas</p><p className="font-bold text-sky-700">{rupiah(summary.balance)}</p></div>
          </Card>
          {summary.iplCollected !== null && (
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center"><Wallet size={18} /></div>
              <div><p className="text-xs text-slate-400">IPL Terkumpul ({period})</p><p className="font-bold text-violet-700">{rupiah(summary.iplCollected)}</p></div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader title="Grafik Kas 6 Bulan" subtitle="pemasukan (IPL terkumpul + kas lain) vs pengeluaran" />
        <div className="px-2 pb-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${v / 1000}rb`)} />
              <Tooltip formatter={(v) => rupiah(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Pemasukan" fill="#047857" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#fda4af" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
            <option value="">Semua Periode</option>
            {periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">
            <option value="">Pemasukan & Pengeluaran</option>
            <option value="pemasukan">Pemasukan saja</option>
            <option value="pengeluaran">Pengeluaran saja</option>
          </Select>
        </div>

        {loading ? <LoadingBlock /> : reports.length === 0 ? (
          <EmptyState icon={Wallet} title="Belum ada laporan" subtitle="Catat transaksi kas masuk/keluar pertama." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Periode</th>
                  <th className="py-2 pr-3">Judul</th>
                  <th className="py-2 pr-3">Kategori</th>
                  <th className="py-2 pr-3">Jenis</th>
                  <th className="py-2 pr-3 text-right">Nominal</th>
                  <th className="py-2 pr-3">Oleh</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{fmtPeriod(r.period)}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-700">{r.title}</p>
                      {r.description && <p className="text-xs text-slate-400 max-w-[320px] truncate">{r.description}</p>}
                    </td>
                    <td className="py-2.5 pr-3"><Badge>{r.category}</Badge></td>
                    <td className="py-2.5 pr-3">
                      {r.type === 'pemasukan' ? <Badge color="green">Masuk</Badge> : <Badge color="red">Keluar</Badge>}
                      {!r.published && <Badge color="amber" className="ml-1">Draft</Badge>}
                    </td>
                    <td className={`py-2.5 pr-3 text-right font-semibold ${r.type === 'pemasukan' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {r.type === 'pemasukan' ? '+' : '−'} {rupiah(r.amount)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-400">
                      {r.created_by_name || 'Sistem'}<br />{fmtDate(r.created_at)}
                      {r.attachment_path && (
                        <a href={r.attachment_path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                          <Paperclip size={11} /> lampiran
                        </a>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <button onClick={() => remove(r)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Catat Transaksi Kas">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Periode" required>
              <Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
            </Field>
            <Field label="Jenis" required>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="pemasukan">Pemasukan (kas masuk)</option>
                <option value="pengeluaran">Pengeluaran (kas keluar)</option>
              </Select>
            </Field>
          </div>
          <Field label="Judul Transaksi" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Perbaikan Portal Blok B" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Nominal (Rp)" required>
              <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </Field>
          </div>
          <Field label="Deskripsi">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Rincian transaksi..." />
          </Field>
          <Field label="Lampiran (kuitansi/foto, opsional)">
            <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="accent-emerald-700" />
            Publikasikan ke warga (notifikasi transparansi kas)
          </label>
          <Button type="submit" className="w-full" loading={busy}>Simpan Transaksi</Button>
        </form>
      </Modal>
    </div>
  );
}
