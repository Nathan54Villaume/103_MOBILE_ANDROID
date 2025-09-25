import { $ } from './utils.js';
import { state } from './state.js';
import { startPolling, setConn, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
import { refreshCharts } from './charts.js';

window.addEventListener('DOMContentLoaded', async () => {
    // ====== Dialog Paramètres ======
    const dlg = $('#settings');
    const btn = $('#btn-settings');
    const save = $('#save-settings');

    if (!btn || !dlg || !save) {
        console.error('Paramètres: éléments introuvables (#btn-settings, #settings, #save-settings)');
        return;
    }

    if (typeof dlg.showModal !== 'function') {
        dlg.showModal = function () { dlg.setAttribute('open', 'open'); };
        dlg.close = function () { dlg.removeAttribute('open'); };
    }

    btn.addEventListener('click', () => {
        $('#api-base').value = state.apiBase;
        dlg.showModal();
    });

    save.addEventListener('click', () => {
        state.apiBase = $('#api-base').value.trim();
        localStorage.setItem('apiBase', state.apiBase);
        dlg.close();
        location.reload();
    });

    // ====== Base de temps (p1/u1/p2/u2) ======
    ['win_p1', 'win_u1', 'win_p2', 'win_u2'].forEach(k => {
        if (localStorage.getItem(k) == null) localStorage.setItem(k, '15');
    });

    document.querySelectorAll('.sel').forEach(sel => {
        sel.addEventListener('change', async () => {
            const key = sel.id.split('-')[1]; // p1/u1/p2/u2
            localStorage.setItem(`win_${key}`, sel.value);
            state.win[key] = Number(sel.value);

            const trId = (key === 'p1' || key === 'u1') ? 1 : 2;
            try {
                await loadSeries(trId);  // recharge l’historique aligné
                refreshCharts();
            } catch (e) {
                console.error(e);
            }

            recomputeAdaptivePolling();
        });
    });

    // Sync selects
    const sync = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
    sync('win-p1', state.win.p1); sync('win-u1', state.win.u1);
    sync('win-p2', state.win.p2); sync('win-u2', state.win.u2);

    // ====== Chargement initial de l'historique AVANT polling ======
    if (!state.apiBase) {
        setConn(false, "API non configurée");
    } else {
        try {
            await Promise.all([loadSeries(1), loadSeries(2)]);
            refreshCharts();
        } catch (e) {
            console.error('Chargement initial échoué:', e);
            setConn(false, "Erreur chargement historique");
        }
    }

    // ====== Démarrage ======
    attachVisibilityHandler();
    startPolling();
});
