import { clsx } from 'clsx';
import { X, Loader2, Inbox } from 'lucide-react';
import dayjs from 'dayjs';

/* ------------------------------ Button ------------------------------ */
export function Button({ className, variant = 'primary', size = 'md', loading, children, ...props }) {
  const variants = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
    amber: 'bg-amber-500 text-white hover:bg-amber-600',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button
      className={clsx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------- Card ------------------------------- */
export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-slate-200 shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Badge ------------------------------ */
const BADGE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-sky-100 text-sky-800',
  slate: 'bg-slate-100 text-slate-600',
  purple: 'bg-violet-100 text-violet-700',
};

export function Badge({ color = 'slate', className, children }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap',
      BADGE_STYLES[color], className)}>
      {children}
    </span>
  );
}

export const billStatusBadge = (s) => ({
  paid: <Badge color="green">Lunas</Badge>,
  unpaid: <Badge color="amber">Belum Bayar</Badge>,
  overdue: <Badge color="red">Terlambat</Badge>,
  void: <Badge color="slate">Dibatalkan</Badge>,
})[s] || <Badge>{s}</Badge>;

export const payStatusBadge = (s) => ({
  verified: <Badge color="green">Terverifikasi</Badge>,
  pending: <Badge color="amber">Menunggu</Badge>,
  failed: <Badge color="red">Ditolak</Badge>,
  expired: <Badge color="slate">Kedaluwarsa</Badge>,
})[s] || <Badge>{s}</Badge>;

export const complaintStatusBadge = (s) => ({
  draft: <Badge color="slate">Draft</Badge>,
  menunggu: <Badge color="amber">Menunggu</Badge>,
  diproses: <Badge color="blue">Diproses</Badge>,
  selesai: <Badge color="green">Selesai</Badge>,
  ditolak: <Badge color="red">Ditolak</Badge>,
})[s] || <Badge>{s}</Badge>;

export const priorityBadge = (p) => ({
  rendah: <Badge color="slate">Rendah</Badge>,
  normal: <Badge color="blue">Normal</Badge>,
  tinggi: <Badge color="amber">Tinggi</Badge>,
  darurat: <Badge color="red">🚨 Darurat</Badge>,
})[p] || <Badge>{p}</Badge>;

/* ------------------------------ Inputs ------------------------------ */
export function Field({ label, required, children, className }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none disabled:bg-slate-50';

export function Input({ className, ...props }) {
  return <input className={clsx(inputCls, className)} {...props} />;
}
export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={clsx(inputCls, 'resize-y', className)} {...props} />;
}
export function Select({ className, children, ...props }) {
  return <select className={clsx(inputCls, 'pr-8', className)} {...props}>{children}</select>;
}

/* ------------------------------- Modal ------------------------------ */
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-xl w-full slide-down max-h-[90vh] flex flex-col',
        wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------- Misc helpers --------------------------- */
export function Spinner({ className }) {
  return <Loader2 className={clsx('animate-spin text-emerald-700', className)} size={24} />;
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-3"><Icon size={26} /></div>
      <p className="font-medium text-slate-600">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
      {children}
    </div>
  );
}

export const fmtDate = (d, withTime = false) =>
  d ? dayjs(d.replace(' ', 'T')).format(withTime ? 'DD MMM YYYY HH:mm' : 'DD MMM YYYY') : '-';

export const fmtDateTime = (d) => fmtDate(d, true);

export const fmtPeriod = (p) => (p ? dayjs(p + '-01').format('MMMM YYYY') : '-');
