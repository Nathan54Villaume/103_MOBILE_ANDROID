import { state, setApiBase, resetApiBaseToDefault } from './state.js';
import { pingApi } from './api.js';
import { showToast, announce } from './ui.js';

const dialog = document.getElementById('settings-dialog');
const btnOpen = document.getElementById('btn-settings');
const inputBase = document.getElementById('settings-api-base');
const feedback = document.getElementById('settings-feedback');
const testBtn = document.getElementById('settings-test');
const resetBtn = document.getElementById('settings-reset');
const form = dialog?.querySelector('form');

function ensureDialogPolyfill() {
  if (!dialog) return;
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = () => dialog.setAttribute('open', 'open');
    dialog.close = () => dialog.removeAttribute('open');
  }
}

function setFeedback(message, variant = 'info') {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.variant = variant;
}

async function handleTest() {
  if (!inputBase || !testBtn) return;
  const url = inputBase.value.trim();
  if (!url) {
    setFeedback('Veuillez saisir une URL valide', 'error');
    inputBase.focus();
    return;
  }
  testBtn.disabled = true;
  setFeedback('Test en cours...', 'info');
  try {
    const ok = await pingApi(url);
    if (ok) {
      setFeedback('API joignable', 'success');
      showToast('Connexion API réussie', { variant: 'success' });
    } else {
      setFeedback('Aucune réponse - vérifier l\'adresse', 'error');
      showToast('Échec du test API', { variant: 'error' });
    }
  } catch (error) {
    console.error('[settings] test API', error);
    setFeedback('Erreur pendant le test', 'error');
    showToast('Erreur pendant le test API', { variant: 'error' });
  } finally {
    testBtn.disabled = false;
  }
}

function handleReset() {
  resetApiBaseToDefault();
  if (inputBase) inputBase.value = state.apiBase;
  setFeedback('Adresse réinitialisée', 'info');
  announce('Adresse API réinitialisée');
  document.dispatchEvent(new CustomEvent('settings:changed', { detail: { apiBase: state.apiBase, reset: true } }));
}

function handleOpen() {
  if (!dialog) return;
  if (inputBase) inputBase.value = state.apiBase;
  setFeedback('');
  ensureDialogPolyfill();
  dialog.showModal();
}

function handleSubmit(evt) {
  evt.preventDefault();
  if (!inputBase) return;
  const url = inputBase.value.trim();
  if (!url) {
    setFeedback('Adresse API requise', 'error');
    inputBase.focus();
    return;
  }
  setApiBase(url);
  setFeedback('Adresse enregistrée', 'success');
  showToast('Nouvelle adresse API enregistrée', { variant: 'success' });
  announce('Adresse API mise à jour');
  document.dispatchEvent(new CustomEvent('settings:changed', { detail: { apiBase: state.apiBase } }));
  dialog.close();
}

export function initSettingsDialog() {
  if (!dialog) return;
  ensureDialogPolyfill();
  if (btnOpen) btnOpen.addEventListener('click', handleOpen);
  if (testBtn) testBtn.addEventListener('click', handleTest);
  if (resetBtn) resetBtn.addEventListener('click', handleReset);
  if (form) form.addEventListener('submit', handleSubmit);
}
