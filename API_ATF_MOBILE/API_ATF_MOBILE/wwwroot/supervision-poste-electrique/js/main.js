import { $ } from './utils.js';
import { state } from './state.js';
import { startPolling, setConn, attachVisibilityHandler, recomputeAdaptivePolling } from './polling.js';
import { loadSeries } from './api.js';
import { refreshCharts } from './charts.js';

window.addEventListener('DOMContentLoaded', async () => {
    // ====== Affichage du message de bienvenue ======
    try {
        const user = JSON.parse(localStorage.getItem("user"));
        const welcomeEl = $('#welcome-message');

        // CORRECTION : On vérifie toutes les casses possibles pour le nom (Nom, nom, ou NOM)
        const userName = user ? (user.Nom || user.nom || user.NOM) : null;

        if (userName && welcomeEl) {
            const firstName = userName.split(' ')[0];
            welcomeEl.innerHTML = `Bonjour <span class="font-bold">${firstName}</span> !`;
        }
    } catch (e) {
        console.error("Impossible de récupérer l'utilisateur :", e);
    }

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

    // ====== Base de temps (p1/u1/pf1/p2/u2/pf2) ======
    ['win_p1', 'win_u1', 'win_pf1', 'win_p2', 'win_u2', 'win_pf2'].forEach(k => {
        if (localStorage.getItem(k) == null) localStorage.setItem(k, '15');
    });

    document.querySelectorAll('.sel').forEach(sel => {
        sel.addEventListener('change', async () => {
            const key = sel.id.split('-')[1]; // p1/u1/pf1 etc.
            localStorage.setItem(`win_${key}`, sel.value);
            state.win[key] = Number(sel.value);

            const trId = (key.includes('1')) ? 1 : 2;
            try {
                await loadSeries(trId);
                refreshCharts();
            } catch (e) {
                console.error(e);
            }

            recomputeAdaptivePolling();
        });
    });

    // ====== Logique pour réduire les cartes ======
    document.querySelectorAll('.card-head h3').forEach(title => {
        title.addEventListener('click', () => {
            title.closest('.card').classList.toggle('collapsed');
        });
    });

    // Sync selects
    const sync = (id, val) => { const el = document.getElementById(id); if (el) el.value = String(val); };
    sync('win-p1', state.win.p1); sync('win-u1', state.win.u1); sync('win-pf1', state.win.pf1);
    sync('win-p2', state.win.p2); sync('win-u2', state.win.u2); sync('win-pf2', state.win.pf2);

    // ====== Démarrage ======
    attachVisibilityHandler();
    await startPolling();
});