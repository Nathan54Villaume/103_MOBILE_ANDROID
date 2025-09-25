import { $, fmt } from './utils.js';
import { state, bufs, prune } from './state.js';
import { fetchJSON, normalizeSnapshot, loadSeries } from './api.js';
import { refreshCharts } from './charts.js';

// État connexion
export function setConn(connected, message = '') {
    const led = $('#conn-led'), txt = $('#conn-text');
    led.style.color = connected ? '#10b981' : '#ef4444';
    txt.textContent = connected ? 'Connecté' : (message || 'Déconnecté');
    txt.title = connected ? '' : message;
}

export function hideLoader() {
    if (state.initialLoad) {
        state.initialLoad = false;
        $('#loader').style.display = 'none';
    }
}

// KPIs
export function updateKPIs(patch) {
    const map = [
        ['t1_p_kw', 't1-p', 1], ['t1_q_kvar', 't1-q', 1], ['t1_pf', 't1-pf', 2],
        ['t1_u12_v', 't1-u12', 0], ['t1_u23_v', 't1-u23', 0], ['t1_u31_v', 't1-u31', 0],
        ['t1_i1_a', 't1-i1', 0], ['t1_i2_a', 't1-i2', 0], ['t1_i3_a', 't1-i3', 0], ['t1_e_kwh', 't1-e', 0],
        ['t2_p_kw', 't2-p', 1], ['t2_q_kvar', 't2-q', 1], ['t2_pf', 't2-pf', 2],
        ['t2_u12_v', 't2-u12', 0], ['t2_u23_v', 't2-u23', 0], ['t2_u31_v', 't2-u31', 0],
        ['t2_i1_a', 't2-i1', 0], ['t2_i2_a', 't2-i2', 0], ['t2_i3_a', 't2-i3', 0], ['t2_e_kwh', 't2-e', 0],
    ];
    for (const [key, id, dec] of map) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            const el = document.getElementById(id);
            if (el) el.textContent = fmt(patch[key], dec);
        }
    }
}

// Helpers LIVE
function appendUnique(buf, x, y) {
    const last = buf.length ? buf[buf.length - 1] : null;
    if (last && x <= last.x) {
        if (x === last.x) last.y = y;
        return;
    }
    buf.push({ x, y });
}

function applySnapshotToBuffers(tr, d, tms) {
    const t = tms ?? (d.ts ? new Date(d.ts).getTime() : Date.now());
    if (tr === 'tr1') {
        appendUnique(bufs.p1, t, d.p_kw ?? null);
        appendUnique(bufs.u1_12, t, d.u12_v ?? null);
        appendUnique(bufs.u1_23, t, d.u23_v ?? null);
        appendUnique(bufs.u1_31, t, d.u31_v ?? null);
        appendUnique(bufs.pf1, t, d.pf ?? null); // Ajout pour le graphique PF
        updateKPIs({ t1_p_kw: d.p_kw, t1_q_kvar: d.q_kvar, t1_pf: d.pf, t1_u12_v: d.u12_v, t1_u23_v: d.u23_v, t1_u31_v: d.u31_v, t1_i1_a: d.i1_a, t1_i2_a: d.i2_a, t1_i3_a: d.i3_a, t1_e_kwh: d.e_kwh });
    } else {
        appendUnique(bufs.p2, t, d.p_kw ?? null);
        appendUnique(bufs.u2_12, t, d.u12_v ?? null);
        appendUnique(bufs.u2_23, t, d.u23_v ?? null);
        appendUnique(bufs.u2_31, t, d.u31_v ?? null);
        appendUnique(bufs.pf2, t, d.pf ?? null); // Ajout pour le graphique PF
        updateKPIs({ t2_p_kw: d.p_kw, t2_q_kvar: d.q_kvar, t2_pf: d.pf, t2_u12_v: d.u12_v, t2_u23_v: d.u23_v, t2_u31_v: d.u31_v, t2_i1_a: d.i1_a, t2_i2_a: d.i2_a, t2_i3_a: d.i3_a, t2_e_kwh: d.e_kwh });
    }
}

// Polling adaptatif
function pollSecsForWindow(mins) {
    if (mins <= 15) return 1;
    if (mins <= 60) return 4;
    if (mins <= 240) return 10;
    if (mins <= 1440) return 15;
    return 20;
}

export function recomputeAdaptivePolling() {
    const w = state.win;
    const mins = Math.min(w.p1, w.u1, w.pf1, w.p2, w.u2, w.pf2);
    const secs = pollSecsForWindow(mins);
    const wanted = secs * 1000;
    if (state.pollMs !== wanted) {
        state.pollMs = wanted;
        stopPolling();
        scheduleNextPoll();
    }
}

// setTimeout sans backlog
let pollTimer = null;
function stopPolling() { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }
function scheduleNextPoll() { pollTimer = setTimeout(pollOnce, state.pollMs); }

// Boucle polling
export async function pollOnce() {
    if (!state.apiBase) { setConn(false, "API non configurée"); scheduleNextPoll(); return; }

    try {
        const [raw1, raw2] = await Promise.all([
            fetchJSON(`${state.apiBase}/tr1/snapshot`).catch(e => { setConn(false, `TR1 API: ${e.message}`); return null; }),
            fetchJSON(`${state.apiBase}/tr2/snapshot`).catch(e => { setConn(false, `TR2 API: ${e.message}`); return null; })
        ]);

        const s1 = raw1 ? normalizeSnapshot(raw1) : null;
        const s2 = raw2 ? normalizeSnapshot(raw2) : null;

        if (s1) applySnapshotToBuffers('tr1', s1);
        if (s2) applySnapshotToBuffers('tr2', s2);

        if (s1 || s2) setConn(true);

        prune();
        refreshCharts();
        $('#last-update').textContent = new Date().toLocaleString('fr-FR');
        hideLoader();
    } catch {
        setConn(false, "Erreur de l'API");
        hideLoader();
    } finally {
        scheduleNextPoll();
    }
}

export async function startPolling() {
    if (!state.apiBase) { setConn(false, "API non configurée"); return; }

    recomputeAdaptivePolling();

    if (state.initialLoad) {
        $('#loader').style.display = 'block';
    }

    stopPolling();

    if (state.initialLoad) {
        try {
            await Promise.all([loadSeries(1), loadSeries(2)]);
            refreshCharts();
        } catch (e) {
            console.error("Erreur chargement historique", e);
            setConn(false, "Erreur historique");
        } finally {
            hideLoader();
        }
    }

    scheduleNextPoll();
    if (!state.initialLoad) {
        pollOnce();
    }
}

// Visibilité onglet
export function attachVisibilityHandler() {
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            stopPolling();
        } else {
            // Re-sync complet au retour sur l'onglet
            state.initialLoad = true;
            await startPolling();
        }
    });
}