// js/main.js
import { $ } from './utils.js';
import { state } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
import { refreshCharts } from './charts.js';
import { Kpi } from './kpi.js';

// --------- Mapping des icônes du sprite ----------
const ICONS = {
    p_kw: '#i-bolt',     // Puissance active
    u: '#i-wave',        // Tensions de phase
    pf: '#i-pf',         // Facteur de puissance (cos φ)
    q_kvar: '#i-gauge',  // Puissance réactive
    i: '#i-gauge',       // Courants
    e: '#i-battery',     // Énergie
};

// Insère une icône <svg><use/></svg> dans un élément donné.
function makeIconSvg(iconId, extraClass = 'icon stroke') {
    const svgNS = 'http://www.w3.org/2000/svg';
    const xlinkNS = 'http://www.w3.org/1999/xlink';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', extraClass);
    const use = document.createElementNS(svgNS, 'use');
    // href pour navigateurs modernes
    use.setAttributeNS(null, 'href', iconId);
    // xlink:href pour compat rétro
    use.setAttributeNS(xlinkNS, 'xlink:href', iconId);
    svg.appendChild(use);
    return svg;
}

// Décorateur de secours : si kpi.js n’affiche pas l’icône passée,
// on l’injecte dans le titre après rendu.
function applyKpiIconsFallback(rootIds = ['tr1-kpis', 'tr2-kpis']) {
    try {
        rootIds.forEach(rootId => {
            const root = document.getElementById(rootId);
            if (!root) return;

            // On vise chaque carte .kpi
            root.querySelectorAll('.kpi').forEach(card => {
                // Cherche le kind via data-kind (préféré), sinon essaie de le déduire via classes connues
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

                // Déjà une icône ? On ne duplique pas.
                if (titleEl.querySelector('svg')) return;

                // Sélection de l’icône
                let iconId = '';
                if (kind && ICONS[kind]) {
                    iconId = ICONS[kind];
                } else {
                    // fallback doux si on ne connaît pas le kind : rien
                    return;
                }

                // Style: on met fill pour la foudre (bolt) sinon stroke
                const svg =
                    iconId === '#i-bolt'
                        ? makeIconSvg(iconId, 'icon fill')
                        : makeIconSvg(iconId, 'icon stroke');

                // On insère l’icône au début du titre
                titleEl.prepend(svg);
            });
        });
    } catch (e) {
        console.warn('applyKpiIconsFallback: impossible d’injecter les icônes', e);
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
        console.error("Impossible de récupérer l'utilisateur :", e);
    }

    // ====== Dialog Paramètres ======
    const dlg = $('#settings'), btn = $('#btn-settings'), save = $('#save-settings');
    if (!btn || !dlg || !save) { console.error('Paramètres: éléments introuvables'); return; }
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

        { key: 'tr1.q_kvar', title: 'Réactive', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar', icon: ICONS.q_kvar },
        { key: 'tr1.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr1.e_kwh', title: 'Énergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e', icon: ICONS.e },
    ]);

    // TR2 : même ordre
    Kpi.create('tr2-kpis', [
        { key: 'tr2.p_kw', title: 'Puissance', unit: 'kW', decimals: 1, showSpark: false, kind: 'p_kw', icon: ICONS.p_kw },
        { key: 'tr2.u12', title: 'U12', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.u23', title: 'U23', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.u31', title: 'U31', unit: 'V', decimals: 0, showSpark: false, kind: 'u', icon: ICONS.u },
        { key: 'tr2.pf', title: 'Facteur de Puissance', decimals: 3, showSpark: false, kind: 'pf', icon: ICONS.pf },

        { key: 'tr2.q_kvar', title: 'Réactive', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar', icon: ICONS.q_kvar },
        { key: 'tr2.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i', icon: ICONS.i },
        { key: 'tr2.e_kwh', title: 'Énergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e', icon: ICONS.e },
    ]);

    // ====== Démarrage ======
    attachVisibilityHandler();

    // Démarre la collecte ; après le premier rendu, on applique le fallback d’icônes si besoin
    await startPolling();

    // Laisse le temps au DOM KPI de se poser puis insère les icônes si non gérées par kpi.js
    requestAnimationFrame(() => applyKpiIconsFallback(['tr1-kpis', 'tr2-kpis']));
});
