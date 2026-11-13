'use strict';
// Preboot section retained from Brave Full.
(function () {
  const log = function () {};
/* LAYER 1 — preboot (universal dual-gate & SRI bypass) */
    (function preboot() {
      try {
        // Skip preboot if running in native Android App, engine already present, or match already loading
        if (window.PBAndroid || (typeof unsafeWindow !== 'undefined' && unsafeWindow.PBAndroid)) {
          log('Native Android APK bridge detected, skipping preboot');
          return;
        }
        if (window.G || (typeof unsafeWindow !== 'undefined' && unsafeWindow.G) || window.HUDO || window.GAME_READY) {
          log('Engine already active, skipping preboot');
          return;
        }
        if (window.__pbBoot) return;
        window.__pbBoot = 1;

        if (!/\/jogo|game|play|room|match|\.html/.test(location.pathname) && location.pathname !== '/') return;

        // Never rewrite document on /jogo or in game rooms (prevents breaking arena WebSocket and Cloudflare)
        if (/\/jogo|game\.html/.test(location.pathname)) {
          log('In game arena (/jogo), preserving native document lifecycle');
          return;
        }

        try { var nb = +sessionStorage.getItem('pb_noboot') || 0; if (nb && Date.now() - nb < 120000) return; } catch (e0) {}
        if (document.readyState === 'complete') return;

        function xget(u, accept) {
          var x = new XMLHttpRequest(); x.open('GET', u, false);
          try { x.setRequestHeader('Accept', accept); } catch (e) {}
          x.send(null);
          if (x.status !== 200 || !x.responseText) throw new Error('xhr ' + x.status);
          return x.responseText;
        }
        var html = '';
        try {
          html = xget(location.href, 'text/html,*/*');
        } catch (eXHR) {
          log('Synchronous XHR blocked or network error, fallback to runtime hooks');
          return;
        }

        var bm = /src="([^"]*\/static\/game\/(?:bundle|game)\.js[^"]*)"/.exec(html);
        if (!bm) return;
        var bsrc = xget(new URL(bm[1], location.href).href, '*/*');

        var patched = false;

        // 1. Unconditional window.G patch (matches vt&&(window.G= or ji&&(window.G= or Ui&&(window.G= or anyVar&&(window.G=)
        bsrc = bsrc.replace(/([a-zA-Z0-9_$]+)\s*&&\s*(\(?window\.G\s*=)/g, function (m, p1, p2) {
          patched = true;
          log('gate window.G patched (' + p1 + ')');
          return '!0&&' + p2;
        });

        // 2. Unconditional window.RND patch
        bsrc = bsrc.replace(/([a-zA-Z0-9_$]+)\s*&&\s*(\(?window\.RND\s*=)/g, function (m, p1, p2) {
          patched = true;
          return '!0&&' + p2;
        });

        // 3. Patch modern localhost regex: vt=f.has("test")&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
        bsrc = bsrc.replace(/([a-zA-Z0-9_$]+)\s*=\s*[^;]*?localhost[^;]*?\.test\(location\.hostname\)/g, function (m, p1) {
          patched = true;
          log('gate modern localhost patched (' + p1 + ')');
          return p1 + '=!0';
        });

        // 4. Patch legacy localhost equality: const Ui="localhost"===location.hostname...
        bsrc = bsrc.replace(/(?:let|const|var)?\s*([a-zA-Z0-9_$]+)\s*=\s*"localhost"===location\.hostname[^;,\n]*/g, function (m, p1) {
          patched = true;
          log('gate legacy hostname patched (' + p1 + ')');
          return p1 + '=!0';
        });

        // 5. Standalone localhost regex test
        if (/\/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$\//.test(bsrc)) {
          bsrc = bsrc.replace(/\/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$\//g, '/.*/');
          patched = true;
        }

        // 6. Disable kc() anti-cheat scanner
        bsrc = bsrc.replace(/function kc\(\)\s*\{/, function () {
          patched = true;
          return 'function kc(){return;';
        });

        // 7. Drop acflag packets in bundle
        bsrc = bsrc.replace(/function R\(t\)\s*\{/, function () {
          patched = true;
          return 'function R(t){if(t&&"acflag"===t.t)return;';
        });

        // 8. If bundle was already patched or has window.G assignment
        if (bsrc.indexOf('!0&&(window.G=') >= 0 || bsrc.indexOf('!0&&window.G=') >= 0 || bsrc.indexOf('window.G=') >= 0) {
          patched = true;
        }

        if (!patched) { log('gate tidak cocok, abort'); return; }

        var parsed = new DOMParser().parseFromString(html, 'text/html');
        // Strip integrity to avoid SRI failures with blob URL replacement
        [].slice.call(parsed.querySelectorAll('script[integrity]')).forEach(function (s) { s.removeAttribute('integrity'); });
        var scripts = [].slice.call(parsed.querySelectorAll('script')).map(function (s) {
          return { src: s.getAttribute('src'), text: s.textContent, type: s.getAttribute('type') || '' };
        });
        if (!scripts.length) return;
        [].slice.call(parsed.querySelectorAll('script')).forEach(function (s) { if (s.parentNode) s.parentNode.removeChild(s); });
        var dt = parsed.doctype ? '<!doctype ' + parsed.doctype.name + '>' : '<!doctype html>';
        var clean = dt + parsed.documentElement.outerHTML;
        var burl = '';
        try { burl = URL.createObjectURL(new Blob([bsrc], { type: 'text/javascript' })); } catch (e1) {}

        try { document.open(); document.write(clean); document.close(); }
        catch (e2) { try { sessionStorage.setItem('pb_noboot', String(Date.now())); } catch (e3) {} return; }

        var i = 0;
        function next() {
          while (i < scripts.length) {
            var s = scripts[i++];
            try {
              var t = (s.type || '').toLowerCase();
              if (t && t.indexOf('javascript') < 0 && t.indexOf('ecmascript') < 0) continue;
              var el = document.createElement('script');
              var head = document.head || document.documentElement;
              if (s.src) {
                var abs;
                try { abs = new URL(s.src, location.href).href; } catch (eU) { abs = s.src; }
                if (/\/static\/game\/(?:bundle|game)\.js(\?|$)/.test(abs)) abs = burl || '';
                if (abs) {
                  el.src = abs; el.async = false;
                  var done = false;
                  var fin = function () { if (done) return; done = true; clearTimeout(to); next(); };
                  var to = setTimeout(fin, 20000);
                  el.onload = el.onerror = fin;
                  head.appendChild(el); return;
                }
                el.textContent = bsrc; head.appendChild(el); continue;
              }
              el.textContent = s.text; head.appendChild(el);
            } catch (eL) {}
          }
        }
        next();

        // Safe watchdog: Never abort or reload if map, assets, or match are actively loading
        setTimeout(function () {
          try {
            if (window.HUDO || window.GAME_READY) return;
            if (document.querySelector('canvas') || document.getElementById('ldScr') || document.getElementById('waitGo')) return;
            var sMsg = document.getElementById('startMsg');
            if (sMsg && sMsg.textContent && (sMsg.textContent.indexOf('Carregando') >= 0 || sMsg.textContent.indexOf('Conectando') >= 0)) return;
          } catch (e) {}
        }, 45000);
      } catch (e) {}
    })();

    
})();
