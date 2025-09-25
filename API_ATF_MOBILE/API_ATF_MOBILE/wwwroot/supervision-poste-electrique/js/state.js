// État global + buffers + utils
export const state = {
    apiBase: localStorage.getItem('apiBase') || '',
    pollMs: 1000,
    initialLoad: true,
    win: {
        p1: Number(localStorage.getItem('win_p1') || 15),
        u1: Number(localStorage.getItem('win_u1') || 15),
        pf1: Number(localStorage.getItem('win_pf1') || 15),
        p2: Number(localStorage.getItem('win_p2') || 15),
        u2: Number(localStorage.getItem('win_u2') || 15),
        pf2: Number(localStorage.getItem('win_pf2') || 15),
    }
};

export const MAX_MIN = 2880;

export const bufs = {
    p1: [], u1_12: [], u1_23: [], u1_31: [], pf1: [],
    p2: [], u2_12: [], u2_23: [], u2_31: [], pf2: [],
};

export function cutoffTs(m) { return Date.now() - m * 60 * 1000; }
export function prune() {
    const c = cutoffTs(MAX_MIN);
    for (const k in bufs) while (bufs[k].length && bufs[k][0].x < c) bufs[k].shift();
}
export function filt(arr, m) {
    const c = cutoffTs(m); let i = 0;
    while (i < arr.length && arr[i].x < c) i++;
    return arr.slice(i);
}

export function downsample(data, threshold) {
    if (data.length <= threshold) return data;
    const sampled = [];
    const bucketSize = (data.length - 2) / (threshold - 2);
    let a = 0; sampled.push(data[a]);
    for (let i = 0; i < threshold - 2; i++) {
        const avgStart = Math.floor((i + 1) * bucketSize) + 1;
        const avgEnd = Math.floor((i + 2) * bucketSize) + 1;
        const len = avgEnd - avgStart; if (len <= 0) continue;
        let ax = data[a].x, ay = data[a].y, avgx = 0, avgy = 0;
        for (let j = avgStart; j < avgEnd; j++) { avgx += data[j].x; avgy += data[j].y; }
        avgx /= len; avgy /= len;
        const rOff = Math.floor(i * bucketSize) + 1;
        const rTo = Math.floor((i + 1) * bucketSize) + 1;
        let maxArea = -1, nextA = -1;
        for (let k = rOff; k < rTo; k++) {
            const area = Math.abs((ax - avgx) * (data[k].y - ay) - (ax - data[k].x) * (avgy - ay)) * 0.5;
            if (area > maxArea) { maxArea = area; nextA = k; }
        }
        sampled.push(data[nextA]); a = nextA;
    }
    sampled.push(data[data.length - 1]); return sampled;
}

export const CHART_POINT_THRESHOLD = 10000;