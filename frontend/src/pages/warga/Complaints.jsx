import { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus, MapPin, Camera, Send, MessageCircle } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { clsx } from 'clsx';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Textarea, Field, Modal, LoadingBlock, EmptyState, ErrorNote,
  complaintStatusBadge, priorityBadge, fmtDateTime,
} from '../../components/ui.jsx';

dayjs.extend(relativeTime);

const PRIORITY_STEPS = [
  { value: 'draft', label: 'Draft', desc: 'simpan dulu, kirim nanti' },
  { value: 'menunggu', label: 'Kirim Sekarang', desc: 'langsung masuk antrean pengurus' },
];

export default function WargaComplaints() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [form, setForm] = useState({ category: '', title: '', description: '', location_text: '', priority: 'normal' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cat] = await Promise.all([api.get('/complaints', { params: { mine: 'true' } }), api.get('/complaints/categories')]);
      setItems(c.data.complaints);
      setCategories(cat.data.categories);
      if (!form.category && cat.data.categories[0]) setForm((f) => ({ ...f, category: cat.data.categories[0] }));
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function pickPhoto(f) {
    setPhoto(f || null);
    setPhotoPreview(f ? URL.createObjectURL(f) : '');
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((fm) => ({
        ...fm,
        location_text: fm.location_text || `Titik GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })),
      () => alert('Lokasi ditolak / tidak tersedia. Ketik lokasi secara manual.')
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== undefined && fd.append(k, v));
      if (photo) fd.append('file', photo);
      await api.post('/complaints', fd);
      setShowNew(false);
      setForm({ category: categories[0] || '', title: '', description: '', location_text: '', priority: 'normal' });
      pickPhoto(null);
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function openDetail(id) {
    const { data } = await api.get(`/complaints/${id}`);
    setDetail(data);
  }

  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api.post(`/complaints/${detail.complaint.id}/comments`, { message: comment });
      setComment('');
      openDetail(detail.complaint.id);
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Pengaduan Warga</h1>
          <p className="text-xs text-slate-500 mt-0.5">Laporkan masalah fasilitas umum & lingkungan, pantau penyelesaiannya.</p>
        </div>
        <Button size="sm" className="ml-auto shrink-0" onClick={() => setShowNew(true)}><Plus size={15} /> Lapor</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loading ? <LoadingBlock /> : items.length === 0 ? (
        <Card>
          <EmptyState icon={Wrench} title="Belum ada pengaduan" subtitle="Lingkungan Anda terpantau bersih dari laporan 🎉"
            action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> Buat Laporan Pertama</Button>} />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((c) => (
            <Card key={c.id}>
              <button onClick={() => openDetail(c.id)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-400">{c.code}</p>
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{c.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{c.category} · {dayjs(c.created_at.replace(' ', 'T')).fromNow()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {complaintStatusBadge(c.status)}
                    {priorityBadge(c.priority)}
                  </div>
                </div>
                {c.photo_path && <img src={c.photo_path} alt="" className="rounded-lg mt-2.5 max-h-32 object-cover w-full" />}
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Modal buat laporan */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Buat Pengaduan Baru">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Kategori" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Judul Laporan" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="mis. Lampu jalan depan blok mati" required />
          </Field>
          <Field label="Uraian Masalah">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Jelaskan detail kejadian, sejak kapan, dampaknya..." />
          </Field>
          <Field label="Lokasi">
            <div className="flex gap-2">
              <Input value={form.location_text || ''} onChange={(e) => setForm({ ...form, location_text: e.target.value })}
                placeholder="mis. depan rumah A-12 / taman cluster B" />
              <Button type="button" variant="secondary" className="shrink-0" onClick={useMyLocation} title="Pakai lokasi saya">
                <MapPin size={15} />
              </Button>
            </div>
          </Field>
          <Field label="Prioritas">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="rendah">Rendah — kosmetik/usulan</option>
              <option value="normal">Normal — umum</option>
              <option value="tinggi">Tinggi — mengganggu banyak warga</option>
              <option value="darurat">🚨 Darurat — keamanan/keselamatan</option>
            </Select>
          </Field>
          <Field label="Foto Pendukung">
            <label className={clsx('block rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors',
              photoPreview ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400')}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files[0])} />
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="max-h-40 mx-auto rounded-lg" />
              ) : (
                <>
                  <Camera size={22} className="mx-auto text-slate-400" />
                  <p className="text-xs text-slate-500 mt-1.5">Ambil / unggah foto masalah (opsional)</p>
                </>
              )}
            </label>
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={busy}><Send size={15} /> Kirim ke Pengurus</Button>
          <p className="text-[11px] text-slate-400 text-center">Laporan darurat juga muncul di aplikasi satpam untuk respons cepat.</p>
        </form>
      </Modal>

      {/* Modal detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.complaint.title : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">{detail.complaint.code}</span>
              {complaintStatusBadge(detail.complaint.status)}
              {priorityBadge(detail.complaint.priority)}
              <span className="text-xs text-slate-400">{detail.complaint.category}</span>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.complaint.description || '—'}</p>
            {detail.complaint.photo_path && (
              <img src={detail.complaint.photo_path} alt="" className="rounded-xl max-h-52 w-full object-cover" />
            )}
            <div className="text-xs text-slate-400 space-y-1">
              {detail.complaint.location_text && <p className="flex items-center gap-1"><MapPin size={12} /> {detail.complaint.location_text}</p>}
              <p>Dilaporkan {fmtDateTime(detail.complaint.created_at)}</p>
              {detail.complaint.assignee_name && <p>Penanggung jawab: <b>{detail.complaint.assignee_name}</b></p>}
              {detail.complaint.resolved_at && <p className="text-emerald-700">✔ Selesai {fmtDateTime(detail.complaint.resolved_at)}</p>}
            </div>

            {/* Alur status */}
            <div className="flex items-center gap-1">
              {['menunggu', 'diproses', 'selesai'].map((s, i, arr) => {
                const idx = arr.indexOf(detail.complaint.status);
                const done = idx >= i && detail.complaint.status !== 'ditolak';
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                        done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400')}>{i + 1}</div>
                      <span className={clsx('text-[10px] mt-1 capitalize', done ? 'text-emerald-700 font-semibold' : 'text-slate-400')}>{s}</span>
                    </div>
                    {i < arr.length - 1 && <div className={clsx('flex-1 h-0.5 mx-1 mb-4', idx > i ? 'bg-emerald-600' : 'bg-slate-200')} />}
                  </div>
                );
              })}
              {detail.complaint.status === 'ditolak' && <span className="ml-auto text-xs text-rose-600 font-semibold">Ditolak</span>}
            </div>

            <div>
              <p className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-1.5"><MessageCircle size={14} /> Komunikasi</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detail.comments.map((cm) => (
                  <div key={cm.id} className={clsx('rounded-xl p-2.5 text-sm',
                    cm.author_role === 'warga' ? 'bg-slate-100' : 'bg-emerald-50 border border-emerald-100')}>
                    <p className="text-[11px] font-semibold text-slate-500">{cm.author_name} · {dayjs(cm.created_at.replace(' ', 'T')).fromNow()}</p>
                    <p className="text-slate-600 mt-0.5">{cm.message}</p>
                  </div>
                ))}
                {detail.comments.length === 0 && <p className="text-xs text-slate-400">Belum ada balasan dari pengurus.</p>}
              </div>
              <form onSubmit={addComment} className="flex gap-2 mt-3">
                <Input placeholder="Tulis pesan tambahan..." value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button type="submit" size="sm" loading={busy}><Send size={14} /></Button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
