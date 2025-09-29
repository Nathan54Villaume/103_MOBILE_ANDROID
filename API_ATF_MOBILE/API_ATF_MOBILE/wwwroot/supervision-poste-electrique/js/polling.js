import { $, fmt } from './utils.js';
import { state, bufs, prune } from './state.js';
import { fetchJSON, normalizeSnapshot, loadSeries } from './api.js';
import { refreshCharts } from './charts.js';
import { Kpi } from './kpi.js';
import { showLoader as uiShowLoader, hideLoader as uiHideLoader, showToast } from './ui.js';

// Connexion indicator --------------------------------------------------------
export function setConn(connected, message = '') {
  const led = $('#conn-led');
  const txt = $('#conn-text');
  if (!led || !txt) return;
  led.style.backgroundColor = connected ? '#10b981' : '#ef4444';
  txt.textContent = connected ? 'Connecté' : (message || 'Déconnecté');
  txt.title = connected ? '' : message;
}

function finishInitialLoad() {
  if (!state.initialLoad) return;
  state.initialLoad = false;
  uiHideLoader();
}

let lastErrorToastTs = 0;

// ---------------------------------------------------------------------------
export function updateKPIs(patch) {
  const map = [
    ['t1_p_kw', 't1-p', 1], ['t1_q_kvar', 't1-q', 1], ['t1_pf', 't1-pf', 3],
    ['t1_u12_v', 't1-u12', 0], ['t1_u23_v', 't1-u23', 0], ['t1_u31_v', 't1-u31', 0],
    ['t1_i1_a', 't1-i1', 1], ['t1_i2_a', 't1-i2', 1], ['t1_i3_a', 't1-i3', 1],
    ['t1_e_kwh', 't1-e', 0],
    ['t2_p_kw', 't2-p', 1], ['t2_q_kvar', 't2-q', 1], ['t2_pf', 't2-pf', 3],
    ['t2_u12_v', 't2-u12', 0], ['t2_u23_v', 't2-u23', 0], ['t2_u31_v', 't2-u31', 0],
    ['t2_i1_a', 't2-i1', 1], ['t2_i2_a', 't2-i2', 1], ['t2_i3_a', 't2-i3', 1],
    ['t2_e_kwh', 't2-e', 0],
    ['t1_p_kw_avg', 't1-p-avg', 1], ['t1_p_kw_max', 't1-p-max', 1],
    ['t1_q_kvar_avg', 't1-q-avg', 1], ['t1_q_kvar_max', 't1-q-max', 1],
    ['t1_u12_v_avg', 't1-u12-avg', 0], ['t1_u12_v_max', 't1-u12-max', 0],
    ['t1_u23_v_avg', 't1-u23-avg', 0], ['t1_u23_v_max', 't1-u23-max', 0],
    ['t1_u31_v_avg', 't1-u31-avg', 0], ['t1_u31_v_max', 't1-u31-max', 0],
    ['t1_i1_a_avg', 't1-i1-avg', 1], ['t1_i1_a_max', 't1-i1-max', 1],
    ['t1_i2_a_avg', 't1-i2-avg', 1], ['t1_i2_a_max', 't1-i2-max', 1],
    ['t1_i3_a_avg', 't1-i3-avg', 1], ['t1_i3_a_max', 't1-i3-max', 1],
    ['t2_p_kw_avg', 't2-p-avg', 1], ['t2_p_kw_max', 't2-p-max', 1],
    ['t2_q_kvar_avg', 't2-q-avg', 1], ['t2_q_kvar_max', 't2-q-max', 1],
    ['t2_u12_v_avg', 't2-u12-avg', 0], ['t2_u12_v_max', 't2-u12-max', 0],
    ['t2_u23_v_avg', 't2-u23-avg', 0], ['t2_u23_v_max', 't2-u23-max', 0],
    ['t2_u31_v_avg', 't2-u31-avg', 0], ['t2_u31_v_max', 't2-u31-max', 0],
    ['t2_i1_a_avg', 't2-i1-avg', 1], ['t2_i1_a_max', 't2-i1-max', 1],
    ['t2_i2_a_avg', 't2-i2-avg', 1], ['t2_i2_a_max', 't2-i2-max', 1],
    ['t2_i3_a_avg', 't2-i3-avg', 1], ['t2_i3_a_max', 't2-i3-max', 1],
    ['t1_pf_avg', 't1-pf-avg', 3], ['t1_pf_min', 't1-pf-min', 3],
    ['t2_pf_avg', 't2-pf-avg', 3], ['t2_pf_min', 't2-pf-min', 3],
  ];
  for (const [key, id, dec] of map) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt(patch[key], dec);
    }
  }
  if ('t1_pf_avg' in patch || 't1_pf_min' in patch) {
    const row = document.getElementById('t1-pf-stats');
    if (row) row.classList.remove('hidden');
  }
  if ('t2_pf_avg' in patch || 't2_pf_min' in patch) {
    const row = document.getElementById('t2-pf-stats');
    if (row) row.classList.remove('hidden');
  }
}

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
  const target = tr === 'tr1'
    ? { p: 'p1', q: 'q1', pf: 'pf1', u12: 'u1_12', u23: 'u1_23', u31: 'u1_31', i1: 'i1_1', i2: 'i1_2', i3: 'i1_3' }
    : { p: 'p2', q: 'q2', pf: 'pf2', u12: 'u2_12', u23: 'u2_23', u31: 'u2_31', i1: 'i2_1', i2: 'i2_2', i3: 'i2_3' };

  appendUnique(bufs[target.p], t, d.p_kw ?? null);
  appendUnique(bufs[target.q], t, d.q_kvar ?? null);
  appendUnique(bufs[target.pf], t, d.pf ?? null);
  appendUnique(bufs[target.u12], t, d.u12_v ?? null);
  appendUnique(bufs[target.u23], t, d.u23_v ?? null);
  appendUnique(bufs[target.u31], t, d.u31_v ?? null);
  appendUnique(bufs[target.i1], t, d.i1_a ?? null);
  appendUnique(bufs[target.i2], t, d.i2_a ?? null);
  appendUnique(bufs[target.i3], t, d.i3_a ?? null);

  const ns = tr === 'tr1' ? 'tr1' : 'tr2';
  Kpi.update(`${ns}.p_kw`, { value: d.p_kw, avg: d.p_kw_avg, max: d.p_kw_max, ts: t, unit: 'kW' });
  Kpi.update(`${ns}.q_kvar`, { value: d.q_kvar, avg: d.q_kvar_avg, max: d.q_kvar_max, ts: t, unit: 'kvar' });
  Kpi.update(`${ns}.pf`, { value: d.pf, avg: d.pf_avg, max: d.pf_max, min: d.pf_min, ts: t });
  Kpi.update(`${ns}.e_kwh`, { value: d.e_kwh, ts: t, unit: 'kWh' });
  ['u12', 'u23', 'u31'].forEach((phase, idx) => {
    const key = `${ns}.u${idx + 1}`;
    const mapKey = phase === 'u12' ? 'u12_v' : phase === 'u23' ? 'u23_v' : 'u31_v';
    Kpi.update(key, { value: d[mapKey], avg: d[`${mapKey}_avg`], max: d[`${mapKey}_max`], ts: t, unit: 'V' });
  });
  ['i1', 'i2', 'i3'].forEach((phase, idx) => {
    const key = `${ns}.i${idx + 1}`;
    const mapKey = `${phase}_a`;
    Kpi.update(key, { value: d[mapKey], avg: d[`${mapKey}_avg`], max: d[`${mapKey}_max`], ts: t, unit: 'A' });
  });
}

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

