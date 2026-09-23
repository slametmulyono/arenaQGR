import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, KeyRound, UserCog } from 'lucide-react';
import { api, errMsg } from '../../api.js';
import {
  Card, Button, Input, Select, Field, Modal, Badge, LoadingBlock, EmptyState, ErrorNote, fmtDate,
} from '../../components/ui.jsx';

const ROLES = {
  super_admin: { label: 'Super Admin', badge: <Badge color="purple">Super Admin</Badge> },
  pengurus: { label: 'Pengurus', badge: <Badge color="blue">Pengurus</Badge> },
  warga: { label: 'Warga', badge: <Badge color="green">Warga</Badge> },
  satpam: { label: 'Satpam', badge: <Badge color="amber">Satpam</Badge> },
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetPw, setResetPw] = useState(null);
  const [pw, setPw] = useState('');
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'warga', phone: '', house_id: '', position: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (role) params.role = role;
      const { data } = await api.get('/users', { params });
      setUsers(data.users);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [q, role]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/housing/houses').then(({ data }) => setHouses(data.houses)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, house_id: form.house_id ? Number(form.house_id) : null };
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      setShowNew(false); setEditing(null);
      setForm({ username: '', password: '', name: '', role: 'warga', phone: '', house_id: '', position: '' });
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function toggleActive(u) {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      load();
    } catch (e) { setError(errMsg(e)); }
  }

  async function doReset(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/users/${resetPw.id}/reset-password`, { password: pw });
      setResetPw(null); setPw('');
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen User & Hak Akses</h1>
          <p className="text-sm text-slate-500">RBAC: Super Admin, Pengurus/Bendahara, Warga, dan Satpam.</p>
        </div>
        <Button className="ml-auto" onClick={() => { setEditing(null); setShowNew(true); }}><Plus size={15} /> User Baru</Button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari nama / username..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-48">
            <option value="">Semua Peran</option>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>

        {loading ? <LoadingBlock /> : users.length === 0 ? <EmptyState icon={UserCog} title="Tidak ada user" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Nama</th>
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Peran</th>
                  <th className="py-2 pr-3">Rumah</th>
                  <th className="py-2 pr-3">Kontak</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                          {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{u.name}</p>
                          {u.position && <p className="text-[11px] text-slate-400">{u.position}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{u.username}</td>
                    <td className="py-2.5 pr-3">{ROLES[u.role]?.badge}</td>
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">
                      {u.block_name ? `Blok ${u.block_name} No. ${u.house_number}` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{u.phone || '—'}</td>
                    <td className="py-2.5 pr-3">
                      {u.is_active ? <Badge color="green">Aktif</Badge> : <Badge color="red">Nonaktif</Badge>}
                      <p className="text-[10px] text-slate-300 mt-0.5">{fmtDate(u.created_at)}</p>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button title="Ubah" onClick={() => {
                        setEditing(u);
                        setForm({ username: u.username, password: '', name: u.name, role: u.role, phone: u.phone || '', house_id: u.house_id || '', position: u.position || '' });
                        setShowNew(true);
                      }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><UserCog size={15} /></button>
                      <button title="Reset password" onClick={() => setResetPw(u)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><KeyRound size={15} /></button>
                      <button title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => toggleActive(u)}
                        className={`ml-1 text-[11px] font-medium ${u.is_active ? 'text-rose-600' : 'text-emerald-700'} hover:underline`}>
                        {u.is_active ? 'nonaktifkan' : 'aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal user baru/edit */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setEditing(null); }} title={editing ? `Ubah User — ${editing.name}` : 'Buat User Baru'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" required>
              <Input value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </Field>
            {!editing && (
              <Field label="Password Awal" required>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </Field>
            )}
          </div>
          <Field label="Nama Lengkap" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peran" required>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            <Field label="No. Telepon"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          {form.role === 'warga' && (
            <Field label="Rumah (untuk akun warga)">
              <Select value={form.house_id} onChange={(e) => setForm({ ...form, house_id: e.target.value })}>
                <option value="">— pilih rumah —</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>Blok {h.block_name} No. {h.number}{h.occupant_name ? ` (${h.occupant_name})` : ''}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Jabatan / Keterangan"><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="mis. Bendahara, Ketua RT 007" /></Field>
          <Button type="submit" className="w-full" loading={busy}>{editing ? 'Simpan Perubahan' : 'Buat User'}</Button>
        </form>
      </Modal>

      {/* Modal reset password */}
      <Modal open={!!resetPw} onClose={() => setResetPw(null)} title={`Reset Password — ${resetPw?.name || ''}`}>
        <form onSubmit={doReset} className="space-y-4">
          <Field label="Password Baru" required>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required placeholder="minimal 6 karakter" />
          </Field>
          <Button type="submit" className="w-full" variant="amber" loading={busy}>Reset Password</Button>
        </form>
      </Modal>
    </div>
  );
}
