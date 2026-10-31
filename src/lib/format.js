export const inr = (n, opts = {}) => {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toLocaleString('en-IN');
  return `${v < 0 ? '−' : ''}₹${s}${opts.suffix || ''}`;
};

export const inrShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${sign}₹${Math.round(a)}`;
};

export const pct = (n, digits = 0) => `${(Number(n) || 0).toFixed(digits)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const dateLabel = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${String(y).slice(2)}` : ''}`;
};

export const todayISO = () => {
  const d = new Date();
  return toISO(d);
};
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthKey = (iso) => String(iso || '').slice(0, 7);
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toISO(dt);
};
export const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, Math.min(d, 28));
  return toISO(dt);
};
export const daysBetween = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};
export const monthsBetween = (a, b) => daysBetween(a, b) / 30.44;
export const uid = () => Math.random().toString(36).slice(2, 10);
