// S\u00e9lecteur court
export const $ = s => document.querySelector(s);

// Formatage FR (chiffres)
export function fmt(n, d = 1) {
  return (n == null || isNaN(n))
    ? '\u2014'
    : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Clone objet en minuscules (cl\u00e9s)
export function lowerKeys(obj) {
  const m = {};
  for (const k in obj) m[k.toLowerCase()] = obj[k];
  return m;
}

// Ticks/tooltip temps FR pour Chart.js
export const displayFormats = {
  millisecond: 'HH:mm:ss', second: 'HH:mm:ss', minute: 'HH:mm',
  hour: 'HH:mm', day: 'dd/MM HH:mm', week: 'dd/MM HH:mm',
  month: 'dd/MM HH:mm', quarter: 'dd/MM HH:mm', year: 'dd/MM/yyyy'
};
export function timeUnitFor(m) { return m <= 60 ? 'minute' : 'hour'; }
export function frTick(value) { return new Date(value).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}); }
export function frTooltip(context) {
  const t = context.raw?.x ?? context.parsed.x;
  return new Date(t).toLocaleString('fr-FR', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'});
}

// Fetch JSON avec timeout
export async function fetchJSON(url, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(id);
  }
}
