import { fetchSignals } from './api.js';
import { getChart } from '../charts/index.js';

let menuElement = null;
let backdropHandler = null;
let activeChartKey = null;
let focusRestore = null;

function closeMenu() {
  if (!menuElement) return;
  menuElement.remove();
  menuElement = null;
  activeChartKey = null;
  document.removeEventListener('pointerdown', backdropHandler, true);
  document.removeEventListener('keydown', handleKeydown, true);
  backdropHandler = null;
  if (focusRestore) {
    focusRestore.focus({ preventScroll: true });
    focusRestore = null;
  }
}

function handleKeydown(evt) {
  if (evt.key === 'Escape') {
    evt.preventDefault();
    closeMenu();
  }
}

function positionMenu(el, x, y) {
  const menuRect = el.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = x;
  let top = y;
  if (left + menuRect.width > viewportWidth - 8) {
    left = viewportWidth - menuRect.width - 8;
  }
  if (top + menuRect.height > viewportHeight - 8) {
    top = viewportHeight - menuRect.height - 8;
  }
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

function renderSignals(listEl, signals, selected) {
  listEl.innerHTML = '';
  const selection = new Set(selected);
  signals.forEach((sig, idx) => {
    const id = `${sig.id}-${idx}-${Date.now()}`;
    const label = document.createElement('label');
    label.setAttribute('role', 'menuitemcheckbox');
    label.setAttribute('aria-checked', selection.has(sig.id) ? 'true' : 'false');
    label.className = 'contextmenu-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = sig.id;
    checkbox.checked = selection.has(sig.id) || Boolean(sig.default && selection.size === 0);
    checkbox.id = id;
    checkbox.addEventListener('change', () => {
      label.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');
    });
    const text = document.createElement('span');
    text.textContent = sig.label + (sig.unit ? ` (${sig.unit})` : '');
    label.append(checkbox, text);
    listEl.appendChild(label);
  });
  const firstInput = listEl.querySelector('input[type="checkbox"]');
  if (firstInput) firstInput.focus({ preventScroll: true });
}

async function loadSignals(listEl, errorEl, retryBtn, chartKey, initialSelection) {
  errorEl.classList.add('hidden');
  retryBtn.classList.add('hidden');
  listEl.setAttribute('aria-busy', 'true');
  try {
    const signals = await fetchSignals(chartKey, { force: false });
    renderSignals(listEl, signals, initialSelection);
  } catch (err) {
    console.error('[contextmenu] fetch signals', err);
    errorEl.classList.remove('hidden');
    retryBtn.classList.remove('hidden');
  } finally {
    listEl.removeAttribute('aria-busy');
  }
}

function openMenu(detail) {
  console.log('[contextmenu] openMenu called with detail:', detail);
  closeMenu();
  const tpl = document.getElementById('contextmenu-template');
  console.log('[contextmenu] Template found:', !!tpl);
  if (!tpl) {
    console.error('[contextmenu] Template not found!');
    return;
  }
  const fragment = tpl.content.cloneNode(true);
  menuElement = fragment.querySelector('.contextmenu-panel');
  console.log('[contextmenu] Menu element created:', !!menuElement);
  if (!menuElement) {
    console.error('[contextmenu] Menu panel not found in template!');
    return;
  }
  activeChartKey = detail.chartKey;
  focusRestore = detail.canvas;

  document.body.appendChild(menuElement);
  positionMenu(menuElement, detail.clientX, detail.clientY);

  const listEl = menuElement.querySelector('[data-role="list"]');
  const errorEl = menuElement.querySelector('.contextmenu-error');
  const retryBtn = menuElement.querySelector('[data-role="retry"]');
  const applyBtn = menuElement.querySelector('[data-role="apply"]');
  const closeBtn = menuElement.querySelector('.contextmenu-close');

  // Utiliser le nouveau système de charts
  const chartInstance = getChart(detail.chartKey);
  const selected = chartInstance?.host?.getCurrentSignals() || detail.signals || [];

  const applySelection = () => {
    const inputs = menuElement.querySelectorAll('input[type="checkbox"]');
    const chosen = Array.from(inputs).filter(input => input.checked).map(input => input.value);
    
    // Utiliser le nouveau système pour mettre à jour les signaux
    if (chartInstance?.host) {
      chartInstance.host.updateSignals(chosen);
    }
    
    closeMenu();
  };

  applyBtn.addEventListener('click', applySelection);
  closeBtn.addEventListener('click', closeMenu);
  retryBtn.addEventListener('click', () => loadSignals(listEl, errorEl, retryBtn, detail.chartKey, selected));

  backdropHandler = (evt) => {
    if (menuElement && !menuElement.contains(evt.target)) {
      closeMenu();
    }
  };

  document.addEventListener('pointerdown', backdropHandler, true);
  document.addEventListener('keydown', handleKeydown, true);

  loadSignals(listEl, errorEl, retryBtn, detail.chartKey, selected);
}

document.addEventListener('chart:contextmenu', (evt) => {
  console.log('[contextmenu] Received chart:contextmenu event:', evt);
  const detail = evt.detail || {};
  console.log('[contextmenu] Event detail:', detail);
  if (!detail.chartKey) {
    console.log('[contextmenu] No chartKey in event detail, aborting');
    return;
  }
  console.log('[contextmenu] Opening menu for chart:', detail.chartKey);
  openMenu(detail);
});

export function initContextMenus() {
  // Intentionally empty: module side-effects attach listeners.
}

export function closeContextMenu() {
  closeMenu();
}
