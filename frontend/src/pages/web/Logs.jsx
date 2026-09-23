import { useEffect, useState, useCallback } from 'react';
import { Search, ScrollText, Radio } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { api, errMsg } from '../../api.js';
import { Card, CardHeader, Input, Badge, LoadingBlock, EmptyState, ErrorNote, fmtDateTime } from '../../components/ui.jsx';

dayjs.extend(relativeTime);

const ACTION_COLORS = {
  LOGIN: 'green', LOGIN_FAILED: 'red', LOGOUT: 'slate',
  CREATE_PAYMENT: 'blue', VERIFY_PAYMENT: 'green', REJECT_PAYMENT: 'red',
  GUEST_CHECKIN: 'blue', GUEST_CHECKOUT: 'purple', GUEST_MANUAL_ENTRY: 'amber',
  CREATE_COMPLAINT: 'amber', UPDATE_COMPLAINT_STATUS: 'blue',
  CREATE_ANNOUNCEMENT: 'violet', GENERATE_BILLS: 'teal',
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('audit');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = q ? { q } : {};
      const [l, e] = await Promise.all([api.get('/logs', { params }), api.get('/logs/events').catch(() => ({ data: { events: [] } }))]);
      setLogs(l.data.logs);
      setEvents(e.data.events || []);
      setError('');
    } catch (err) { setError(errMsg(err)); } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Log Aktivitas Sistem</h1>
        <p className="text-sm text-slate-500">Audit trail seluruh aksi pengguna & jejak event bus (arsitektur event-driven).</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'audit' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          <ScrollText size={14} className="inline mr-1.5" />Audit Log ({logs.length})
        </button>
        <button onClick={() => setTab('events')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'events' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          <Radio size={14} className="inline mr-1.5" />Event Bus ({events.length})
        </button>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {tab === 'audit' ? (
        <Card className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Cari aksi / user / entitas..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {loading ? <LoadingBlock /> : logs.length === 0 ? <EmptyState icon={ScrollText} title="Log kosong" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3">Waktu</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Aksi</th>
                    <th className="py-2 pr-3">Entitas</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60">
                      <td className="py-2 pr-3 text-xs text-slate-400 whitespace-nowrap">
                        {fmtDateTime(l.created_at)}<br />{dayjs(l.created_at.replace(' ', 'T')).fromNow()}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{l.username || 'system'}</td>
                      <td className="py-2 pr-3">
                        <Badge color={ACTION_COLORS[l.action] || 'slate'}>{l.action}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{l.entity || '—'}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                      <td className="py-2 text-xs text-slate-400 max-w-[320px] truncate font-mono">{l.details || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Jejak Message Bus" subtitle="50 event terakhir yang diproses worker async (notifikasi, webhook gateway, scheduler)" />
          <div className="px-5 pb-5">
            {events.length === 0 ? <EmptyState icon={Radio} title="Belum ada event" subtitle="Event muncul saat ada aktivitas pembayaran, tamu, pengaduan, dll." /> : (
              <div className="space-y-1.5 font-mono text-xs">
                {events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-400 shrink-0">{dayjs(ev.at).format('HH:mm:ss')}</span>
                    <Badge color="blue">{ev.topic}</Badge>
                    <span className="text-slate-500 truncate">{JSON.stringify(ev.payload).slice(0, 110)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
