import { useEffect, useState, useCallback } from 'react';
import { Search, MessageSquareWarning, Send, MapPin, Phone, UserCheck } from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Textarea, Modal, LoadingBlock, EmptyState, ErrorNote,
  complaintStatusBadge, priorityBadge, fmtDateTime, Field,
} from '../../components/ui.jsx';

dayjs.extend(relativeTime);

const STATUSES = ['menunggu', 'diproses', 'selesai', 'ditolak'];

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null); // {complaint, comments}
  const [comment, setComment] = useState('');
  const [wf, setWf] = useState({ status: '', assigned_to: '', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const { data } = await api.get('/complaints', { params });
      setComplaints(data.complaints);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [status, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/users/staff-options').then(({ data }) => setStaff(data.users)).catch(() => {}); }, []);

  async function openDetail(id) {
    setOpenId(id);
    const { data } = await api.get(`/complaints/${id}`);
    setDetail(data);
    setWf({ status: data.complaint.status, assigned_to: data.complaint.assigned_to || '', message: '' });
  }

  async function refreshDetail() {
    if (!openId) return;
    const { data } = await api.get(`/complaints/${openId}`);
    setDetail(data);
    load();
  }

  async function saveWorkflow(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/complaints/${openId}/status`, {
        status: wf.status || undefined,
        assigned_to: wf.assigned_to ? Number(wf.assigned_to) : null,
        message: wf.message || undefined,
      });
      setWf({ ...wf, message: '' });
      refreshDetail();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api.post(`/complaints/${openId}/comments`, { message: comment });
      setComment('');
      refreshDetail();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  const counts = complaints.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaduan & Layanan Warga</h1>
        <p className="text-sm text-slate-500">Kelola alur resolusi tiket: tunggu → proses (tugaskan penanggung jawab) → selesai.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? '' : s)} className="text-left">
            <Card className={clsx('p-3 flex items-center justify-between transition-colors', status === s && 'ring-2 ring-emerald-600')}>
              <span className="text-slate-500 text-xs font-medium capitalize">{s}</span>
              <span className="font-bold text-slate-700">{counts[s] || 0}</span>
            </Card>
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari judul / kode tiket..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">Semua Status</option>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </Select>
        </div>

        {loading ? <LoadingBlock /> : complaints.length === 0 ? (
          <EmptyState icon={MessageSquareWarning} title="Tidak ada pengaduan" subtitle="Semua keluhan warga akan tampil di sini." />
        ) : (
          <div className="space-y-2.5">
            {complaints.map((c) => (
              <button key={c.id} onClick={() => openDetail(c.id)}
                className="w-full text-left rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors p-4 flex flex-wrap items-center gap-3">
                <div className={clsx('w-2 self-stretch rounded-full min-h-[40px]',
                  c.priority === 'darurat' ? 'bg-rose-500' : c.priority === 'tinggi' ? 'bg-amber-400' : 'bg-slate-200')} />
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-slate-700 text-sm">{c.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="font-mono">{c.code}</span> · {c.reporter_name}
                    {c.block_name && ` (Blok ${c.block_name} No. ${c.house_number})`} · {dayjs(c.created_at.replace(' ', 'T')).fromNow()}
                  </p>
                </div>
                <span className="hidden md:block text-xs text-slate-500">{c.category}</span>
                {priorityBadge(c.priority)}
                {complaintStatusBadge(c.status)}
                {c.assignee_name && <span className="hidden lg:inline text-xs text-slate-500">PIC: {c.assignee_name}</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => { setDetail(null); setOpenId(null); }} title={detail ? `Tiket ${detail.complaint.code}` : ''} wide>
        {detail && (
          <div className="grid md:grid-cols-5 gap-5">
            {/* Info */}
            <div className="md:col-span-3 space-y-4">
              <div>
                <h4 className="font-bold text-slate-800">{detail.complaint.title}</h4>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {complaintStatusBadge(detail.complaint.status)}
                  {priorityBadge(detail.complaint.priority)}
                  <span className="text-xs text-slate-400">{detail.complaint.category}</span>
                </div>
                <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{detail.complaint.description || '—'}</p>
              </div>

              <div className="text-xs text-slate-500 space-y-1.5 rounded-lg bg-slate-50 p-3">
                <p className="flex items-center gap-1.5"><UserCheck size={13} /> Pelapor: <b>{detail.complaint.reporter_name}</b> {detail.complaint.reporter_phone && <a className="text-emerald-700 flex items-center gap-0.5" href={`tel:${detail.complaint.reporter_phone}`}><Phone size={11} />{detail.complaint.reporter_phone}</a>}</p>
                {detail.complaint.block_name && <p className="flex items-center gap-1.5"><MessageSquareWarning size={13} /> Rumah: Blok {detail.complaint.block_name} No. {detail.complaint.house_number}</p>}
                {detail.complaint.location_text && <p className="flex items-center gap-1.5"><MapPin size={13} /> Lokasi: {detail.complaint.location_text}
                  {detail.complaint.lat && <a className="text-emerald-700 hover:underline ml-1" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${detail.complaint.lat}&mlon=${detail.complaint.lng}#map=18/${detail.complaint.lat}/${detail.complaint.lng}`}>(peta)</a>}
                </p>}
                <p>Dibuat: {fmtDateTime(detail.complaint.created_at)}{detail.complaint.resolved_at && ` · Selesai: ${fmtDateTime(detail.complaint.resolved_at)}`}</p>
              </div>

              {detail.complaint.photo_path && (
                <a href={detail.complaint.photo_path} target="_blank" rel="noreferrer">
                  <img src={detail.complaint.photo_path} alt="Foto pengaduan" className="rounded-xl border border-slate-200 max-h-64 object-cover" />
                </a>
              )}

              {/* Timeline komentar */}
              <div>
                <p className="font-semibold text-sm text-slate-700 mb-2">Timeline Penanganan</p>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {detail.comments.map((cm) => (
                    <div key={cm.id} className={clsx('rounded-lg p-2.5 text-sm',
                      cm.author_role === 'warga' ? 'bg-slate-50' : 'bg-emerald-50 border border-emerald-100')}>
                      <p className="text-xs font-semibold text-slate-600">{cm.author_name}
                        <span className="font-normal text-slate-400 ml-1.5">{dayjs(cm.created_at.replace(' ', 'T')).fromNow()}</span>
                      </p>
                      <p className="text-slate-600 mt-0.5">{cm.message}</p>
                    </div>
                  ))}
                  {detail.comments.length === 0 && <p className="text-xs text-slate-400">Belum ada komunikasi pada tiket ini.</p>}
                </div>
                <form onSubmit={addComment} className="flex gap-2 mt-3">
                  <Input placeholder="Tulis balasan / catatan penanganan..." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button type="submit" size="sm" loading={busy}><Send size={14} /></Button>
                </form>
              </div>
            </div>

            {/* Workflow */}
            <div className="md:col-span-2">
              <form onSubmit={saveWorkflow} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/60 sticky top-0">
                <p className="font-semibold text-sm text-slate-700">Alur Resolusi</p>
                <Field label="Status">
                  <Select value={wf.status} onChange={(e) => setWf({ ...wf, status: e.target.value })}>
                    <option value="menunggu">Menunggu</option>
                    <option value="diproses">Diproses</option>
                    <option value="selesai">Selesai</option>
                    <option value="ditolak">Ditolak</option>
                  </Select>
                </Field>
                <Field label="Tugaskan ke">
                  <Select value={wf.assigned_to || ''} onChange={(e) => setWf({ ...wf, assigned_to: e.target.value })}>
                    <option value="">— belum ditugaskan —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role === 'pengurus' ? 'Pengurus' : s.role === 'satpam' ? 'Satpam' : s.position || 'Warga'})</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catatan tindakan">
                  <Textarea rows={3} placeholder="mis. Teknisi dijadwalkan datang besok pagi..." value={wf.message} onChange={(e) => setWf({ ...wf, message: e.target.value })} />
                </Field>
                <Button type="submit" className="w-full" loading={busy}>Perbarui Tiket</Button>
                <p className="text-[11px] text-slate-400">Perubahan status & tugas otomatis mengirim notifikasi ke warga pelapor.</p>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


