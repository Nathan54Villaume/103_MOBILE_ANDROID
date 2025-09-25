import { lowerKeys, fetchJSON } from './utils.js';
import { state, bufs } from './state.js';

// ---------- Normalisation snapshot
export function normalizeSnapshot(d) {
    const m = lowerKeys(d);
    return {
        ts: m.ts ?? m.ts_utc ?? null,
        p_kw: m.p_kw ?? null,
        q_kvar: m.q_kvar ?? null,
        pf: m.pf ?? null,
        e_kwh: m.e_kwh ?? null,
        u12_v: m.u12_v ?? m.u1_v ?? null,
        u23_v: m.u23_v ?? m.u2_v ?? null,
        u31_v: m.u31_v ?? m.u3_v ?? null,
        i1_a: m.i1_a ?? null,
        i2_a: m.i2_a ?? null,
        i3_a: m.i3_a ?? null,
    };
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
    const pMin = Number(localStorage.getItem(pKey) || 15);
    const uMin = Number(localStorage.getItem(uKey) || 15);

    const winMin = Math.max(pMin, uMin);
    const cadenceSec =
        (winMin <= 15) ? 1 :
            (winMin <= 60) ? 4 :
                (winMin <= 240) ? 10 :
                    (winMin <= 1440) ? 15 : 20;

    // API : second seulement pour ≤15, sinon minute
    const agg = (winMin <= 15) ? 'second' : 'minute';

    const url = new URL(`${state.apiBase}/tr${trId}/series`);
    url.searchParams.set('minutes', String(winMin));
    //url.searchParams.set('agg', agg);
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
        if (agg === 'second') return arr;    // 15 min : pas de modif
        return resampleZOH(arr, cadenceSec); // >15 min : ZOH vers cadence live
    };

    const pkw = align(s.p_kw);
    const u12 = align(s.u12_v);
    const u23 = align(s.u23_v);
    const u31 = align(s.u31_v);

    if (trId === 1) {
        bufs.p1 = pkw;
        bufs.u1_12 = u12;
        bufs.u1_23 = u23;
        bufs.u1_31 = u31;
    } else {
        bufs.p2 = pkw;
        bufs.u2_12 = u12;
        bufs.u2_23 = u23;
        bufs.u2_31 = u31;
    }
}

// export utils si besoin
export { fetchJSON };
