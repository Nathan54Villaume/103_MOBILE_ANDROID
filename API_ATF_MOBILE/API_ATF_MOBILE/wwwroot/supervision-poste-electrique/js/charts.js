import { $, frTick, frTooltip, displayFormats, timeUnitFor } from './utils.js';
import { state, bufs, downsample, filt, CHART_POINT_THRESHOLD } from './state.js';

function makeChart(ctx, label, yLabel, color, winMin) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label, borderColor: color, data: [],
                borderWidth: 2,
                tension: 0,
                spanGaps: false,
                pointRadius: 0,
                pointHitRadius: 6,
            }]
        },
        options: {
            animation: false, responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#e5e7eb' } }, tooltip: { callbacks: { title: items => items.map(frTooltip) } } },
            scales: {
                x: {
                    type: 'time', time: { unit: timeUnitFor(winMin), displayFormats, tooltipFormat: 'HH:mm' },
                    ticks: { color: '#ccc', callback: (v) => frTick(v) }
                },
                y: { title: { display: true, text: yLabel }, ticks: { color: '#ccc' } }
            }
        }
    });
}

export const chartP1 = makeChart($('#chartP1').getContext('2d'), 'P TR1 (kW)', 'kW', 'rgb(99,102,241)', state.win.p1);
export const chartU1 = new Chart($('#chartU1').getContext('2d'), {
    type: 'line',
    data: {
        datasets: [
            { label: 'U12', borderColor: 'rgb(16,185,129)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U23', borderColor: 'rgb(59,130,246)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U31', borderColor: 'rgb(234,179,8)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
        ]
    },
    options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e5e7eb' } }, tooltip: { callbacks: { title: items => items.map(frTooltip) } } },
        scales: {
            x: { type: 'time', time: { unit: 'minute', displayFormats, tooltipFormat: 'HH:mm' }, ticks: { color: '#ccc', callback: (v) => frTick(v) } },
            y: { title: { display: true, text: 'V' }, ticks: { color: '#ccc' } }
        }
    }
});

export const chartP2 = makeChart($('#chartP2').getContext('2d'), 'P TR2 (kW)', 'kW', 'rgb(239,68,68)', state.win.p2);
export const chartU2 = new Chart($('#chartU2').getContext('2d'), {
    type: 'line',
    data: {
        datasets: [
            { label: 'U12', borderColor: 'rgb(168,85,247)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U23', borderColor: 'rgb(14,165,233)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
            { label: 'U31', borderColor: 'rgb(245,158,11)', data: [], borderWidth: 2, tension: 0, spanGaps: false, pointRadius: 0, pointHitRadius: 6 },
        ]
    },
    options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e5e7eb' } }, tooltip: { callbacks: { title: items => items.map(frTooltip) } } },
        scales: {
            x: { type: 'time', time: { unit: 'minute', displayFormats, tooltipFormat: 'HH:mm' }, ticks: { color: '#ccc', callback: v => frTick(v) } },
            y: { title: { display: true, text: 'V' }, ticks: { color: '#ccc' } }
        }
    }
});

export function refreshCharts() {
    const chartData = {
        p1: downsample(filt(bufs.p1, state.win.p1), CHART_POINT_THRESHOLD),
        u1_12: downsample(filt(bufs.u1_12, state.win.u1), CHART_POINT_THRESHOLD),
        u1_23: downsample(filt(bufs.u1_23, state.win.u1), CHART_POINT_THRESHOLD),
        u1_31: downsample(filt(bufs.u1_31, state.win.u1), CHART_POINT_THRESHOLD),
        p2: downsample(filt(bufs.p2, state.win.p2), CHART_POINT_THRESHOLD),
        u2_12: downsample(filt(bufs.u2_12, state.win.u2), CHART_POINT_THRESHOLD),
        u2_23: downsample(filt(bufs.u2_23, state.win.u2), CHART_POINT_THRESHOLD),
        u2_31: downsample(filt(bufs.u2_31, state.win.u2), CHART_POINT_THRESHOLD),
    };

    chartP1.data.datasets[0].data = chartData.p1;
    chartU1.data.datasets[0].data = chartData.u1_12;
    chartU1.data.datasets[1].data = chartData.u1_23;
    chartU1.data.datasets[2].data = chartData.u1_31;

    chartP2.data.datasets[0].data = chartData.p2;
    chartU2.data.datasets[0].data = chartData.u2_12;
    chartU2.data.datasets[1].data = chartData.u2_23;
    chartU2.data.datasets[2].data = chartData.u2_31;

    chartP1.update('none'); chartU1.update('none'); chartP2.update('none'); chartU2.update('none');
}
