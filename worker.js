'use strict';

/*
 * Bundle patcher for pbmobile.app.
 *
 * It rewrites only the "test build" guards that keep window.G / window.RND
 * private on production hosts. Anti-cheat removal is handled by stealth.js at
 * the WebSocket layer, so this file deliberately does NOT touch the game's
 * detector functions (their minified names change on every deploy).
 *
 * All replacements are literal and version-tolerant: missing literals are
 * skipped instead of aborting the page.
 */

const sessions = new Map();
const gamePattern = '*pbmobile.app/static/game/bundle.js*';
const matchPattern = '*pbmobile.app/jogo*';
const gateG = ['Ka&&(window.G=', '!1&&(window.G='];
const openG = '!0&&(window.G=';
const gateRnd = 'Ka&&(window.RND=';
const openRnd = '!0&&(window.RND=';
const autoKey = tabId => 'auto_' + tabId;

const isGameUrl = url => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      (parsed.hostname === 'pbmobile.app' || parsed.hostname.endsWith('.pbmobile.app'));
  } catch (_) {
    return false;
  }
};

const isLobbyUrl = url => {
  if (!isGameUrl(url)) return false;
  try { return !new URL(url).pathname.startsWith('/jogo'); } catch (_) { return false; }
};

const setStatus = async (tabId, status, detail = '') => {
  await chrome.storage.local.set({ ['status_' + tabId]: { status, detail, at: Date.now() } });
  await chrome.action.setBadgeText({ tabId, text: status === 'ready' ? 'ON' : status === 'patched' ? 'OK' : status === 'error' ? '!' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: status === 'error' ? '#b13c3c' : '#565656' });
};

const detach = async (tabId, status, detail = '') => {
  const session = sessions.get(tabId);
  if (session) {
    session.done = true;
    clearTimeout(session.timer);
    sessions.delete(tabId);
  }
  try { await chrome.debugger.sendCommand({ tabId }, 'Fetch.disable'); } catch (_) {}
  try { await chrome.debugger.sendCommand({ tabId }, 'Network.disable'); } catch (_) {}
  try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  await setStatus(tabId, status, detail);
};

const arm = async (tabId, reload = true) => {
  const tab = await chrome.tabs.get(tabId);
  if (!isGameUrl(tab.url)) return { ok: false, error: 'Buka pbmobile.app dulu.' };
  if (sessions.has(tabId)) return { ok: true };
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Network.setCacheDisabled', { cacheDisabled: true });
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
      patterns: [
        { urlPattern: matchPattern, resourceType: 'Document', requestStage: 'Response' },
        { urlPattern: gamePattern, resourceType: 'Script', requestStage: 'Response' }
      ]
    });
    sessions.set(tabId, { timer: null, done: false, busy: false, networkId: null, documentPatched: false });
    await setStatus(tabId, 'ready', 'Otomatis siap untuk match berikutnya.');
    if (reload) await chrome.tabs.reload(tabId, { bypassCache: true });
    return { ok: true };
  } catch (error) {
    await detach(tabId, 'error', error.message || 'Gagal menyiapkan debugger.');
    return { ok: false, error: error.message || 'Gagal menyiapkan debugger.' };
  }
};

const decodeBody = response => {
  if (!response.base64Encoded) return response.body;
  const binary = atob(response.body);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const encodeBody = text => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
};