let pollTimer = null;
let visibilityPaused = false;
function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}
function scheduleNextPoll(force = false) {
  stopPolling();
  const delay = force === true ? 200 : (typeof force === 'number' ? force : state.pollMs);
  pollTimer = setTimeout(pollOnce, delay);
}

export async function pollOnce() {
  if (!state.apiBase) { setConn(false, 'API non configurée'); scheduleNextPoll(); return; }

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
    finishInitialLoad();
    
    // Programmer le prochain polling
    scheduleNextPoll();
  } catch (err) {
    console.error('[polling] erreur', err);
    setConn(false, 'Erreur de communication');
    const now = Date.now();
    if (now - lastErrorToastTs > 10_000) {
      showToast("Erreur de communication avec l'API", { variant: 'error', duration: 5000 });
      lastErrorToastTs = now;
    }
    finishInitialLoad();
    
    // Programmer le prochain polling même en cas d'erreur
    scheduleNextPoll();
  }
}

export async function startPolling() {
  if (!state.apiBase) { setConn(false, 'API non configurée'); return; }

  recomputeAdaptivePolling();
  stopPolling();

  if (state.initialLoad) {
    uiShowLoader("Chargement de l'historique...");
    const loaderText = document.querySelector('#loader-text');
    if (loaderText) loaderText.textContent = "Chargement de l'historique...";
  }

  if (state.initialLoad) {
    try {
      const loaderText = document.querySelector('#loader-text');
      if (loaderText) loaderText.textContent = 'Chargement données TR1...';
      await loadSeries(1);
      if (loaderText) loaderText.textContent = 'Chargement données TR2...';
      await loadSeries(2);
      if (loaderText) loaderText.textContent = 'Mise à jour des graphiques...';
      refreshCharts();
    } catch (err) {
      console.error('[polling] historique echoue', err);
      setConn(false, 'Erreur historique');
      const now = Date.now();
      if (now - lastErrorToastTs > 10_000) {
        showToast("Erreur de chargement de l'historique", { variant: 'error', duration: 5000 });
        lastErrorToastTs = now;
      }
    } finally {
      finishInitialLoad();
    }
  }

  scheduleNextPoll();
  if (!state.initialLoad) {
    pollOnce();
  }
}

export function attachVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      visibilityPaused = true;
      stopPolling();
    } else if (visibilityPaused) {
      visibilityPaused = false;
      scheduleNextPoll(true);
    }
  });
}
