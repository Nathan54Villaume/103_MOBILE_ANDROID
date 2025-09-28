// js/kpi.js
// KPI Cards : stats centr\u00e9es (Moyenne / Max), pas de Min
import { fmt as _fmt } from './utils.js';
import { initCollapsibles } from './ui-collapsibles.js';
import { bindHoverTooltip } from './ui-tooltips.js';

const REG = new Map();
let DETAILS = null;

// Map "kind" -> id du sprite actuel
const ICON_ID_BY_KIND = {
    p_kw: '#i-bolt',    // Puissance active
    q_kvar: '#i-bolt',   // R\u00e9active
    pf: '#i-bolt',      // Facteur de puissance
    u: '#i-wave',    // Tensions
    i: '#i-gauge',   // Courants
    e: '#i-battery', // \u00c9nergie
};

// Compat: anciens noms -> sprite actuel
const NAME_TO_SPRITE = {
    power: '#i-bolt',
    reactive: '#i-gauge',
    pf: '#i-pf',
    voltage: '#i-wave',
    current: '#i-gauge',
    energy: '#i-battery',
};

function fmt(v, d = 1) {
    if (v === null || v === undefined || isNaN(v)) return '\u2014';
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
          <div id="det-title" class="text-lg font-semibold">D\u00e9tails</div>
          <div id="det-sub" class="text-xs text-white/60">\u2014</div>
        </div>
        <button class="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2">Fermer</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Valeur</div>
          <div id="det-val" class="text-2xl font-semibold">\u2014</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Moyenne</div>
          <div id="det-avg" class="text-xl">\u2014</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Max</div>
          <div id="det-max" class="text-xl">\u2014</div>
        </div>
        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="text-xs text-white/60">Derni\u00e8re MAJ</div>
          <div id="det-ts" class="text-sm">\u2014</div>
        </div>
      </div>
    </form>`;
    document.body.appendChild(dlg);
    DETAILS = dlg;
    return dlg;
}

// ---- Sprite helper : accepte '#i-xxx' ou 'xxx'
function makeIconFromSprite(id, classes = 'icon stroke') {
    if (!id) return document.createTextNode('');
    const iconId = id.startsWith('#') ? id : `#i-${id}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classes);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    // href moderne
    try { use.setAttribute('href', iconId); } catch { }
    // xlink:href compat
    try { use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', iconId); } catch { }
    svg.appendChild(use);

    if (!document.querySelector(iconId)) {
        console.warn(`[KPI] Ic\u00f4ne ${iconId} introuvable dans le sprite`);
    }
    return svg;
}

function resolveIconId(def) {
    // Priorit\u00e9 au champ explicite
    if (def.icon) {
        if (def.icon.startsWith('#')) return def.icon;         // ex: '#i-wave'
        if (NAME_TO_SPRITE[def.icon]) return NAME_TO_SPRITE[def.icon]; // ex: 'power'
        return `#i-${def.icon}`; // fallback
    }

    // Sinon, bas\u00e9 sur kind / key (avec normalisation u*, i*)
    const kind = (def.kind || '').toString();
    const normalized = kind.startsWith('u') ? 'u' : kind.startsWith('i') ? 'i' : kind;
    if (ICON_ID_BY_KIND[normalized]) return ICON_ID_BY_KIND[normalized];

    const suffix = ((def.key || '').split('.').pop() || '').toString();
    const byKey = suffix.startsWith('u') ? 'u' : suffix.startsWith('i') ? 'i' : suffix;
    return ICON_ID_BY_KIND[byKey] || '#i-bolt';
}

function makeCard(def) {
    const { key, title, unit = '', decimals = 1, showSpark = false } = def;

    const card = document.createElement('div');
    card.className = 'kpi card p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors';
    card.setAttribute('data-key', key || '');
    if (def.kind) card.setAttribute('data-kind', def.kind);

    const head = document.createElement('div');
    head.className = 'w-full flex items-center justify-between gap-3 mb-2';
    head.setAttribute('data-collapsible', 'kpi-card');
    head.setAttribute('data-title', '');

    const hwrap = document.createElement('button');
    hwrap.className = 'collapsible-title kpi-title flex items-center gap-2 text-sm text-white/70';
    hwrap.type = 'button';
    hwrap.setAttribute('role', 'button');
    hwrap.setAttribute('aria-expanded', 'true');

    const iconId = resolveIconId(def);
    const svg =
        iconId === '#i-bolt'
            ? makeIconFromSprite(iconId, 'icon fill')
            : makeIconFromSprite(iconId, 'icon stroke');
    hwrap.appendChild(svg);

    const h3 = document.createElement('div');
    h3.textContent = title;
    hwrap.appendChild(h3);

    bindHoverTooltip(hwrap, () => card.classList.contains('collapsed') ? 'Cliquer pour ouvrir' : 'Cliquer pour r\u00e9duire');
    hwrap.dataset.collapsibleToggle = 'true';

    head.appendChild(hwrap);
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'space-y-4';
    body.setAttribute('data-collapsible-content', '');

    const value = document.createElement('div');
    value.className = 'value mt-1 text-6xl font-semibold text-center';
    value.style.fontVariantNumeric = 'tabular-nums';
    value.textContent = '\u2014';

    const unitEl = document.createElement('span');
    unitEl.className = 'ml-2 text-sm text-white/60 font-normal';
    unitEl.textContent = unit || '';
    value.appendChild(unitEl);
    body.appendChild(value);

    const stats = document.createElement('div');
    stats.className = 'mt-4 grid grid-cols-2 gap-4 w-full px-2';
    const s1 = document.createElement('div');
    s1.innerHTML = `<div class="text-[10px] uppercase tracking-wide text-white/50 text-center">Moyenne</div>
                  <div class="text-sm text-center" data-role="avg">\u2014</div>`;
    const s2 = document.createElement('div');
    s2.innerHTML = `<div class="text-[10px] uppercase tracking-wide text-white/50 text-center">Max</div>
                  <div class="text-sm text-center" data-role="max">\u2014</div>`;
    stats.append(s1, s2);
    body.appendChild(stats);

    let chart = null;
    if (showSpark && window.Chart) {
        const sparkWrap = document.createElement('div');
        sparkWrap.className = 'mt-3 h-10 w-full';
        const canvas = document.createElement('canvas'); canvas.height = 40;
        sparkWrap.appendChild(canvas);
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
        body.appendChild(sparkWrap);
    }

    card.appendChild(body);

    const stored = localStorage.getItem(`card:${card.dataset.key || card.id || ''}`);
    if (stored !== null && hwrap) {
        hwrap.setAttribute('aria-expanded', stored === 'true' ? 'true' : 'false');
    }

    card.addEventListener('click', (evt) => {
        if (evt.target.closest('.collapsible-title')) return;
        const dlg = createDetailsDialog();
        const e = REG.get(key); if (!e) return;
        const ts = e.lastTs ? new Date(e.lastTs) : null;
        dlg.querySelector('#det-title').textContent = `${title} ${unit ? `(${unit})` : ''}`;
        dlg.querySelector('#det-sub').textContent = key;
        dlg.querySelector('#det-val').textContent = fmt(e.lastVal, decimals);
        dlg.querySelector('#det-avg').textContent = fmt(e.lastAvg, decimals);
        dlg.querySelector('#det-max').textContent = fmt(e.lastMax, decimals);
        dlg.querySelector('#det-ts').textContent = ts ? ts.toLocaleString('fr-FR') : '\u2014';
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

        // valeur principale (premier n\u0153ud texte du container 'value')
        entry.value.firstChild.textContent = fmt(value, decimals);
        if (unit !== undefined) entry.unitEl.textContent = unit;

        const avgEl = entry.stats.querySelector('[data-role="avg"]');
        const maxEl = entry.stats.querySelector('[data-role="max"]');

        // Ajout unit\u00e9 si valeur pr\u00e9sente
        if (avgEl) {
            const val = fmt(avg, decimals);
            avgEl.textContent = (val !== '\u2014' ? `${val} ${unit || ''}` : '\u2014');
        }
        if (maxEl) {
            const val = fmt(max, decimals);
            maxEl.textContent = (val !== '\u2014' ? `${val} ${unit || ''}` : '\u2014');
        }


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

export function initKpiCollapsibles(rootIds = []) {
    rootIds.forEach(id => {
        const root = document.getElementById(id);
        if (!root) return;
        initCollapsibles(root);
    });
}
