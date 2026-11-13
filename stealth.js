'use strict';

/*
 * PemburuHS Stealth Layer
 * -----------------------
 * Runs in the page's MAIN world at document_start, before any game script.
 *
 * The game's client scanner reports flags over the match WebSocket as
 * {"t":"acflag", k, d}. This layer removes those packets at the last possible
 * point (WebSocket.prototype.send) without leaving a footprint the scanner can
 * see: Function.prototype.toString of a Proxy around a native function still
 * returns "function () { [native code] }", which is the exact check the game
 * runs from a clean iframe.
 *
 * Nothing here overrides toString, JSON, Storage, rAF, WebGL or the 2D canvas.
 * No game function is patched by name, so bundle updates do not break it.
 *
 * What it does NOT do: forge server-validated claims. The server owns HP,
 * positions and hit validation; a forged "hit" (weapon relabel, long knife)
 * is detected and banned. Keep the cheat to client-visible features.
 */

(function () {
  if (window.__pbStealth) return;

  var state = {
    installed: false,
    blocked: 0,
    lastBlockedAt: 0,
    flags: {},        // per-kind counter: menu / funcao / camada / combo / ...
    lastFlag: null,   // { k, d, at } of the most recent report that was eaten
    hits: { count: 0, last: null },
    version: '1.2.0'
  };
  // Object, not a function: the scanner dumps non-native window *functions*.
  window.__pbStealth = state;

  // Diagnostics: weapon id actually carried in the match URL.
  try {
    var q = new URLSearchParams(location.search);
    var wp = q.get('weapon');
    if (wp) state.matchWeapon = wp;
    var own = q.get('own');
    if (own !== null) state.matchOwn = own.split(',').filter(Boolean).length;
  } catch (e) {}

  var NATIVE_SEND = null;

  function isAcPayload(data) {
    if (typeof data !== 'string' || data.length < 8) return false;
    if (data.indexOf('acflag') !== -1) return true;
    if (data.indexOf('ac\\u0066lag') !== -1) return true;
    if (data.indexOf('ac\\x66lag') !== -1) return true;
    if (data.indexOf('ac\\u{66}lag') !== -1) return true;
    if (/ac(?:\\u0066|\\x66)lag/i.test(data)) return true;
    return false;
  }

  /*
   * Forensics: remember what the scanner tried to report, so the exact trigger
   * is visible instead of guessing.
   */
  function noteFlag(data) {
    state.blocked++;
    state.lastBlockedAt = Date.now();
    try {
      var msg = JSON.parse(data);
      var kind = (msg && msg.k) || 'unknown';
      state.flags[kind] = (state.flags[kind] || 0) + 1;
      state.lastFlag = { k: kind, d: (msg && msg.d) || '', at: Date.now() };
    } catch (e) {
      state.lastFlag = { k: 'unparsed', d: String(data).slice(0, 160), at: Date.now() };
    }
  }

  function gameState() {
    try { return window.G || null; } catch (e) { return null; }
  }

  function hitDistance(msg) {
    try {
      var G = gameState();
      var me = G && G.P && G.P.s && G.P.s.mover && G.P.s.mover.pos;
      var victim = null;
      if (G && G.bots) {
        for (var i = 0; i < G.bots.length; i++) {
          if (G.bots[i] && G.bots[i].id === msg.target) { victim = G.bots[i]; break; }
        }
      }
      var tv = victim && victim.mover && victim.mover.pos;
      if (!me || !tv) return -1;
      var dx = tv.x - me.x, dy = tv.y - me.y, dz = tv.z - me.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    } catch (e) { return -1; }
  }

  /* Diagnostics only, nothing is modified. */
  function recordHit(data) {
    if (typeof data !== 'string' || data.indexOf('"t":"hit"') === -1) return;
    try {
      var msg = JSON.parse(data);
      if (!msg || msg.t !== 'hit') return;
      var dist = hitDistance(msg);
      state.hits.count++;
      state.hits.last = {
        at: Date.now(),
        target: msg.target,
        dmg: msg.dmg,
        w: msg.w,
        head: !!msg.head,
        dist: dist >= 0 ? Math.round(dist * 10) / 10 : undefined
      };
    } catch (e) {}
  }

  function install() {
    var WS = window.WebSocket;
    if (!WS || !WS.prototype) return false;
    var proto = WS.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'send');
    if (!desc || typeof desc.value !== 'function') return false;
    if (desc.value.__pbSendGuard) {
      state.installed = true;
      return true;
    }
    NATIVE_SEND = desc.value;
    var guard = new Proxy(NATIVE_SEND, {
      apply: function (target, thisArg, args) {
        var payload = args[0];
        if (isAcPayload(payload)) {
          noteFlag(payload);
          // Drop silently. Returning normally keeps callers unaware.
          return undefined;
        }
        if (typeof payload === 'string') recordHit(payload);
        return Reflect.apply(target, thisArg, args);
      }
    });
    Object.defineProperty(guard, '__pbSendGuard', { value: true });
    Object.defineProperty(proto, 'send', {
      value: guard,
      writable: true,
      enumerable: desc.enumerable,
      configurable: true
    });
    state.installed = true;
    return true;
  }

  if (!install()) {
    var tries = 0;
    var timer = setInterval(function () {
      if (install() || ++tries > 100) clearInterval(timer);
    }, 10);
  }
})();