const patchMatchDocument = html => html.replace(/<script\b[^>]*>/gi, tag => {
  if (!/\bsrc\s*=\s*["'][^"']*\/static\/game\/bundle\.js(?:\?[^"']*)?["']/i.test(tag)) return tag;
  return tag.replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*')/i, '');
});

const cleanHeaders = headers => (headers || []).filter(header =>
  !['content-length', 'content-encoding', 'transfer-encoding', 'etag', 'content-md5'].includes(header.name.toLowerCase())
);

const patchBundle = source => {
  const applied = [];
  let text = source;
  const matchedG = gateG.find(gate => text.includes(gate));
  if (matchedG) {
    text = text.replace(matchedG, openG);
    applied.push('G');
  } else if (text.includes(openG)) {
    applied.push('G-open');
  }
  if (text.includes(gateRnd)) {
    text = text.replace(gateRnd, openRnd);
    applied.push('RND');
  } else if (text.includes(openRnd)) {
    applied.push('RND-open');
  }
  return { text, applied };
};

const handlePaused = async (tabId, params) => {
  const session = sessions.get(tabId);
  if (!session || session.done) return;
  if (session.busy) {
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId: params.requestId });
    return;
  }
  session.busy = true;
  const target = { tabId };
  const requestId = params.requestId;
  try {
    if (params.responseStatusCode !== 200) {
      await chrome.debugger.sendCommand(target, 'Fetch.continueRequest', { requestId });
      session.busy = false;
      return;
    }
    const response = await chrome.debugger.sendCommand(target, 'Fetch.getResponseBody', { requestId });
    const original = decodeBody(response);
    const isMatchDocument = params.resourceType === 'Document' &&
      new URL(params.request.url).pathname.startsWith('/jogo');
    if (isMatchDocument) {
      const patchedDocument = patchMatchDocument(original);
      await chrome.debugger.sendCommand(target, 'Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: cleanHeaders(params.responseHeaders),
        body: encodeBody(patchedDocument)
      });
      session.documentPatched = patchedDocument !== original;
      session.busy = false;
      await setStatus(tabId, 'ready', session.documentPatched
        ? 'Halaman match disiapkan; menunggu bundle.'
        : 'Halaman match tidak memuat atribut integrity; menunggu bundle.');
      return;
    }

    const result = patchBundle(original);
    session.networkId = params.networkId || null;
    await chrome.debugger.sendCommand(target, 'Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: cleanHeaders(params.responseHeaders),
      body: encodeBody(result.text)
    });

    if (!result.applied.some(name => name === 'G' || name === 'G-open')) {
      await detach(tabId, 'error', 'Gate bundle berubah; bundle asli dipakai, fitur engine nonaktif.');
      return;
    }
    if (!session.networkId) {
      await detach(tabId, 'patched', 'Bundle dikirim (' + result.applied.join('+') + '). Status eksekusi belum terverifikasi.');
      return;
    }
    clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      detach(tabId, 'error', 'Bundle dikirim, tetapi browser tidak mengonfirmasi selesai dimuat.').catch(() => {});
    }, 10000);
  } catch (error) {
    try { await chrome.debugger.sendCommand(target, 'Fetch.continueRequest', { requestId }); } catch (_) {}
    await detach(tabId, 'error', error.message || 'Gagal memproses bundle.');
  }
};

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId == null) return;
  if (method === 'Fetch.requestPaused') {
    handlePaused(source.tabId, params).catch(() => {});
    return;
  }
  const session = sessions.get(source.tabId);
  if (!session || session.done || !session.networkId || params.requestId !== session.networkId) return;
  if (method === 'Network.loadingFinished') {
    clearTimeout(session.timer);
    session.timer = null;
    session.networkId = null;
    session.busy = false;
    setStatus(source.tabId, 'patched', 'Bundle siap; match berikutnya tetap disiapkan.').catch(() => {});
  } else if (method === 'Network.loadingFailed') {
    detach(source.tabId, 'error', 'Bundle gagal dimuat: ' + (params.errorText || 'tidak diketahui')).catch(() => {});
  }
});

chrome.debugger.onDetach.addListener(source => {
  if (source.tabId == null) return;
  const session = sessions.get(source.tabId);
  if (!session || session.done) return;
  clearTimeout(session.timer);
  sessions.delete(source.tabId);
  setStatus(source.tabId, 'error', 'Debugger terlepas sebelum bundle dimuat.').catch(() => {});
});

const autoArmLobby = async (tabId, url) => {
  if (!isLobbyUrl(url) || sessions.has(tabId)) return;
  const saved = await chrome.storage.local.get(autoKey(tabId));
  if (saved[autoKey(tabId)] !== true) return;
  await arm(tabId, false);
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'loading' && changeInfo.status !== 'complete') return;
  autoArmLobby(tabId, tab.url).catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.local.remove([autoKey(tabId), 'status_' + tabId]).catch(() => {});
});

chrome.tabs.query({}).then(tabs => {
  for (const tab of tabs) {
    if (tab.id != null) autoArmLobby(tab.id, tab.url).catch(() => {});
  }
}).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!Number.isInteger(message?.tabId)) return false;
  if (message.type === 'arm') {
    chrome.storage.local.set({ [autoKey(message.tabId)]: true })
      .then(() => arm(message.tabId))
      .then(reply, error => reply({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'stop') {
    chrome.storage.local.remove(autoKey(message.tabId))
      .then(() => detach(message.tabId, 'idle', 'Mode otomatis dimatikan.'))
      .then(() => reply({ ok: true }), error => reply({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
