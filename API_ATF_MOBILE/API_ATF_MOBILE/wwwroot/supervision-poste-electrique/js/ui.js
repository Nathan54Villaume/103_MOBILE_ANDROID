let toastId = 0;
const toastRoot = document.getElementById('toast-layer');
const toastTemplate = document.getElementById('toast-template');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');

function buildToast(message, variant) {
  if (!toastTemplate || !toastRoot) return null;
  const fragment = toastTemplate.content.cloneNode(true);
  const toast = fragment.querySelector('.toast');
  const text = fragment.querySelector('[data-role="message"]');
  const closeBtn = fragment.querySelector('.toast-close');
  toast.dataset.toastId = String(++toastId);
  toast.dataset.variant = variant;
  text.textContent = message;
  closeBtn.addEventListener('click', () => dismissToast(toast.dataset.toastId));
  return toast;
}

export function showToast(message, { variant = 'info', duration = 4000 } = {}) {
  if (!toastRoot) return null;
  const toast = buildToast(message, variant);
  if (!toast) return null;
  toastRoot.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => dismissToast(toast.dataset.toastId), duration);
  }
  return toast.dataset.toastId;
}

export function dismissToast(id) {
  if (!toastRoot || !id) return;
  const toast = toastRoot.querySelector(`.toast[data-toast-id="${id}"]`);
  if (toast) toast.remove();
}

export function showLoader(message = 'Chargement en cours...') {
  if (!loader) return;
  loader.classList.add('active');
  if (loaderText) loaderText.textContent = message;
}

export function hideLoader() {
  if (loader) loader.classList.remove('active');
}

export function announce(message, politeness = 'polite') {
  const live = document.createElement('div');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', politeness);
  live.className = 'sr-only';
  live.textContent = message;
  document.body.appendChild(live);
  setTimeout(() => live.remove(), 1000);
}
