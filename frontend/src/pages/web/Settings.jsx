import { useEffect, useState } from 'react';
import { Settings, ServerCog, ShieldCheck, Database } from 'lucide-react';
import { api, errMsg } from '../../api.js';
import { Card, CardHeader, Button, Input, Field, ErrorNote } from '../../components/ui.jsx';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setSettings(data.settings)).catch((e) => setError(errMsg(e)));
    api.get('/health').catch(() => {});
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setOk(''); setError('');
    try {
      await api.put('/settings', settings);
      setOk('Pengaturan berhasil disimpan.');
      setTimeout(() => setOk(''), 3000);
    } catch (e2) { setError(errMsg(e2)); } finally { setBusy(false); }
  }

  if (!settings) return <ErrorNote>{error || 'Memuat pengaturan...'}</ErrorNote>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pengaturan Sistem</h1>
        <p className="text-sm text-slate-500">Konfigurasi global QGR Smart System (khusus Super Admin).</p>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {ok && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{ok}</div>}

      <Card>
        <CardHeader title="Identitas & Operasional" subtitle="dipakai di seluruh aplikasi (dashboard & mobile)" />
        <form onSubmit={save} className="px-5 pb-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nama Perumahan">
              <Input value={settings.estate_name || ''} onChange={(e) => setSettings({ ...settings, estate_name: e.target.value })} />
            </Field>
            <Field label="Nama Pos Gerbang">
              <Input value={settings.gate_name || ''} onChange={(e) => setSettings({ ...settings, gate_name: e.target.value })} />
            </Field>
            <Field label="Telepon Keamanan / Darurat">
              <Input value={settings.security_phone || ''} onChange={(e) => setSettings({ ...settings, security_phone: e.target.value })} />
            </Field>
            <Field label="Hari Jatuh Tempo Tagihan (tgl)">
              <Input type="number" min="1" max="28" value={settings.bill_due_day || '10'}
                onChange={(e) => setSettings({ ...settings, bill_due_day: e.target.value })} />
            </Field>
          </div>
          <CardHeader title="Tarif Default Iuran (Rp/bulan)" subtitle="dipakai saat menambah rumah baru" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="IPL">
              <Input type="number" value={settings.ipl_default_rate || ''} onChange={(e) => setSettings({ ...settings, ipl_default_rate: e.target.value })} />
            </Field>
            <Field label="Kebersihan">
              <Input type="number" value={settings.kebersihan_default_rate || ''} onChange={(e) => setSettings({ ...settings, kebersihan_default_rate: e.target.value })} />
            </Field>
            <Field label="Keamanan">
              <Input type="number" value={settings.keamanan_default_rate || ''} onChange={(e) => setSettings({ ...settings, keamanan_default_rate: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" loading={busy}><Settings size={15} /> Simpan Pengaturan</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Status Layanan API" subtitle="API-first: seluruh klien (web & mobile) memakai REST API yang sama" />
        <div className="px-5 pb-5 grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="flex items-center gap-2 text-slate-500 text-xs"><ServerCog size={14} /> Status</p>
            <p className="font-bold text-emerald-700 mt-1">{health?.status === 'ok' ? '● Online' : '○ Memeriksa...'}</p>
            <p className="text-[11px] text-slate-400 mt-1">uptime {Math.round((health?.uptime_sec || 0) / 60)} menit · v{health?.version}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="flex items-center gap-2 text-slate-500 text-xs"><ShieldCheck size={14} /> Keamanan</p>
            <p className="font-semibold text-slate-700 mt-1">JWT + RBAC aktif</p>
            <p className="text-[11px] text-slate-400 mt-1">Token kedaluwarsa 12 jam · bcrypt cost 10</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="flex items-center gap-2 text-slate-500 text-xs"><Database size={14} /> Penyimpanan</p>
            <p className="font-semibold text-slate-700 mt-1">SQLite (WAL) — dev</p>
            <p className="text-[11px] text-slate-400 mt-1">Skema kompatibel migrasi ke PostgreSQL (produksi)</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
