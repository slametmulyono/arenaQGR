import { useEffect, useState, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Bell, Megaphone, ReceiptText, QrCode, Wrench, Wallet, Info, CheckCheck } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { clsx } from 'clsx';
import { api, errMsg } from '../../api.js';
import { Card, Button, LoadingBlock, EmptyState, ErrorNote, Badge } from '../../components/ui.jsx';

dayjs.extend(relativeTime);

const TYPE_META = {
  announcement: { icon: Megaphone, cls: 'bg-violet-100 text-violet-700', link: null },
  billing: { icon: ReceiptText, cls: 'bg-emerald-100 text-emerald-700', link: '/m/bills' },
  guest: { icon: QrCode, cls: 'bg-sky-100 text-sky-700', link: '/m/guests' },
  complaint: { icon: Wrench, cls: 'bg-amber-100 text-amber-700', link: '/m/complaints' },
  finance: { icon: Wallet, cls: 'bg-teal-100 text-teal-700', link: null },
  info: { icon: Info, cls: 'bg-slate-100 text-slate-500', link: null },
};

export default function WargaNotifications() {
  const [notifs, setNotifs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('notif');
  const { refreshUnread } = useOutletContext() || {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, a] = await Promise.all([api.get('/notifications'), api.get('/announcements')]);
      setNotifs(n.data.notifications);
      setAnnouncements(a.data.announcements);
      setError('');
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markAll() {
    try {
      await api.put('/notifications/read-all');
      setNotifs((n) => n.map((x) => ({ ...x, is_read: 1 })));
      refreshUnread?.();
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Notifikasi & Pengumuman</h1>
          <p className="text-xs text-slate-500 mt-0.5">Push notification sistem & edaran resmi pengurus.</p>
        </div>
        <Button size="sm" variant="secondary" className="ml-auto shrink-0" onClick={markAll}>
          <CheckCheck size={14} /> Baca semua
        </Button>
      </div>

      <div className="flex gap-2">
        {[['notif', `Notifikasi (${notifs.filter((n) => !n.is_read).length} baru)`], ['pengumuman', `Edaran (${announcements.length})`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${tab === k ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loading ? <LoadingBlock /> : tab === 'notif' ? (
        notifs.length === 0 ? (
          <Card><EmptyState icon={Bell} title="Tidak ada notifikasi" subtitle="Kabar terbaru dari sistem akan muncul di sini." /></Card>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.info;
              const Icon = meta.icon;
              const inner = (
                <div className={clsx('p-3.5 flex gap-3 rounded-xl border transition-colors',
                  n.is_read ? 'bg-white border-slate-100' : 'bg-emerald-50/70 border-emerald-200')}>
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', meta.cls)}><Icon size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-semibold text-slate-700 leading-snug flex-1">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{n.body}</p>}
                    <p className="text-[10px] text-slate-400 mt-1.5">{dayjs(n.created_at.replace(' ', 'T')).fromNow()}{n.is_broadcast ? ' · broadcast' : ''}</p>
                  </div>
                </div>
              );
              return meta.link
                ? <Link key={n.id} to={meta.link}>{inner}</Link>
                : <div key={n.id}>{inner}</div>;
            })}
          </div>
        )
      ) : (
        announcements.length === 0 ? (
          <Card><EmptyState icon={Megaphone} title="Belum ada edaran" subtitle="Pengumuman resmi pengurus akan tampil di sini." /></Card>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color="violet" className="capitalize">{a.category}</Badge>
                  <span className="text-[10px] text-slate-400">{dayjs(a.published_at.replace(' ', 'T')).format('D MMM YYYY HH:mm')} · {a.author_name}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-sm mt-2 leading-snug">{a.title}</h3>
                <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{a.body}</p>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
