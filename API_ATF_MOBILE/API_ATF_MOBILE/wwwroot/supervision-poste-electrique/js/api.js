import { lowerKeys, fetchJSON } from './utils.js';
import { state, bufs } from './state.js';

// ---------- Normalisation snapshot (instantanés + stats)
export function normalizeSnapshot(d) {
    const m = lowerKeys(d);

    // Instantanés
    const snap = {
        ts: m.ts ?? m.ts_utc ?? null,
        p_kw: m.p_kw ?? null,
        q_kvar: m.q_kvar ?? null,
        pf: m.pf ?? null,
        e_kwh: m.e_kwh ?? null,

        // U12/U23/U31 — tolère u1_v/u2_v/u3_v
        u12_v: m.u12_v ?? m.u1_v ?? null,
        u23_v: m.u23_v ?? m.u2_v ?? null,
        u31_v: m.u31_v ?? m.u3_v ?? null,

        i1_a: m.i1_a ?? null,
        i2_a: m.i2_a ?? null,
        i3_a: m.i3_a ?? null,
    };

    // Statistiques (issues d'ENERGY_SNAPSHOT)
    // P / Q
    snap.p_kw_avg = m.p_kw_avg ?? null;
    snap.p_kw_max = m.p_kw_max ?? null;
    snap.q_kvar_avg = m.q_kvar_avg ?? null;
    snap.q_kvar_max = m.q_kvar_max ?? null;

    // U (moy/max sur U12/U23/U31)
    snap.u12_v_avg = m.u12_v_avg ?? null;
    snap.u12_v_max = m.u12_v_max ?? null;
    snap.u23_v_avg = m.u23_v_avg ?? null;
    snap.u23_v_max = m.u23_v_max ?? null;
    snap.u31_v_avg = m.u31_v_avg ?? null;
    snap.u31_v_max = m.u31_v_max ?? null;

    // I (moy/max sur I1/I2/I3)
    snap.i1_a_avg = m.i1_a_avg ?? null;
    snap.i1_a_max = m.i1_a_max ?? null;
    snap.i2_a_avg = m.i2_a_avg ?? null;
    snap.i2_a_max = m.i2_a_max ?? null;
    snap.i3_a_avg = m.i3_a_avg ?? null;
    snap.i3_a_max = m.i3_a_max ?? null;

    // (optionnel) PF si un jour tu l’exposes via l’API ou le calcules côté client
    snap.pf_avg = m.pf_avg ?? null;
    snap.pf_min = m.pf_min ?? null;

    return snap;
}

// ---------- Normalisation séries (X/Y → ms/number)
function normPoint(p) {
    const x = p.x ?? p.X ?? null;
    const y = p.y ?? p.Y ?? null;
    return x ? { x: new Date(x).getTime(), y: Number(y) } : null;
}
function normalizeSeriesDto(dto) {
    const m = lowerKeys(dto);
    const pick = k => {
        const arr = m[k] ?? [];
        const out = [];
        for (const p of arr) {
            const np = normPoint(p);
            if (np) out.push(np);
        }
        return out;
    };
    return {
        p_kw: pick('p_kw'),
        pf: pick('pf'),
        u12_v: pick('u12_v'),
        u23_v: pick('u23_v'),
        u31_v: pick('u31_v'),
        i1_a: pick('i1_a'),
        i2_a: pick('i2_a'),
        i3_a: pick('i3_a'),
        e_kwh: pick('e_kwh'),
    };
}

// ---------- Resampling "ZOH" (minute → cadence polling) pour >15 min
function resampleZOH(series, cadenceSec) {
    if (!series || !series.length) return [];
    const step = cadenceSec * 1000;
    const start = Math.floor(series[0].x / step) * step;
    const end = Math.floor(series[series.length - 1].x / step) * step;

    const out = [];
    let i = 0;
    let lastVal = series[0].y;

    for (let t = start; t <= end; t += step) {
        while (i + 1 < series.length && series[i + 1].x <= t) {
            i++; lastVal = series[i].y;
        }
        out.push({ x: t, y: lastVal });
    }
    return out;
}

// ---------- Chargement séries TR1/TR2 alignées
export async function loadSeries(trId) {
    const pKey = trId === 1 ? 'win_p1' : 'win_p2';
    const uKey = trId === 1 ? 'win_u1' : 'win_u2';
    const pfKey = trId === 1 ? 'win_pf1' : 'win_pf2';

    const pMin = Number(localStorage.getItem(pKey) || 15);
    const uMin = Number(localStorage.getItem(uKey) || 15);
    const pfMin = Number(localStorage.getItem(pfKey) || 15);

    const winMin = Math.max(pMin, uMin, pfMin);
    const cadenceSec =
        (winMin <= 15) ? 1 :
            (winMin <= 60) ? 4 :
                (winMin <= 240) ? 10 :
                    (winMin <= 1440) ? 15 : 20;

    const agg = (winMin <= 15) ? 'second' : 'minute';

    const url = new URL(`${state.apiBase}/tr${trId}/series`);
    url.searchParams.set('minutes', String(winMin));
    if (agg === 'second') {
        url.searchParams.set('maxPoints', String(winMin * 60 + 60));
    } else {
        url.searchParams.set('maxPoints', String(winMin + 5));
    }
    url.searchParams.set('downsample', 'false');

    const raw = await fetchJSON(url.toString());
    const s = normalizeSeriesDto(raw);

    const align = (arr) => {
        if (!arr || !arr.length) return [];
        if (agg === 'second') return arr;
        return resampleZOH(arr, cadenceSec);
    };

    const pkw = align(s.p_kw);
    const u12 = align(s.u12_v);
    const u23 = align(s.u23_v);
    const u31 = align(s.u31_v);
    const pf = align(s.pf);

    if (trId === 1) {
        bufs.p1 = pkw;
        bufs.u1_12 = u12;
        bufs.u1_23 = u23;
        bufs.u1_31 = u31;
        bufs.pf1 = pf;
    } else {
        bufs.p2 = pkw;
        bufs.u2_12 = u12;
        bufs.u2_23 = u23;
        bufs.u2_31 = u31;
        bufs.pf2 = pf;
    }
}

// export utils si besoin
export { fetchJSON };
