// js/kpi.js
// KPI Cards : stats centrées (Moyenne / Max), pas de Min
import { fmt as _fmt } from './utils.js';

const REG = new Map();
let DETAILS = null;

const ICON_ID_BY_KIND = {
    p_kw: 'power',
    q_kvar: 'reactive',
    pf: 'pf',
    u: 'voltage',
    i: 'current',
    e: 'energy'
};

function fmt(v, d = 1) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return _fmt ? _fmt(v, d) : Number(v).toFixed(d);
}

function createDetailsDialog() {
    if (DETAILS) return DETAILS;
    const dlg = document.createElement('dialog');
    dlg.className = 'backdrop:bg-black/60 rounded-2xl w-full max-w-lg text-white';
    dlg.innerHTML = `
    <form method="dialog" class="rounded-2xl bg-gray-800 border border-white/10 p-5 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div id="det-title" class="text-lg font-semibold">Détails</div>
          <div id="det-sub" class="text-xs text-white/60">—</div>
        </div>
        <button class="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2">Fermer</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Valeur</div>
          <div id="det-val" class="text-2xl font-semibold">—</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Moyenne</div>
          <div id="det-avg" class="text-xl">—</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Max</div>
          <div id="det-max" class="text-xl">—</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Dernière MAJ</div>
          <div id="det-ts" class="text-sm">—</div>
        </div>
      </div>
    </form>`;
    document.body.appendChild(dlg);
    DETAILS = dlg;
    return dlg;
}

// --- Utilise le sprite <symbol id="ic-...">
function makeIconFromSprite(id, classes = 'w-4 h-4 text-white/70') {
    if (!id) return document.createTextNode('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classes);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');

    // Essaye d'abord l'attribut moderne 'href'
    try { use.setAttribute('href', `#ic-${id}`); } catch { }
    // Puis xlink:href (compat)
    try { use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#ic-${id}`); } catch { }

    svg.appendChild(use);

    // Log utile si le symbole est introuvable
    if (!document.getElementById(`ic-${id}`)) {
        console.warn(`[KPI] Icône #ic-${id} introuvable dans le sprite`);
    }
    return svg;
}

function resolveIconId(def) {
    if (def.icon) return def.icon; // ex: 'power'
    const kind = def.kind || '';
    const normalized =
        kind.startsWith('u') ? 'u' :
            kind.startsWith('i') ? 'i' :
                kind;
    if (ICON_ID_BY_KIND[normalized]) return ICON_ID_BY_KIND[normalized];

    const suffix = (def.key || '').split('.').pop() || '';
    const byKey =
        suffix.startsWith('u') ? 'u' :
            suffix.startsWith('i') ? 'i' :
                suffix;
    return ICON_ID_BY_KIND[byKey] || 'power';
}

function makeCard(def) {
    const { key, title, unit = '', decimals = 1, showSpark = false } = def;

    const card = document.createElement('div');
    card.className = 'kpi card p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors';

    const head = document.createElement('div');
    head.className = 'w-full flex items-center justify-between gap-3 mb-2';

    const hwrap = document.createElement('div');
    hwrap.className = 'flex items-center gap-2 text-sm text-white/70';

    const iconId = resolveIconId(def);
    hwrap.appendChild(makeIconFromSprite(iconId));

    const h3 = document.createElement('div');
    h3.textContent = title;
    hwrap.appendChild(h3);

    head.appendChild(hwrap);
    card.appendChild(head);

    const value = document.createElement('div');
    value.className = 'value mt-1 text-3xl font-semibold';
    value.style.fontVariantNumeric = 'tabular-nums';
    value.textContent = '—';

    const unitEl = document.createElement('span');
    unitEl.className = 'ml-2 text-sm text-white/60 font-normal';
    unitEl.textContent = unit || '';
    value.appendChild(unitEl);
    card.appendChild(value);

    const stats = document.createElement('div');
    stats.className = 'mt-4 grid grid-cols-2 gap-4 w-full px-2';
    const s1 = document.createElement('div');
    s1.innerHTML = `<div class="text-[10px] uppercase tracking-wide text-white/50 text-center">Moyenne</div>
                  <div class="text-sm text-center" data-role="avg">—</div>`;
    const s2 = document.createElement('div');
    s2.innerHTML = `<div class="text-[10px] uppercase tracking-wide text-white/50 text-center">Max</div>
                  <div class="text-sm text-center" data-role="max">—</div>`;
    stats.append(s1, s2);
    card.appendChild(stats);

    let chart = null;
    if (showSpark && window.Chart) {
        const sparkWrap = document.createElement('div');
        sparkWrap.className = 'mt-3 h-10 w-full';
        const canvas = document.createElement('canvas'); canvas.height = 40;
        sparkWrap.appendChild(canvas); card.appendChild(sparkWrap);
        chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderWidth: 2, tension: 0.35, pointRadius: 0 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                elements: { point: { radius: 0 } }
            }
        });
    }

    card.addEventListener('click', () => {
        const dlg = createDetailsDialog();
        const e = REG.get(key); if (!e) return;
        const ts = e.lastTs ? new Date(e.lastTs) : null;
        dlg.querySelector('#det-title').textContent = `${title} ${unit ? `(${unit})` : ''}`;
        dlg.querySelector('#det-sub').textContent = key;
        dlg.querySelector('#det-val').textContent = fmt(e.lastVal, decimals);
        dlg.querySelector('#det-avg').textContent = fmt(e.lastAvg, decimals);
        dlg.querySelector('#det-max').textContent = fmt(e.lastMax, decimals);
        dlg.querySelector('#det-ts').textContent = ts ? ts.toLocaleString('fr-FR') : '—';
        dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', 'open');
    });

    return { el: card, value, unitEl, stats, chart, decimals };
}

export const Kpi = {
    create(containerId, defs) {
        const root = document.getElementById(containerId);
        if (!root) throw new Error(`container #${containerId} introuvable`);
        for (const def of defs) {
            if (!def.key) throw new Error('Chaque def doit avoir un "key" unique (ex: "tr1.p_kw")');
            const card = makeCard(def);
            card.el.classList.add('h-full');
            root.appendChild(card.el);
            REG.set(def.key, { ...card, cfg: def, data: [], lastVal: null, lastAvg: null, lastMax: null, lastTs: null });
        }
    },

    update(key, data) {
        const entry = REG.get(key);
        if (!entry) return;

        const { value, avg, max, decimals = entry.decimals, unit, ts } = data;

        entry.value.firstChild.textContent = fmt(value, decimals);
        if (unit !== undefined) entry.unitEl.textContent = unit;

        const avgEl = entry.stats.querySelector('[data-role="avg"]');
        const maxEl = entry.stats.querySelector('[data-role="max"]');
        if (avgEl) avgEl.textContent = fmt(avg, decimals);
        if (maxEl) maxEl.textContent = fmt(max, decimals);

        if (entry.chart && value !== null && value !== undefined && !isNaN(value)) {
            const x = ts ? (typeof ts === 'number' ? ts : new Date(ts).getTime()) : Date.now();
            entry.data.push({ x, y: Number(value) });
            if (entry.data.length > 240) entry.data.splice(0, entry.data.length - 240);
            entry.chart.data.labels = entry.data.map(p => p.x);
            entry.chart.data.datasets[0].data = entry.data.map(p => p.y);
            entry.chart.update('none');
        }

        entry.lastVal = value;
        entry.lastAvg = avg;
        entry.lastMax = max;
        entry.lastTs = ts || Date.now();
    }
};
