import { useEffect, useState, useCallback } from 'react';
import { BookUser, Camera, LogOut, UserRound, Car, Phone } from 'lucide-react';
import dayjs from 'dayjs';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Textarea, Field, LoadingBlock, EmptyState, ErrorNote, Badge, fmtDateTime,
} from '../../components/ui.jsx';

export default function GateBook() {
  const [houses, setHouses] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [filter, setFilter] = useState('today');
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', purpose: 'Bertamu', vehicle_plate: '', house_id: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'today' ? { today: 'true' } : filter === 'inside' ? { inside: 'true' } : {};
      const [v, h] = await Promise.all([api.get('/guests/visits', { params }), api.get('/housing/houses')]);
      setVisits(v.data.visits);
      setHouses(h.data.houses);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, [load]);

  function pickPhoto(f) {
    setPhoto(f || null);
    setPhotoPreview(f ? URL.createObjectURL(f) : '');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      fd.append('method', 'manual');
      if (photo) fd.append('file', photo);
      await api.post('/guests/visits/manual', fd);
      setForm({ guest_name: '', guest_phone: '', purpose: 'Bertamu', vehicle_plate: '', house_id: '', notes: '' });
      pickPhoto(null);
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function checkout(v) {
    if (!confirm(`Catat keluar untuk ${v.guest_name}?`)) return;
    try { await api.put(`/guests/visits/${v.id}/checkout`); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  const insideCount = visits.filter((v) => !v.check_out_at).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Buku Tamu Digital</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Catat tamu tanpa QR: identitas, foto KTP, dan plat kendaraan. <b className="text-emerald-400">{insideCount} tamu masih di dalam</b> (dari daftar ini).
        </p>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {/* Form input manual */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <p className="font-semibold text-sm mb-3 flex items-center gap-2"><BookUser size={15} className="text-emerald-400" /> Input Tamu Manual</p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nama Tamu" required>
            <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} required
              placeholder="nama sesuai identitas" className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="No. Telepon">
              <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="08xx..."
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
            </Field>
            <Field label="Plat Kendaraan">
              <Input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })} placeholder="B 1234 XYZ"
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Keperluan">
              <Select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100">
                {['Bertamu', 'Kurir / Pengiriman', 'Tukang / Pekerja Bangunan', 'Teknisi (AC, internet, dll.)', 'Ojek Online', 'Lainnya'].map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Rumah Tujuan">
              <Select value={form.house_id} onChange={(e) => setForm({ ...form, house_id: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100">
                <option value="">— tidak spesifik —</option>
                {houses.map((h) => <option key={h.id} value={h.id}>Blok {h.block_name} No. {h.number}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Foto Identitas (KTP/SIM)">
            <label className="block rounded-xl border-2 border-dashed border-slate-700 p-3.5 text-center cursor-pointer hover:border-emerald-500">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files[0])} />
              {photoPreview ? (
                <img src={photoPreview} alt="identitas" className="max-h-28 mx-auto rounded-lg" />
              ) : (
                <>
                  <Camera size={20} className="mx-auto text-slate-500" />
                  <p className="text-xs text-slate-500 mt-1">Foto KTP / SIM tamu</p>
                </>
              )}
            </label>
          </Field>
          <Field label="Catatan">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="keterangan tambahan..."
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>Catat Masuk Tamu</Button>
        </form>
      </Card>

      {/* Daftar kunjungan */}
      <div className="flex gap-2">
        {[['today', 'Hari Ini'], ['inside', 'Masih Di Dalam'], ['all', 'Semua (200)']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${filter === k ? 'bg-emerald-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="py-10 text-center text-slate-500 text-sm">Memuat...</div> : visits.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <EmptyState icon={UserRound} title="Belum ada kunjungan" subtitle="Daftar tamu pada filter ini kosong." />
        </Card>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <Card key={v.id} className="bg-slate-900 border-slate-800 p-3.5">
              <div className="flex items-start gap-3">
                {v.id_photo_path ? (
                  <img src={v.id_photo_path} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-700" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-500 flex items-center justify-center shrink-0"><UserRound size={17} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-slate-100">{v.guest_name}</p>
                    <Badge color={v.method === 'qr' ? 'blue' : 'amber'}>{v.method === 'qr' ? 'QR' : 'Manual'}</Badge>
                    {!v.check_out_at && <Badge color="green" className="pulse-ring">Di dalam</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{v.purpose}{v.house_number && ` → Blok ${v.block_name} No. ${v.house_number}`}</p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span>Masuk {fmtDateTime(v.check_in_at)}</span>
                    {v.check_out_at && <span>Keluar {fmtDateTime(v.check_out_at)}</span>}
                    {v.vehicle_plate && <span className="flex items-center gap-1"><Car size={10} />{v.vehicle_plate}</span>}
                    {v.guest_phone && <span className="flex items-center gap-1"><Phone size={10} />{v.guest_phone}</span>}
                  </p>
                  {v.notes && <p className="text-[11px] text-slate-500 mt-0.5 italic">“{v.notes}”</p>}
                </div>
                {!v.check_out_at && (
                  <Button size="sm" variant="secondary" onClick={() => checkout(v)}
                    className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 shrink-0">
                    <LogOut size={13} /> Keluar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
