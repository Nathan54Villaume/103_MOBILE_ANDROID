// js/main.js
import { $ } from './utils.js';
import { state } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
import { refreshCharts, initializeCharts } from './charts.js';
import { Kpi, initKpiCollapsibles } from './kpi.js';
import { initCollapsibles } from './ui-collapsibles.js';

// --------- Mapping des ic\u00f4nes du sprite ----------
const ICONS = {
    p_kw: '#i-bolt',     // Puissance active
    u: '#i-wave',        // Tensions de phase
    pf: '#i-bolt',       // Facteur de puissance (cos \u03c6)
    q_kvar: '#i-bolt',   // Puissance r\u00e9active
    i: '#i-gauge',       // Courants
    e: '#i-battery',     // \u00c9nergie
};

// Ins\u00e8re une ic\u00f4ne <svg><use/></svg> dans un \u00e9l\u00e9ment donn\u00e9.
function makeIconSvg(iconId, extraClass = 'icon stroke') {
    const svgNS = 'http://www.w3.org/2000/svg';
    const xlinkNS = 'http://www.w3.org/1999/xlink';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', extraClass);
    const use = document.createElementNS(svgNS, 'use');
    // href pour navigateurs modernes
    use.setAttributeNS(null, 'href', iconId);
    // xlink:href pour compat r\u00e9tro
    use.setAttributeNS(xlinkNS, 'xlink:href', iconId);
    svg.appendChild(use);
    return svg;
}

