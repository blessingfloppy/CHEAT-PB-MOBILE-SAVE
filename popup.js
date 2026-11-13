'use strict';

const output = document.querySelector('#status');
const armButton = document.querySelector('#arm');
const stopButton = document.querySelector('#stop');

const currentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const showStatus = async () => {
  const tab = await currentTab();
  if (!tab?.id) { output.textContent = 'Tab tidak ditemukan.'; return; }
  const key = 'status_' + tab.id;
  const saved = (await chrome.storage.local.get(key))[key];
  output.textContent = saved?.detail || 'Belum disiapkan.';
};

const send = async type => {
  const tab = await currentTab();
  if (!tab?.id) { output.textContent = 'Tab tidak ditemukan.'; return; }
  output.textContent = 'Memproses…';
  const response = await chrome.runtime.sendMessage({ type, tabId: tab.id });
  output.textContent = response?.ok ? (type === 'arm' ? 'Siap. Masuk match sekarang.' : 'Dibatalkan.') : (response?.error || 'Gagal.');
};

armButton.addEventListener('click', () => send('arm').catch(error => { output.textContent = error.message; }));
stopButton.addEventListener('click', () => send('stop').catch(error => { output.textContent = error.message; }));
showStatus().catch(error => { output.textContent = error.message; });
