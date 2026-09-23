import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Search, CreditCard, FileImage, Zap } from 'lucide-react';
import { api, rupiah, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Modal, LoadingBlock, EmptyState, ErrorNote, Textarea,
  payStatusBadge, fmtDateTime,
} from '../../components/ui.jsx';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(null);
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      const { data } = await api.get('/payments', { params });
      setPayments(data.payments);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter((p) =>
    !q || `${p.block_name} ${p.house_number} ${p.channel_label || ''} ${p.va_number || ''}`.toLowerCase().includes(q.toLowerCase())
  );

  async function submitDecision(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/payments/${verifying.id}/verify`, { decision, note });
      setVerifying(null); setNote(''); load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function forceSettle(p) {
    if (!confirm('Paksa settlement webhook gateway untuk pembayaran pending ini?\n(Hanya untuk demo/testing integrasi.)')) return;
    try { await api.post(`/payments/${p.id}/settle`); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Verifikasi Pembayaran</h1>
        <p className="text-sm text-slate-500">
          Kanal digital (VA/QRIS/e-wallet/kartu) diverifikasi otomatis oleh webhook payment gateway. Transfer manual diverifikasi bendahara di sini.
        </p>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari rumah / kanal / no. VA..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Semua Status</option>
            <option value="pending">Menunggu Verifikasi</option>
            <option value="verified">Terverifikasi</option>
            <option value="failed">Ditolak</option>
          </Select>
        </div>

        {loading ? <LoadingBlock /> : filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="Tidak ada pembayaran" subtitle="Pembayaran warga akan muncul di sini secara real-time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Rumah</th>
                  <th className="py-2 pr-3">Periode</th>
                  <th className="py-2 pr-3">Kanal</th>
                  <th className="py-2 pr-3">No. VA / Ref</th>
                  <th className="py-2 pr-3 text-right">Nominal</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 font-medium text-slate-700">Blok {p.block_name} No. {p.house_number}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{p.period}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{p.channel_label || p.method}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-400">
                      {p.va_number || p.gateway_ref || '—'}
                      {p.proof_path && (
                        <a href={p.proof_path} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-emerald-700 hover:underline">
                          <FileImage size={13} /> bukti
                        </a>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">{rupiah(p.amount)}</td>
                    <td className="py-2.5 pr-3">{payStatusBadge(p.status)}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-400">
                      {p.paid_at ? fmtDateTime(p.paid_at) : fmtDateTime(p.created_at)}
                      {p.verified_by_name && <p className="text-[10px]">oleh {p.verified_by_name}</p>}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {p.status === 'pending' && p.method === 'manual' && (
                        <Button size="sm" onClick={() => { setVerifying(p); setDecision('approve'); }}>Verifikasi</Button>
                      )}
                      {p.status === 'pending' && p.method !== 'manual' && (
                        <button onClick={() => forceSettle(p)} className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:underline" title="Paksa webhook gateway (demo)">
                          <Zap size={12} /> settle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!verifying} onClose={() => setVerifying(null)} title={verifying ? `Verifikasi Transfer Manual — Blok ${verifying.block_name} No. ${verifying.house_number}` : ''}>
        {verifying && (
          <form onSubmit={submitDecision} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Periode</span><b>{verifying.period}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Nominal tagihan</span><b>{rupiah(verifying.bill_total)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Diajukan</span><b>{rupiah(verifying.amount)}</b></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Bukti transfer</span>
                {verifying.proof_path
                  ? <a className="text-emerald-700 font-medium hover:underline inline-flex items-center gap-1" href={verifying.proof_path} target="_blank" rel="noreferrer"><FileImage size={14} /> Lihat bukti</a>
                  : <span className="text-amber-600 text-xs">belum diunggah warga</span>}
              </div>
              {verifying.note && <div className="pt-1 text-xs text-slate-500 border-t border-slate-200 mt-2">Catatan warga: {verifying.note}</div>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDecision('approve')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium ${decision === 'approve' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>
                <CheckCircle2 size={15} className="inline mr-1" /> Setujui
              </button>
              <button type="button" onClick={() => setDecision('reject')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium ${decision === 'reject' ? 'border-rose-600 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500'}`}>
                <XCircle size={15} className="inline mr-1" /> Tolak
              </button>
            </div>
            <Textarea placeholder="Catatan verifikasi (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" className="w-full" variant={decision === 'approve' ? 'primary' : 'danger'} loading={busy}>
              {decision === 'approve' ? 'Verifikasi & Tandai Lunas' : 'Tolak Pembayaran'}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