// D\u00e9corateur de secours : si kpi.js n'affiche pas l'ic\u00f4ne pass\u00e9e,
// on l'injecte dans le titre apr\u00e8s rendu.
function applyKpiIconsFallback(rootIds = ['tr1-kpis', 'tr2-kpis']) {
    try {
        rootIds.forEach(rootId => {
            const root = document.getElementById(rootId);
            if (!root) return;

            // On vise chaque carte .kpi
            root.querySelectorAll('.kpi').forEach(card => {
                // Cherche le kind via data-kind (pr\u00e9f\u00e9r\u00e9), sinon essaie de le d\u00e9duire via classes connues
                let kind = card.getAttribute('data-kind');
                if (!kind) {
                    // quelques heuristiques si data-kind absent
                    // ex: on peut parfois retrouver le key/kind dans un attribut data-key ou classe
                    kind = card.getAttribute('data-key')
                        || card.dataset?.key
                        || card.dataset?.kind
                        || ''; // on laisse vide si inconnu
                }

                // Trouve le titre plausible
                const titleEl =
                    card.querySelector('.kpi-title') ||
                    card.querySelector('.title') ||
                    card.querySelector('h4, h3, .card-title, .kpi-header');

                if (!titleEl) return;

                // D\u00e9j\u00e0 une ic\u00f4ne ? On ne duplique pas.
                if (titleEl.querySelector('svg')) return;

                // S\u00e9lection de l'ic\u00f4ne
                let iconId = '';
                if (kind && ICONS[kind]) {
                    iconId = ICONS[kind];
                } else {
                    // fallback doux si on ne conna\u00eet pas le kind : rien
                    return;
                }

                // Style: on met fill pour la foudre (bolt) sinon stroke
                const svg =
                    iconId === '#i-bolt'
                        ? makeIconSvg(iconId, 'icon fill')
                        : makeIconSvg(iconId, 'icon stroke');

                // On ins\u00e8re l'ic\u00f4ne au d\u00e9but du titre
                titleEl.prepend(svg);
            });
        });
    } catch (e) {
        console.warn("applyKpiIconsFallback: impossible d'injecter les ic\u00f4nes", e);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    // ====== Bienvenue ======
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const welcomeEl = $('#welcome-message');
        const userName = user ? (user.Nom || user.nom || user.NOM) : null;
        if (userName && welcomeEl) {
            const firstName = userName.split(' ')[0];
            welcomeEl.innerHTML = `Bonjour <span class="font-bold">${firstName}</span> !`;
        }
    } catch (e) {
        console.error("Impossible de r\u00e9cup\u00e9rer l'utilisateur :", e);
    }

    // ====== Horloge bandeau top ======
    const topTimeEl = document.getElementById('top-time');
    const topDateEl = document.getElementById('top-date');
    const updateTopClock = () => {
        const now = new Date();
        if (topTimeEl) {
            topTimeEl.textContent = new Intl.DateTimeFormat('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            }).format(now);
        }
        if (topDateEl) {
            const formatted = new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(now);
            topDateEl.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
        }
    };
    updateTopClock();
    setInterval(updateTopClock, 30_000);

    // ====== Dialog Param\u00e8tres ======
    const dlg = $('#settings'), btn = $('#btn-settings'), save = $('#save-settings');
    if (!btn || !dlg || !save) { console.error('Param\u00e8tres: \u00e9l\u00e9ments introuvables'); return; }
    if (typeof dlg.showModal !== 'function') {
        dlg.showModal = function () { dlg.setAttribute('open', 'open'); };
        dlg.close = function () { dlg.removeAttribute('open'); };
    }
    btn.addEventListener('click', () => { $('#api-base').value = state.apiBase; dlg.showModal(); });
    save.addEventListener('click', () => {
        state.apiBase = $('#api-base').value.trim();
        localStorage.setItem('apiBase', state.apiBase);
        dlg.close();
        location.reload();
    });

    // ====== Base de temps ======
    ['win_p1', 'win_u1', 'win_pf1', 'win_p2', 'win_u2', 'win_pf2'].forEach(k => {
        if (localStorage.getItem(k) == null) localStorage.setItem(k, '15');
    });
    document.querySelectorAll('.sel').forEach(sel => {
        sel.addEventListener('change', async () => {
            const key = sel.id.split('-')[1]; // p1/u1/pf1 etc.
            localStorage.setItem(`win_${key}`, sel.value);
            state.win[key] = Number(sel.value);
            const trId = (key.includes('1')) ? 1 : 2;
            try { await loadSeries(trId); refreshCharts(); } catch (e) { console.error(e); }
            recomputeAdaptivePolling();
        });
    });
    const sync = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
    sync('win-p1', state.win.p1); sync('win-u1', state.win.u1); sync('win-pf1', state.win.pf1);
    sync('win-p2', state.win.p2); sync('win-u2', state.win.u2); sync('win-pf2', state.win.pf2);

    // ====== KPI grids ======
    // TR1 : ligne 1 = P, U12, U23, U31, PF
    //       ligne 2 = Q, I1,  I2,  I3,  E
    Kpi.create('tr1-kpis', [
        { key: 'tr1.p_kw', title: 'Puissance', unit: 'kW', decimals: 1, showSpark: false, kind: 'p_kw', icon: ICONS.p_kw },
        { key: 'tr1.u12', title: 'U12', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr1.u23', title: 'U23', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr1.u31', title: 'U31', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr1.pf', title: 'Facteur de Puissance', decimals: 3, showSpark: false, kind: 'pf', icon: ICONS.pf },

        { key: 'tr1.q_kvar', title: 'R\u00e9active', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar', icon: ICONS.q_kvar },
        { key: 'tr1.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.e_kwh', title: '\u00c9nergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e', icon: ICONS.e },
    ]);
    initKpiCollapsibles(['tr1-kpis']);

    // TR2 : m\u00eame ordre
    Kpi.create('tr2-kpis', [
        { key: 'tr2.p_kw', title: 'Puissance', unit: 'kW', decimals: 1, showSpark: false, kind: 'p_kw', icon: ICONS.p_kw },
        { key: 'tr2.u12', title: 'U12', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.u23', title: 'U23', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.u31', title: 'U31', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.pf', title: 'Facteur de Puissance', decimals: 3, showSpark: false, kind: 'pf', icon: ICONS.pf },

        { key: 'tr2.q_kvar', title: 'R\u00e9active', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar', icon: ICONS.q_kvar },
        { key: 'tr2.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.e_kwh', title: '\u00c9nergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e', icon: ICONS.e },
    ]);
    initKpiCollapsibles(['tr2-kpis']);

    // Collapsibles (KPI + cartes graphiques)
    initCollapsibles(document);

    // ====== Initialisation des charts ======
    initializeCharts();

    // ====== D\u00e9marrage ======
    attachVisibilityHandler();

    // D\u00e9marre le polling (qui charge l'historique en premier)
    console.log('[main] D\u00e9marrage du syst\u00e8me de supervision...');
    await startPolling();

    // Laisse le temps au DOM KPI de se poser puis ins\u00e8re les ic\u00f4nes si non g\u00e9r\u00e9es par kpi.js
    requestAnimationFrame(() => applyKpiIconsFallback(['tr1-kpis', 'tr2-kpis']));
});
