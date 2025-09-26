// js/main.js
import { $ } from './utils.js';
import { state } from './state.js';
import { startPolling, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
import { refreshCharts } from './charts.js';
import { Kpi } from './kpi.js';

window.addEventListener('DOMContentLoaded', async () => {
    // ====== Bienvenue ======
    try {
        const user = JSON.parse(localStorage.getItem("user"));
        const welcomeEl = $('#welcome-message');
        const userName = user ? (user.Nom || user.nom || user.NOM) : null;
        if (userName && welcomeEl) {
            const firstName = userName.split(' ')[0];
            welcomeEl.innerHTML = `Bonjour <span class="font-bold">${firstName}</span> !`;
        }
    } catch (e) { console.error("Impossible de récupérer l'utilisateur :", e); }

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
        { key: 'tr1.p_kw', title: 'Puissance', unit: 'kW', decimals: 1, showSpark: false, kind: 'p_kw' },
        { key: 'tr1.u12', title: 'U12', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr1.u23', title: 'U23', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr1.u31', title: 'U31', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr1.pf', title: 'Facteur de Puissance', decimals: 3, showSpark: false, kind: 'pf' },

        { key: 'tr1.q_kvar', title: 'Réactive', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar' },
        { key: 'tr1.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr1.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr1.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr1.e_kwh', title: 'Énergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e' },
    ]);

    // TR2 : même ordre
    Kpi.create('tr2-kpis', [
        { key: 'tr2.p_kw', title: 'Puissance', unit: 'kW', decimals: 1, showSpark: false, kind: 'p_kw' },
        { key: 'tr2.u12', title: 'U12', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr2.u23', title: 'U23', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr2.u31', title: 'U31', unit: 'V', decimals: 0, showSpark: false, kind: 'u' },
        { key: 'tr2.pf', title: 'Facteur de Puissance', decimals: 3, showSpark: false, kind: 'pf' },

        { key: 'tr2.q_kvar', title: 'Réactive', unit: 'kvar', decimals: 1, showSpark: false, kind: 'q_kvar' },
        { key: 'tr2.i1', title: 'I1', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr2.i2', title: 'I2', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr2.i3', title: 'I3', unit: 'A', decimals: 1, showSpark: false, kind: 'i' },
        { key: 'tr2.e_kwh', title: 'Énergie', unit: 'kWh', decimals: 0, showSpark: false, kind: 'e' },
    ]);

    // ====== Démarrage ======
    attachVisibilityHandler();
    await startPolling();
});
