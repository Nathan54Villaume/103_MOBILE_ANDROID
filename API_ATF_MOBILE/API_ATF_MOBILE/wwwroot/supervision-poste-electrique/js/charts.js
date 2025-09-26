// file: js/charts.js
import { $, frTick, frTooltip, displayFormats, timeUnitFor } from './utils.js';
import { state, bufs, downsample, filt, CHART_POINT_THRESHOLD } from './state.js';

/* --- Helpers --- */
function freshCtx(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) throw new Error(`Canvas #${canvasId} introuvable`);
    const existing = Chart.getChart(el);
    if (existing) existing.destroy();
    return el.getContext('2d');
}

function baseOptions(xUnit, yLabel) {
    return {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e5e7eb' } },
            tooltip: { callbacks: { title: (items) => items.map(frTooltip) } }
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: xUnit, displayFormats, tooltipFormat: 'HH:mm' },
                ticks: { color: '#ccc', callback: (v) => frTick(v) }
            },
            y: {
                title: { display: !!yLabel, text: yLabel || '' },
                ticks: { color: '#ccc' }
            }
        }
    };
}

function makeSingleLineChart(canvasId, label, yLabel, color, winMin) {
    const ctx = freshCtx(canvasId);
    const xUnit = timeUnitFor(winMin);
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label,
                borderColor: color,
                data: [],
                borderWidth: 2,
                tension: 0,
                spanGaps: false,
                pointRadius: 0,
                pointHitRadius: 6
            }]
        },
        options: baseOptions(xUnit, yLabel)
    });
}

/* --- Création (en veillant à détruire s'il y en avait déjà) --- */
export const chartP1 = makeSingleLineChart('chartP1', 'P TR1 (kW)', 'kW', 'rgb(99,102,241)', state.win.p1);
export const chartU1 = new Chart(freshCtx('chartU1'), {
    type: 'line',
    data: {
        datasets: [
            { label: 'U12', borderColor: 'rgb(16,185,129)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U23', borderColor: 'rgb(59,130,246)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U31', borderColor: 'rgb(234,179,8)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 }
        ]
    },
    options: baseOptions(timeUnitFor(state.win.u1), 'V')
});
export const chartPF1 = makeSingleLineChart('chartPF1', 'Facteur Puissance TR1', '', 'rgb(22, 163, 74)', state.win.pf1);

export const chartP2 = makeSingleLineChart('chartP2', 'P TR2 (kW)', 'kW', 'rgb(239,68,68)', state.win.p2);
export const chartU2 = new Chart(freshCtx('chartU2'), {
    type: 'line',
    data: {
        datasets: [
            { label: 'U12', borderColor: 'rgb(168,85,247)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U23', borderColor: 'rgb(14,165,233)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U31', borderColor: 'rgb(245,158,11)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 }
        ]
    },
    options: baseOptions(timeUnitFor(state.win.u2), 'V')
});
export const chartPF2 = makeSingleLineChart('chartPF2', 'Facteur Puissance TR2', '', 'rgb(217, 119, 6)', state.win.pf2);

/* --- Mise à jour des données + unité de temps si la fenêtre change --- */
export function refreshCharts() {
    const chartData = {
        p1: downsample(filt(bufs.p1, state.win.p1), CHART_POINT_THRESHOLD),
        u1_12: downsample(filt(bufs.u1_12, state.win.u1), CHART_POINT_THRESHOLD),
        u1_23: downsample(filt(bufs.u1_23, state.win.u1), CHART_POINT_THRESHOLD),
        u1_31: downsample(filt(bufs.u1_31, state.win.u1), CHART_POINT_THRESHOLD),
        pf1: downsample(filt(bufs.pf1, state.win.pf1), CHART_POINT_THRESHOLD),

        p2: downsample(filt(bufs.p2, state.win.p2), CHART_POINT_THRESHOLD),
        u2_12: downsample(filt(bufs.u2_12, state.win.u2), CHART_POINT_THRESHOLD),
        u2_23: downsample(filt(bufs.u2_23, state.win.u2), CHART_POINT_THRESHOLD),
        u2_31: downsample(filt(bufs.u2_31, state.win.u2), CHART_POINT_THRESHOLD),
        pf2: downsample(filt(bufs.pf2, state.win.pf2), CHART_POINT_THRESHOLD)
    };

    // données
    chartP1.data.datasets[0].data = chartData.p1;
    chartU1.data.datasets[0].data = chartData.u1_12;
    chartU1.data.datasets[1].data = chartData.u1_23;
    chartU1.data.datasets[2].data = chartData.u1_31;
    chartPF1.data.datasets[0].data = chartData.pf1;

    chartP2.data.datasets[0].data = chartData.p2;
    chartU2.data.datasets[0].data = chartData.u2_12;
    chartU2.data.datasets[1].data = chartData.u2_23;
    chartU2.data.datasets[2].data = chartData.u2_31;
    chartPF2.data.datasets[0].data = chartData.pf2;

    // unités d’axe X (si la fenêtre a changé entre-temps)
    chartP1.options.scales.x.time.unit = timeUnitFor(state.win.p1);
    chartU1.options.scales.x.time.unit = timeUnitFor(state.win.u1);
    chartPF1.options.scales.x.time.unit = timeUnitFor(state.win.pf1);

    chartP2.options.scales.x.time.unit = timeUnitFor(state.win.p2);
    chartU2.options.scales.x.time.unit = timeUnitFor(state.win.u2);
    chartPF2.options.scales.x.time.unit = timeUnitFor(state.win.pf2);

    // rendu
    chartP1.update('none'); chartU1.update('none'); chartPF1.update('none');
    chartP2.update('none'); chartU2.update('none'); chartPF2.update('none');
}
