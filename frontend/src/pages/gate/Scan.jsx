import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, Camera, CameraOff, Keyboard, CheckCircle2, LogOut as ExitIcon, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { api, errMsg } from '../../api.js';
import { Button, Input, Card } from '../../components/ui.jsx';

const QR_PREFIX = 'QGR-GUEST:';

export default function GateScan() {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [result, setResult] = useState(null); // {result, houseLabel, visit}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ token: '', at: 0 });

  useEffect(() => () => stopScanner(), []);

  async function startScanner() {
    setError(''); setScanError('');
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decoded) => onDecode(decoded),
        () => {}
      );
      setScanning(true);
    } catch (e) {
      setScanError('Kamera tidak tersedia/ditolak di perangkat ini. Gunakan input kode manual di bawah.');
      setShowManual(true);
      scannerRef.current = null;
    }
  }

  function stopScanner() {
    const s = scannerRef.current;
    if (s) {
      s.stop().then(() => s.clear()).catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  }

  function onDecode(text) {
    const now = Date.now();
    if (lastScanRef.current.token === text && now - lastScanRef.current.at < 4000) return;
    lastScanRef.current = { token: text, at: now };
    submitToken(text);
    if (navigator.vibrate) navigator.vibrate(120);
  }

  async function submitToken(raw) {
    const token = String(raw).trim();
    if (!token) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const { data } = await api.post('/guests/scan', { token });
      setResult(data);
      setHistory((h) => [{ ...data, at: dayjs().format('HH:mm:ss') }, ...h].slice(0, 6));
      setManualToken('');
    } catch (e) {
      setError(errMsg(e));
      setHistory((h) => [{ result: 'error', message: errMsg(e), at: dayjs().format('HH:mm:ss') }, ...h].slice(0, 6));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Pemindaian QR Tamu</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Arahkan kamera ke QR undangan warga. Pindai pertama = <b className="text-emerald-400">masuk</b>, pindai lagi saat pulang = <b className="text-sky-400">keluar</b>.
        </p>
      </div>

      {/* Area scanner */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        {!scanning ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <ScanLine size={30} />
            </div>
            <p className="text-sm text-slate-300 mt-4 font-medium">Kamera gerbang nonaktif</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">{scanError || 'Aktifkan kamera untuk memindai QR tamu secara langsung.'}</p>
            <Button onClick={startScanner} className="w-full"><Camera size={16} /> Aktifkan Kamera</Button>
          </div>
        ) : (
          <div>
            <div id="qr-reader" className="rounded-2xl overflow-hidden [&_video]:w-full" />
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" onClick={stopScanner} className="flex-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
                <CameraOff size={15} /> Matikan
              </Button>
              <Button variant="secondary" onClick={() => setShowManual((v) => !v)} className="flex-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
                <Keyboard size={15} /> Input Manual
              </Button>
            </div>
          </div>
        )}

        {showManual && (
          <form onSubmit={(e) => { e.preventDefault(); submitToken(manualToken); }} className="mt-3 flex gap-2">
            <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)}
              placeholder="Tempel/ketik kode QR tamu..." className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
            <Button type="submit" loading={busy} className="shrink-0">Proses</Button>
          </form>
        )}
      </Card>

      {/* Hasil scan terakhir */}
      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-4 flex gap-3">
          <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-300 text-sm">Scan ditolak</p>
            <p className="text-xs text-rose-200/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className={clsx('rounded-xl border p-4 fade-up',
          result.result === 'checkin' ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-sky-500/15 border-sky-500/40')}>
          <div className="flex items-center gap-3">
            <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              result.result === 'checkin' ? 'bg-emerald-500/25 text-emerald-300' : 'bg-sky-500/25 text-sky-300')}>
              {result.result === 'checkin' ? <CheckCircle2 size={24} /> : <ExitIcon size={24} />}
            </div>
            <div className="min-w-0">
              <p className={clsx('font-bold', result.result === 'checkin' ? 'text-emerald-300' : 'text-sky-300')}>
                {result.result === 'checkin' ? 'TAMU MASUK ✓' : 'TAMU KELUAR ✓'}
              </p>
              <p className="text-sm text-slate-100 font-medium">{result.visit?.guest_name}</p>
              <p className="text-xs text-slate-400">Tujuan: <b className="text-slate-200">{result.houseLabel}</b> · {result.visit?.purpose}</p>
              {result.visit?.vehicle_plate && <p className="text-xs text-slate-400 mt-0.5">Kendaraan: {result.visit.vehicle_plate}</p>}
            </div>
            <p className="ml-auto text-xs text-slate-400 font-mono">{dayjs().format('HH:mm')}</p>
          </div>
          {result.result === 'checkin' && (
            <p className="text-[11px] mt-2 text-slate-400">Warga tujuan otomatis menerima notifikasi. Saat tamu pulang, pindai QR yang sama untuk mencatat waktu keluar.</p>
          )}
        </div>
      )}

      {/* Riwayat scan sesi ini */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Riwayat Sesi Ini</p>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-500">{h.at}</span>
                {h.result === 'error' ? (
                  <span className="text-rose-400 truncate">✗ {h.message}</span>
                ) : (
                  <>
                    <span className={h.result === 'checkin' ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
                      {h.result === 'checkin' ? '→ MASUK' : '← KELUAR'}
                    </span>
                    <span className="text-slate-300 truncate">{h.visit?.guest_name}</span>
                    <span className="text-slate-500 ml-auto shrink-0">{h.houseLabel}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
