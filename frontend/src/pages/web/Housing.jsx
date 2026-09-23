import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Home as HomeIcon, Pencil, UserPlus, History } from 'lucide-react';
import { api, rupiah, errMsg } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import {
  Card, Button, Input, Select, Field, Modal, Badge, LoadingBlock, EmptyState, ErrorNote, fmtDate,
} from '../../components/ui.jsx';

const STATUS = {
  ditempati: <Badge color="green">Ditempati</Badge>,
  kosong: <Badge color="slate">Kosong</Badge>,
  perbaikan: <Badge color="amber">Perbaikan</Badge>,
};
const REL = { pemilik: <Badge color="blue">Pemilik</Badge>, penyewa: <Badge color="purple">Penyewa</Badge>, anggota: <Badge color="slate">Anggota</Badge> };

export default function Housing() {
  const { user } = useAuth();
  const isAdmin = user.role === 'super_admin';
  const [blocks, setBlocks] = useState([]);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [error, setError] = useState('');

  // modals
  const [detail, setDetail] = useState(null); // {house, occupants, bills}
  const [editHouse, setEditHouse] = useState(null);
  const [newBlock, setNewBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ name: '', cluster: '' });
  const [newHouse, setNewHouse] = useState(false);
  const [houseForm, setHouseForm] = useState({
    block_id: '', number: '', house_type: 'Tipe 45/90', status: 'kosong',
    ipl_rate: 150000, kebersihan_rate: 50000, keamanan_rate: 75000,
  });
  const [addOcc, setAddOcc] = useState(null); // house
  const [occForm, setOccForm] = useState({ name: '', phone: '', relation: 'pemilik' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (fBlock) params.block = fBlock;
      if (fStatus) params.status = fStatus;
      const [b, h] = await Promise.all([api.get('/housing/blocks'), api.get('/housing/houses', { params })]);
      setBlocks(b.data.blocks);
      setHouses(h.data.houses);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [q, fBlock, fStatus]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(id) {
    const { data } = await api.get(`/housing/houses/${id}`);
    setDetail(data);
  }

  async function saveBlock(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/housing/blocks', blockForm);
      setNewBlock(false); setBlockForm({ name: '', cluster: '' }); load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function createHouse(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/housing/houses', houseForm);
      setNewHouse(false);
      setHouseForm({ block_id: '', number: '', house_type: 'Tipe 45/90', status: 'kosong', ipl_rate: 150000, kebersihan_rate: 50000, keamanan_rate: 75000 });
      load();
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  async function saveHouse(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/housing/houses/${editHouse.id}`, editHouse);
      setEditHouse(null); load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function saveOccupant(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/housing/houses/${addOcc.id}/occupants`, occForm);
      setAddOcc(null); setOccForm({ name: '', phone: '', relation: 'pemilik' }); load();
      if (detail?.house?.id === addOcc.id) openDetail(addOcc.id);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function endOccupant(occ) {
    if (!confirm(`Akhiri masa huni ${occ.name}?`)) return;
    await api.put(`/housing/occupants/${occ.id}/end`);
    openDetail(detail.house.id); load();
  }

  const stats = houses.reduce((a, h) => {
    a[h.status] = (a[h.status] || 0) + 1;
    a.outstanding += h.outstanding || 0;
    return a;
  }, { outstanding: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Master Hunian</h1>
          <p className="text-sm text-slate-500">Blok, rumah, status hunian, dan riwayat penghuni.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setNewBlock(true)}><Plus size={15} /> Blok</Button>
              <Button onClick={() => setNewHouse(true)}><Plus size={15} /> Rumah</Button>
            </>
          )}
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card className="p-3 text-center"><p className="text-slate-400 text-xs">Ditempati</p><p className="font-bold text-emerald-700 text-lg">{stats.ditempati || 0}</p></Card>
        <Card className="p-3 text-center"><p className="text-slate-400 text-xs">Kosong</p><p className="font-bold text-slate-600 text-lg">{stats.kosong || 0}</p></Card>
        <Card className="p-3 text-center"><p className="text-slate-400 text-xs">Perbaikan</p><p className="font-bold text-amber-600 text-lg">{stats.perbaikan || 0}</p></Card>
        <Card className="p-3 text-center"><p className="text-slate-400 text-xs">Tunggakan (filter ini)</p><p className="font-bold text-rose-600 text-lg">{rupiah(stats.outstanding)}</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari nomor rumah / blok..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={fBlock} onChange={(e) => setFBlock(e.target.value)} className="w-40">
            <option value="">Semua Blok</option>
            {blocks.map((b) => <option key={b.id} value={b.name}>Blok {b.name}</option>)}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-44">
            <option value="">Semua Status</option>
            <option value="ditempati">Ditempati</option>
            <option value="kosong">Kosong</option>
            <option value="perbaikan">Perbaikan</option>
          </Select>
        </div>

        {loading ? <LoadingBlock /> : houses.length === 0 ? (
          <EmptyState icon={HomeIcon} title="Tidak ada rumah" subtitle="Coba ubah filter pencarian." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Alamat</th>
                  <th className="py-2 pr-3">Tipe</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Penghuni Aktif</th>
                  <th className="py-2 pr-3 text-right">Iuran/Bulan</th>
                  <th className="py-2 pr-3 text-right">Tunggakan</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {houses.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3">
                      <button onClick={() => openDetail(h.id)} className="font-semibold text-emerald-800 hover:underline text-left">
                        Blok {h.block_name} No. {h.number}
                      </button>
                      <p className="text-[11px] text-slate-400">{h.house_type} · LT {h.land_area} / LB {h.building_area}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{h.house_type}</td>
                    <td className="py-2.5 pr-3">{STATUS[h.status]}</td>
                    <td className="py-2.5 pr-3">
                      {h.occupant_name ? (
                        <span className="text-slate-600">{h.occupant_name} {REL[h.occupant_relation]}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-slate-600">{rupiah(h.ipl_rate + h.kebersihan_rate + h.keamanan_rate)}</td>
                    <td className={`py-2.5 pr-3 text-right font-medium ${h.outstanding > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {h.outstanding > 0 ? rupiah(h.outstanding) : '—'}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openDetail(h.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Detail & riwayat"><History size={15} /></button>
                      <button onClick={() => setAddOcc(h)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700" title="Tambah penghuni"><UserPlus size={15} /></button>
                      {isAdmin && <button onClick={() => setEditHouse({ ...h })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Ubah"><Pencil size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: detail rumah */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Blok ${detail.house.block_name} No. ${detail.house.number}` : ''} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Status</p>{STATUS[detail.house.status]}</div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Tipe</p><p className="font-medium">{detail.house.house_type}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Iuran/bulan</p><p className="font-medium">{rupiah(detail.house.ipl_rate + detail.house.kebersihan_rate + detail.house.keamanan_rate)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Rincian</p><p className="text-xs">IPL {rupiah(detail.house.ipl_rate)}<br />Kebersihan {rupiah(detail.house.kebersihan_rate)}<br />Keamanan {rupiah(detail.house.keamanan_rate)}</p></div>
            </div>

            <div>
              <p className="font-semibold text-sm text-slate-700 mb-2">Riwayat Penghuni</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100"><th className="py-1.5 pr-3">Nama</th><th className="py-1.5 pr-3">Relasi</th><th className="py-1.5 pr-3">Periode</th><th className="py-1.5 pr-3">Kontak</th><th className="py-1.5" /></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.occupants.map((o) => (
                    <tr key={o.id} className={o.is_active ? '' : 'opacity-50'}>
                      <td className="py-2 pr-3 font-medium">{o.name}</td>
                      <td className="py-2 pr-3">{REL[o.relation]}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{fmtDate(o.start_date)} — {o.end_date ? fmtDate(o.end_date) : o.is_active ? 'sekarang' : '—'}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{o.phone || '—'}</td>
                      <td className="py-2 text-right">
                        {o.is_active ? (
                          <>
                            <Badge color={o.is_active ? 'green' : 'slate'}>{o.is_active ? 'Aktif' : 'Pindah'}</Badge>
                            <button onClick={() => endOccupant(o)} className="ml-2 text-[11px] text-rose-600 hover:underline">akhiri</button>
                          </>
                        ) : <Badge color="slate">Pindah</Badge>}
                      </td>
                    </tr>
                  ))}
                  {detail.occupants.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400 text-sm">Belum ada data penghuni.</td></tr>}
                </tbody>
              </table>
            </div>

            <div>
              <p className="font-semibold text-sm text-slate-700 mb-2">Riwayat Tagihan (12 terakhir)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {detail.bills.map((b) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 p-2.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{b.period}</span>
                    <span className="text-slate-500">{rupiah(b.total)}</span>
                    <span>{({ paid: <Badge color="green">Lunas</Badge>, unpaid: <Badge color="amber">Belum</Badge>, overdue: <Badge color="red">Telat</Badge>, void: <Badge>Dibatalkan</Badge> })[b.status]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: blok baru */}
      <Modal open={newBlock} onClose={() => setNewBlock(false)} title="Tambah Blok Baru">
        <form onSubmit={saveBlock} className="space-y-4">
          <Field label="Nama Blok" required><Input value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} placeholder="F" required /></Field>
          <Field label="Cluster"><Input value={blockForm.cluster} onChange={(e) => setBlockForm({ ...blockForm, cluster: e.target.value })} placeholder="Cluster Anggrek" /></Field>
          <Button type="submit" className="w-full" loading={busy}>Simpan Blok</Button>
        </form>
      </Modal>

      {/* Modal: rumah baru */}
      <Modal open={newHouse} onClose={() => setNewHouse(false)} title="Tambah Rumah Baru">
        <form onSubmit={createHouse} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Blok" required>
              <Select value={houseForm.block_id} onChange={(e) => setHouseForm({ ...houseForm, block_id: e.target.value })} required>
                <option value="">— pilih blok —</option>
                {blocks.map((b) => <option key={b.id} value={b.id}>Blok {b.name}</option>)}
              </Select>
            </Field>
            <Field label="Nomor Rumah" required>
              <Input value={houseForm.number} onChange={(e) => setHouseForm({ ...houseForm, number: e.target.value })} placeholder="01" required />
            </Field>
            <Field label="Tipe">
              <Input value={houseForm.house_type} onChange={(e) => setHouseForm({ ...houseForm, house_type: e.target.value })} />
            </Field>
            <Field label="Status Awal">
              <Select value={houseForm.status} onChange={(e) => setHouseForm({ ...houseForm, status: e.target.value })}>
                <option value="kosong">Kosong</option>
                <option value="ditempati">Ditempati</option>
                <option value="perbaikan">Dalam Perbaikan</option>
              </Select>
            </Field>
            <Field label="Tarif IPL (Rp)"><Input type="number" value={houseForm.ipl_rate} onChange={(e) => setHouseForm({ ...houseForm, ipl_rate: Number(e.target.value) })} /></Field>
            <Field label="Kebersihan (Rp)"><Input type="number" value={houseForm.kebersihan_rate} onChange={(e) => setHouseForm({ ...houseForm, kebersihan_rate: Number(e.target.value) })} /></Field>
            <Field label="Keamanan (Rp)"><Input type="number" value={houseForm.keamanan_rate} onChange={(e) => setHouseForm({ ...houseForm, keamanan_rate: Number(e.target.value) })} /></Field>
          </div>
          <Button type="submit" className="w-full" loading={busy}>Simpan Rumah</Button>
        </form>
      </Modal>

      {/* Modal: edit rumah */}
      <Modal open={!!editHouse} onClose={() => setEditHouse(null)} title={editHouse ? `Ubah Blok ${editHouse.block_name} No. ${editHouse.number}` : ''}>
        {editHouse && (
          <form onSubmit={saveHouse} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status Hunian">
                <Select value={editHouse.status} onChange={(e) => setEditHouse({ ...editHouse, status: e.target.value })}>
                  <option value="ditempati">Ditempati</option>
                  <option value="kosong">Kosong</option>
                  <option value="perbaikan">Dalam Perbaikan</option>
                </Select>
              </Field>
              <Field label="Tipe Rumah"><Input value={editHouse.house_type || ''} onChange={(e) => setEditHouse({ ...editHouse, house_type: e.target.value })} /></Field>
              <Field label="Tarif IPL (Rp)"><Input type="number" value={editHouse.ipl_rate} onChange={(e) => setEditHouse({ ...editHouse, ipl_rate: Number(e.target.value) })} /></Field>
              <Field label="Kebersihan (Rp)"><Input type="number" value={editHouse.kebersihan_rate} onChange={(e) => setEditHouse({ ...editHouse, kebersihan_rate: Number(e.target.value) })} /></Field>
              <Field label="Keamanan (Rp)"><Input type="number" value={editHouse.keamanan_rate} onChange={(e) => setEditHouse({ ...editHouse, keamanan_rate: Number(e.target.value) })} /></Field>
              <Field label="Luas Tanah (m²)"><Input type="number" value={editHouse.land_area || ''} onChange={(e) => setEditHouse({ ...editHouse, land_area: Number(e.target.value) })} /></Field>
            </div>
            <Button type="submit" className="w-full" loading={busy}>Simpan Perubahan</Button>
          </form>
        )}
      </Modal>

      {/* Modal: tambah penghuni */}
      <Modal open={!!addOcc} onClose={() => setAddOcc(null)} title={addOcc ? `Tambah Penghuni — Blok ${addOcc.block_name} No. ${addOcc.number}` : ''}>
        <form onSubmit={saveOccupant} className="space-y-4">
          <Field label="Nama Lengkap" required><Input value={occForm.name} onChange={(e) => setOccForm({ ...occForm, name: e.target.value })} required /></Field>
          <Field label="No. Telepon"><Input value={occForm.phone} onChange={(e) => setOccForm({ ...occForm, phone: e.target.value })} placeholder="08xx xxxx xxxx" /></Field>
          <Field label="Status Huni">
            <Select value={occForm.relation} onChange={(e) => setOccForm({ ...occForm, relation: e.target.value })}>
              <option value="pemilik">Pemilik</option>
              <option value="penyewa">Penyewa</option>
              <option value="anggota">Anggota Keluarga</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={busy}>Simpan Penghuni</Button>
        </form>
      </Modal>
    </div>
  );
}
