import { useEffect, useState, useCallback } from 'react';
import { Plus, Megaphone, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Textarea, Field, Modal, LoadingBlock, EmptyState, ErrorNote, Badge, fmtDateTime,
} from '../../components/ui.jsx';

dayjs.extend(relativeTime);

const CATEGORIES = ['umum', 'kegiatan', 'keamanan', 'keuangan', 'kesehatan', 'infrastruktur', 'darurat'];

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'umum', is_published: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/announcements');
      setItems(data.announcements);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await api.put(`/announcements/${editing.id}`, form);
      else await api.post('/announcements', form);
      setShowForm(false); setEditing(null);
      setForm({ title: '', body: '', category: 'umum', is_published: true });
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function togglePub(a) {
    try { await api.put(`/announcements/${a.id}`, { is_published: !a.is_published }); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  async function remove(a) {
    if (!confirm(`Hapus pengumuman "${a.title}"?`)) return;
    try { await api.delete(`/announcements/${a.id}`); load(); }
    catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pengumuman & Edaran</h1>
          <p className="text-sm text-slate-500">Publikasi memicu notifikasi push ke aplikasi mobile seluruh warga & satpam.</p>
        </div>
        <Button className="ml-auto" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={15} /> Buat Pengumuman
        </Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loading ? <LoadingBlock /> : items.length === 0 ? (
        <Card><EmptyState icon={Megaphone} title="Belum ada pengumuman" subtitle="Terbitkan edaran pertama untuk warga." /></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((a) => (
            <Card key={a.id} className="p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Megaphone size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800 leading-snug">{a.title}</h3>
                    {a.is_published ? <Badge color="green">Terbit</Badge> : <Badge color="amber">Draft</Badge>}
                    <Badge>{a.category}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.author_name} · {a.published_at ? dayjs(a.published_at.replace(' ', 'T')).fromNow() : 'belum dipublikasikan'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap line-clamp-4 flex-1">{a.body}</p>
              <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 mr-auto">{a.published_at && fmtDateTime(a.published_at)}</span>
                <button title={a.is_published ? 'Tarik dari publikasi' : 'Publikasikan'} onClick={() => togglePub(a)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  {a.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button title="Ubah" onClick={() => {
                  setEditing(a);
                  setForm({ title: a.title, body: a.body, category: a.category, is_published: !!a.is_published });
                  setShowForm(true);
                }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={15} /></button>
                <button title="Hapus" onClick={() => remove(a)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Ubah Pengumuman' : 'Buat Pengumuman Baru'} wide>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Judul" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="mis. Kerja Bakti Bersama — Minggu 07.00" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.is_published ? '1' : '0'} onChange={(e) => setForm({ ...form, is_published: e.target.value === '1' })}>
                <option value="1">Publikasikan sekarang (kirim push notif)</option>
                <option value="0">Simpan sebagai draft</option>
              </Select>
            </Field>
          </div>
          <Field label="Isi Edaran" required>
            <Textarea rows={7} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Tulis isi pengumuman lengkap..." required />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            {editing ? 'Simpan Perubahan' : form.is_published ? 'Terbitkan & Kirim Notifikasi' : 'Simpan Draft'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
