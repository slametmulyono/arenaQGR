import { useEffect, useState, useCallback } from 'react';
import { QrCode, Plus, Download, XCircle, Clock, CheckCircle2, UserRound, Car } from 'lucide-react';
import dayjs from 'dayjs';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Field, Modal, LoadingBlock, EmptyState, ErrorNote, Badge, fmtDateTime,
} from '../../components/ui.jsx';

const STATUS_BADGE = {
  active: <Badge color="green">Aktif</Badge>,
  used: <Badge color="blue">Terpakai</Badge>,
  expired: <Badge color="slate">Kedaluwarsa</Badge>,
  cancelled: <Badge color="red">Dibatalkan</Badge>,
};

export default function WargaGuests() {
  const [invites, setInvites] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [tab, setTab] = useState('invites');
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', purpose: 'Bertamu', vehicle_plate: '', hours: '4' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, vis] = await Promise.all([api.get('/guests/invites'), api.get('/guests/visits')]);
      setInvites(inv.data.invites);
      setVisits(vis.data.visits);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // refresh berkala agar status QR (terpakai oleh satpam) ter-update
  useEffect(() => {
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/guests/invites', { ...form, hours: Number(form.hours) });
      setShowNew(false);
      setForm({ guest_name: '', guest_phone: '', purpose: 'Bertamu', vehicle_plate: '', hours: '4' });
      load();
      setShowQR(data.invite); // langsung tampilkan QR-nya
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function cancel(inv) {
    if (!confirm(`Batalkan undangan untuk ${inv.guest_name}? QR tidak akan bisa dipindai lagi.`)) return;
    try { await api.put(`/guests/invites/${inv.id}/cancel`); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  function downloadQR(inv) {
    const a = document.createElement('a');
    a.href = inv.qr_image;
    a.download = `QR-Tamu-${inv.guest_name.replace(/\s+/g, '-')}.png`;
    a.click();
  }

  const isExpired = (inv) => inv.status === 'active' && dayjs(inv.valid_until.replace(' ', 'T')).isBefore(dayjs());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Tamu Digital</h1>
          <p className="text-xs text-slate-500 mt-0.5">Buat QR berbatas waktu untuk tamu, kurir, atau pekerja.</p>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setShowNew(true)}><Plus size={15} /> QR Tamu</Button>
      </div>

      <div className="flex gap-2">
        {[['invites', `Undangan (${invites.length})`], ['visits', `Riwayat Kunjungan (${visits.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${tab === k ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loading ? <LoadingBlock /> : tab === 'invites' ? (
        invites.length === 0 ? (
          <Card><EmptyState icon={QrCode} title="Belum ada undangan" subtitle="Buat QR code untuk tamu Anda — satpam cukup memindai di gerbang." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> Buat Undangan</Button>} /></Card>
        ) : (
          <div className="space-y-2.5">
            {invites.map((inv) => (
              <Card key={inv.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><UserRound size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{inv.guest_name}</p>
                      {inv.status === 'active' && !isExpired(inv) ? STATUS_BADGE.active : STATUS_BADGE[isExpired(inv) ? 'expired' : inv.status]}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{inv.purpose}{inv.vehicle_plate && ` · ${inv.vehicle_plate}`}</p>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock size={11} /> Berlaku s.d. {fmtDateTime(inv.valid_until)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    {inv.qr_image && (
                      <Button size="sm" variant="secondary" onClick={() => setShowQR(inv)}><QrCode size={14} /> QR</Button>
                    )}
                    {inv.status === 'active' && !isExpired(inv) && (
                      <button onClick={() => cancel(inv)} className="text-[11px] text-rose-500 hover:underline flex items-center gap-0.5">
                        <XCircle size={11} /> batalkan
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        visits.length === 0 ? (
          <Card><EmptyState icon={CheckCircle2} title="Belum ada kunjungan" subtitle="Tamu yang dipindai satpam akan tercatat di sini lengkap dengan jam masuk/keluar." /></Card>
        ) : (
          <div className="space-y-2.5">
            {visits.map((v) => (
              <Card key={v.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${v.check_out_at ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-700 pulse-ring'}`}>
                    {v.check_out_at ? <CheckCircle2 size={16} /> : <UserRound size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-700 text-sm truncate">{v.guest_name}</p>
                    <p className="text-xs text-slate-500 truncate">{v.purpose}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Masuk {fmtDateTime(v.check_in_at)}</span>
                      {v.check_out_at ? <span>· Keluar {fmtDateTime(v.check_out_at)}</span> : <Badge color="green">masih di dalam</Badge>}
                      {v.vehicle_plate && <span className="flex items-center gap-0.5"><Car size={10} />{v.vehicle_plate}</span>}
                    </p>
                  </div>
                  <Badge color={v.method === 'qr' ? 'blue' : 'amber'}>{v.method === 'qr' ? 'Scan QR' : 'Manual'}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Modal buat undangan */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Buat Undangan QR Tamu">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nama Tamu" required>
            <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="nama lengkap / rombongan" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="No. Telepon Tamu">
              <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="08xx..." />
            </Field>
            <Field label="Plat Kendaraan">
              <Input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })} placeholder="B 1234 XYZ" />
            </Field>
          </div>
          <Field label="Keperluan">
            <Select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {['Bertamu', 'Kurir / Pengiriman', 'Tukang / Pekerja Bangunan', 'Teknisi (AC, internet, dll.)', 'Acara Keluarga', 'Lainnya'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Masa Berlaku QR">
            <Select value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}>
              <option value="2">2 jam</option>
              <option value="4">4 jam</option>
              <option value="8">8 jam</option>
              <option value="24">24 jam (1 hari)</option>
              <option value="72">72 jam (3 hari)</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={busy}><QrCode size={16} /> Buat QR Code</Button>
          <p className="text-[11px] text-slate-400 text-center">QR bersifat unik & kedaluwarsa otomatis (expiring token) — hanya bisa dipindai di pos gerbang.</p>
        </form>
      </Modal>

      {/* Modal tampil QR */}
      <Modal open={!!showQR} onClose={() => setShowQR(null)} title={showQR ? `QR Tamu — ${showQR.guest_name}` : ''}>
        {showQR && (
          <div className="text-center space-y-3">
            <img src={showQR.qr_image} alt="QR Code tamu" className="mx-auto w-64 h-64 rounded-2xl border-4 border-emerald-800 shadow-lg" />
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
              <p><b className="text-slate-700">{showQR.guest_name}</b> — {showQR.purpose}</p>
              <p>Menuju: <b>Blok {showQR.block_name} No. {showQR.house_number}</b>{showQR.vehicle_plate ? ` · Kendaraan ${showQR.vehicle_plate}` : ''}</p>
              <p className="flex items-center justify-center gap-1 text-amber-600"><Clock size={12} /> Berlaku sampai {fmtDateTime(showQR.valid_until)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => downloadQR(showQR)}><Download size={15} /> Unduh PNG</Button>
              <Button variant="secondary" className="flex-1" onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'Undangan masuk QGR', text: `Tunjukkan QR ini di gerbang The Quality Garden Residence. Berlaku s.d. ${fmtDateTime(showQR.valid_until)}` }).catch(() => {});
                } else downloadQR(showQR);
              }}>Bagikan</Button>
            </div>
            <p className="text-[11px] text-slate-400">Tunjukkan QR ini di pos gerbang untuk dipindai satpam. Sekali masuk, status berubah menjadi terpakai saat tamu keluar.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
