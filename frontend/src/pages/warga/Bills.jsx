import { useEffect, useState, useCallback } from 'react';
import { ReceiptText, CreditCard, Copy, Check, Clock, Landmark, Wallet, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { api, rupiah, errMsg } from '../../api.js';
import {
  Card, Button, Modal, LoadingBlock, EmptyState, ErrorNote, billStatusBadge, payStatusBadge,
  fmtPeriod, fmtDateTime, Badge,
} from '../../components/ui.jsx';

const CHANNEL_ICONS = {
  va: Landmark, ewallet: Wallet, card: CreditCard, manual: ReceiptText,
};

export default function WargaBills() {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payBill, setPayBill] = useState(null);
  const [method, setMethod] = useState('qris');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {payment, autoVerify}
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState(null);
  const [proofFile, setProofFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bills');
      setBills(data.bills);
      setSummary(data.summary);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/payments/channels').then(({ data }) => setChannels(data.channels)).catch(() => {}); }, []);

  // Saat menunggu verifikasi otomatis, polling status pembayaran
  useEffect(() => {
    if (!result?.autoVerify) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      try {
        const { data } = await api.get(`/bills/${result.payment.bill_id}`);
        const pay = data.payments.find((p) => p.id === result.payment.id);
        if (pay) setResult((r) => ({ ...r, payment: pay }));
        if (pay?.status === 'verified' || n > 20) { clearInterval(t); load(); }
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(t);
  }, [result?.payment?.id, result?.autoVerify, load]);

  async function pay(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/payments', { bill_id: payBill.id, method });
      setResult(data);
      setPayBill(null);
    } catch (e2) { setError(errMsg(e2)); setPayBill(null); } finally { setBusy(false); }
  }

  async function uploadProof(e) {
    e.preventDefault();
    if (!proofFile) return setError('Pilih file bukti transfer terlebih dahulu.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', proofFile);
      await api.post(`/payments/${result.payment.id}/upload-proof`, fd);
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function openDetail(id) {
    const { data } = await api.get(`/bills/${id}`);
    setDetail(data);
  }

  const groups = ['va', 'ewallet', 'card', 'manual'];
  const groupLabels = { va: 'Virtual Account Bank', ewallet: 'E-Wallet & QRIS', card: 'Kartu Kredit/Debit', manual: 'Transfer Manual' };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Tagihan & Pembayaran IPL</h1>
        <p className="text-xs text-slate-500 mt-0.5">Iuran Pengelolaan Lingkungan, kebersihan & keamanan.</p>
      </div>

      {summary && summary.unpaid > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700">Total yang harus dibayar</p>
          <p className="text-xl font-bold text-amber-800">{rupiah(summary.unpaid)}</p>
        </Card>
      )}

      <ErrorNote>{error}</ErrorNote>

      {loading ? <LoadingBlock /> : bills.length === 0 ? (
        <Card><EmptyState icon={ReceiptText} title="Belum ada tagihan" subtitle="Tagihan terbit otomatis setiap tanggal 1." /></Card>
      ) : (
        <div className="space-y-2.5">
          {bills.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">IPL {fmtPeriod(b.period)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Jatuh tempo {b.due_date}</p>
                </div>
                {billStatusBadge(b.status)}
              </div>
              <div className="flex items-end justify-between mt-3">
                <p className="text-lg font-bold text-slate-800">{rupiah(b.total)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openDetail(b.id)}>Rincian</Button>
                  {(b.status === 'unpaid' || b.status === 'overdue') && (
                    <Button size="sm" onClick={() => { setPayBill(b); setResult(null); }}>Bayar</Button>
                  )}
                </div>
              </div>
              {b.status === 'paid' && b.paid_at && (
                <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
                  <Check size={12} /> Lunas {fmtDateTime(b.paid_at)} via {b.payment_channel || b.payment_method}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal pilih kanal bayar */}
      <Modal open={!!payBill} onClose={() => setPayBill(null)} title={payBill ? `Bayar IPL ${fmtPeriod(payBill.period)}` : ''}>
        {payBill && (
          <form onSubmit={pay} className="space-y-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <p className="text-xs text-emerald-600">Total Tagihan</p>
              <p className="text-2xl font-bold text-emerald-800">{rupiah(payBill.total)}</p>
              <p className="text-[11px] text-emerald-600 mt-1">IPL {rupiah(payBill.ipl_amount)} · Kebersihan {rupiah(payBill.kebersihan_amount)} · Keamanan {rupiah(payBill.keamanan_amount)}</p>
            </div>
            <p className="text-sm font-medium text-slate-700">Pilih Metode Pembayaran</p>
            {groups.map((g) => {
              const chans = channels.filter((c) => c.group === g);
              if (chans.length === 0) return null;
              const Icon = CHANNEL_ICONS[g];
              return (
                <div key={g}>
                  <p className="text-[11px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center gap-1"><Icon size={12} /> {groupLabels[g]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {chans.map((c) => (
                      <button type="button" key={c.id} onClick={() => setMethod(c.id)}
                        className={clsx('rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors',
                          method === c.id ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20' : 'border-slate-200 text-slate-600 hover:border-emerald-300')}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              <CreditCard size={16} /> Bayar {rupiah(payBill.total)}
            </Button>
            <p className="text-[11px] text-slate-400 text-center">
              Kanal digital diverifikasi otomatis real-time oleh payment gateway (simulasi). Transfer manual diverifikasi bendahara.
            </p>
          </form>
        )}
      </Modal>

      {/* Modal hasil pembayaran */}
      <Modal open={!!result} onClose={() => { setResult(null); setProofFile(null); load(); }} title="Pembayaran Dibuat">
        {result && (
          <div className="space-y-4">
            {result.payment.method === 'manual' ? (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2">
                  <p className="font-semibold text-slate-700">Transfer ke rekening kas RT:</p>
                  <p className="font-mono text-slate-600">Bank BCA — <b>1234-5678-90</b><br />a.n. Kas RT 007 QGR</p>
                  <p className="text-xs text-slate-500">Nominal: <b>{rupiah(result.payment.amount)}</b></p>
                  <div className="flex items-center gap-2">{payStatusBadge(result.payment.status)}<span className="text-xs text-slate-400">menunggu verifikasi bendahara</span></div>
                </div>
                {!result.payment.proof_path ? (
                  <form onSubmit={uploadProof} className="space-y-3">
                    <label className="block rounded-xl border-2 border-dashed border-slate-300 p-5 text-center cursor-pointer hover:border-emerald-400">
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProofFile(e.target.files[0])} />
                      <ReceiptText size={22} className="mx-auto text-slate-400" />
                      <p className="text-xs text-slate-500 mt-2">{proofFile ? proofFile.name : 'Unggah bukti transfer (JPG/PNG/PDF)'}</p>
                    </label>
                    <Button type="submit" className="w-full" loading={busy} disabled={!proofFile}>Kirim Bukti ke Bendahara</Button>
                  </form>
                ) : (
                  <div className="text-center text-sm text-emerald-700 py-2">
                    ✔ Bukti terkirim — menunggu verifikasi bendahara.
                    <a href={result.payment.proof_path} target="_blank" rel="noreferrer" className="underline block text-xs mt-1">lihat bukti</a>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center space-y-2">
                  <p className="text-xs text-slate-500">{result.payment.channel_label}</p>
                  {result.payment.va_number && (
                    <>
                      <p className="text-[11px] text-slate-400">Nomor Virtual Account / Kode Bayar</p>
                      <div className="flex items-center justify-center gap-2">
                        <p className="font-mono text-lg font-bold tracking-wider text-slate-800">{result.payment.va_number}</p>
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(result.payment.va_number); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500">
                          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </>
                  )}
                  <p className="text-xs text-slate-500">Nominal: <b>{rupiah(result.payment.amount)}</b></p>
                </div>
                <div className={clsx('rounded-xl p-4 text-center border',
                  result.payment.status === 'verified' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                  {result.payment.status === 'verified' ? (
                    <>
                      <p className="text-3xl">✅</p>
                      <p className="font-bold text-emerald-800 mt-1">Pembayaran Terverifikasi Otomatis</p>
                      <p className="text-xs text-emerald-600 mt-1">Webhook payment gateway diterima {fmtDateTime(result.payment.paid_at)} · Ref {result.payment.gateway_ref}</p>
                    </>
                  ) : (
                    <>
                      <Clock size={26} className="mx-auto text-amber-500 animate-pulse" />
                      <p className="font-bold text-amber-800 mt-1">Menunggu Verifikasi Gateway...</p>
                      <p className="text-xs text-amber-600 mt-1">Lakukan pembayaran lewat kanal yang dipilih. Status akan berubah otomatis dalam beberapa detik (simulasi webhook real-time).</p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal rincian tagihan */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Rincian ${fmtPeriod(detail.bill.period)}` : ''}>
        {detail && (
          <div className="space-y-3 text-sm">
            {[
              ['Iuran Pengelolaan Lingkungan (IPL)', detail.bill.ipl_amount],
              ['Iuran Kebersihan', detail.bill.kebersihan_amount],
              ['Iuran Keamanan', detail.bill.keamanan_amount],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-dashed border-slate-100 pb-2">
                <span className="text-slate-500">{l}</span><span className="font-medium">{rupiah(v)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span><span>{rupiah(detail.bill.total)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              Status {billStatusBadge(detail.bill.status)} · Jatuh tempo {detail.bill.due_date}
            </div>
            {detail.payments.length > 0 && (
              <div className="pt-2">
                <p className="font-semibold text-slate-700 mb-2">Riwayat Pembayaran</p>
                {detail.payments.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 p-2.5 mb-1.5 text-xs flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-600">{p.channel_label || p.method}</span>
                    <span className="text-slate-500">{rupiah(p.amount)}</span>
                    {payStatusBadge(p.status)}
                    {p.paid_at && <span className="text-slate-400 ml-auto">{fmtDateTime(p.paid_at)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
