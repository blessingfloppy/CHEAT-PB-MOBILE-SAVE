(() => {
  'use strict';
  if (window.__pbVisualsFull) return;
  window.__pbVisualsFull = true;

  var A = {x:0,y:0,z:0}, B = {x:0,y:0,z:0};
  var _hpOut = {x:0,y:0,z:0}, _pDir = {x:0,y:0,z:0};
  function wpos(b,out) { var e=b.matrixWorld.elements; out.x=e[12]; out.y=e[13]; out.z=e[14]; return out; }
  function headPoint(p) {
    if (!p) return null;
    var by=p.c&&p.c.byName;
    if (by) {
      var h=by.Head||by.head||by.bone_head||null;
      var g=by.Bone_HeadGearAttach||by.bone_headgearattach||null;
      if (h&&g) { wpos(h,A); wpos(g,B); _hpOut.x=(A.x+B.x)*.5; _hpOut.y=(A.y+B.y)*.5; _hpOut.z=(A.z+B.z)*.5; return _hpOut; }
      if (h||g) return wpos(h||g,_hpOut);
    }
    var mm=p.obj&&p.obj.matrixWorld&&p.obj.matrixWorld.elements;
    if (mm) { _hpOut.x=mm[12]; _hpOut.y=mm[13]+1.55; _hpOut.z=mm[14]; return _hpOut; }
    return null;
  }
  function hasLineOfSight(g,cam,hp) {
    try {
      if (typeof g.cast!=='function'||!cam.matrixWorld) return false;
      var me=cam.matrixWorld.elements, eye={x:me[12],y:me[13],z:me[14]};
      var dx=hp.x-eye.x,dy=hp.y-eye.y,dz=hp.z-eye.z;
      var dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if (!(dist>0.5)) return false;
      _pDir.x=dx/dist; _pDir.y=dy/dist; _pDir.z=dz/dist;
      return !g.cast(eye,_pDir,dist-0.35);
    } catch (_) { return false; }
  }

/* BONE ESP */
    var BE = { on: 0, wrap: null, host: null, hostAt: 0, last: 0, range: 60 };
    var BONE_PAIRS = [
      ['Head','Neck'],['Neck','Spine3'],['Spine3','Spine2'],['Spine2','Spine1'],['Spine1','Pelvis'],
      ['Spine3','L_Clavicle'],['L_Clavicle','L_UpperArm'],['L_UpperArm','L_Forearm'],['L_Forearm','L_Hand'],
      ['Spine3','R_Clavicle'],['R_Clavicle','R_UpperArm'],['R_UpperArm','R_Forearm'],['R_Forearm','R_Hand'],
      ['Pelvis','L_Thigh'],['L_Thigh','L_Calf'],['L_Calf','L_Foot'],
      ['Pelvis','R_Thigh'],['R_Thigh','R_Calf'],['R_Calf','R_Foot']
    ];
    function beInit() {
      if (BE.wrap && BE.wrap.parentNode) return true;
      var host = document.body || document.documentElement;
      if (!host) return false;
      var w = document.createElement('canvas');
      w.setAttribute('data-pb', '1');
      w.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147482999';
      host.appendChild(w);
      BE.wrap = w;
      BE.ctx = w.getContext('2d');
      return true;
    }
    function beClear() { if (BE.ctx && BE.wrap) { BE.ctx.clearRect(0, 0, BE.wrap.width, BE.wrap.height); } }
    function beHost() {
      var now = performance.now();
      if (BE.host && BE.host.parentNode && now - BE.hostAt < 400) return BE.host;
      BE.hostAt = now;
      var best = null, ba = 0, cs = document.getElementsByTagName('canvas');
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (c.getAttribute('data-pb')) continue;
        var r = c.getBoundingClientRect(), a = r.width * r.height;
        if (a > ba) { ba = a; best = c; }
      }
      BE.host = best || null;
      return BE.host;
    }
    function beProject(cam, r, b, out) {
      if (!BE._v) { try { BE._v = cam.position.clone(); } catch (e) { return false; } }
      var e = b.matrixWorld.elements;
      var d = BE._v.set(e[12], e[13], e[14]).project(cam);
      if (!(d.z > -1 && d.z < 1)) return false;
      out.x = r.left + (d.x * 0.5 + 0.5) * r.width;
      out.y = r.top + (-d.y * 0.5 + 0.5) * r.height;
      return true;
    }
    function getBone(by, name) {
      if (!by) return null;
      return by[name] || by[name.toLowerCase()] || by['Bone_' + name] || by['bone_' + name.toLowerCase()] || null;
    }
    function beDraw(g) {
      if (!BE.on) { beClear(); return; }
      var cam = g.camera, list = g.bots, self = g.P && g.P.s;
      if (!list || !cam || !self || self.dead) { beClear(); return; }
      if (!beInit()) return;
      var host = beHost();
      if (!host) { beClear(); return; }
      var r = host.getBoundingClientRect();
      if (!(r.width > 0)) { beClear(); return; }
      var dpr = Math.min(2, devicePixelRatio || 1);
      var w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
      if (BE.wrap.width !== w || BE.wrap.height !== h) { BE.wrap.width = w; BE.wrap.height = h; }
      var ctx = BE.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,80,80,0.65)';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      var my = self.team;
      var me = cam.matrixWorld.elements;
      var cx = me[12], cy = me[13], cz = me[14];
      var pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p || !p.obj || !p.c || p === self) continue;
        if (p.team === my) continue;
        if (p.dead || !(p.hp > 0)) continue;
        var mm = p.obj.matrixWorld && p.obj.matrixWorld.elements;
        if (!mm) continue;
        var dx = mm[12] - cx, dy = mm[13] - cy, dz = mm[14] - cz;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > BE.range) continue;
        var by = p.c.byName;
        if (!by) continue;
        for (var j = 0; j < BONE_PAIRS.length; j++) {
          var ba = getBone(by, BONE_PAIRS[j][0]), bb = getBone(by, BONE_PAIRS[j][1]);
          if (!ba || !bb) continue;
          if (!beProject(cam, r, ba, pa)) continue;
          if (!beProject(cam, r, bb, pb)) continue;
          if (pa.x < r.left - 200 || pa.x > r.left + r.width + 200) continue;
          if (pa.y < r.top - 200 || pa.y > r.top + r.height + 200) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    }

    var CH = { on: 0, visibleColor: '#ff5252', blockedColor: '#ffd43b', entries: [], at: 0, game: null };
    try {
      var savedVisibleColor = localStorage.getItem('pbweb_chams_visible_color') || localStorage.getItem('pbweb_chams_color');
      var savedBlockedColor = localStorage.getItem('pbweb_chams_blocked_color');
      if (/^#[0-9a-fA-F]{6}$/.test(savedVisibleColor || '')) CH.visibleColor = savedVisibleColor;
      if (/^#[0-9a-fA-F]{6}$/.test(savedBlockedColor || '')) CH.blockedColor = savedBlockedColor;
    } catch (e) {}
    function chRestore() {
      for (var i = 0; i < CH.entries.length; i++) {
        var item = CH.entries[i];
        try {
          item.mesh.material = item.material;
          item.mesh.renderOrder = item.renderOrder;
          item.mesh.onBeforeRender = item.prevOBR;
          var mats = Array.isArray(item.chams) ? item.chams : [item.chams];
          for (var j = 0; j < mats.length; j++) if (mats[j] && mats[j].dispose) mats[j].dispose();
        } catch (e) {}
      }
      CH.entries = [];
      CH.game = null;
    }
    function chMaterial(source, color) {
      if (!source || typeof source.clone !== 'function') return source;
      var mat = source.clone();
      if (mat.color && mat.color.set) mat.color.set(color);
      if (mat.emissive && mat.emissive.set) mat.emissive.set(color);
      if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = 0.35;
      // Keep depth state inside the values the game's anti-cheat expects:
      // depthTest ON, depthFunc LessEqualDepth (3). Wall piercing is done by
      // clearing the depth buffer in onBeforeRender instead of disabling the
      // test, and renderOrder stays below the 900 threshold it checks.
      mat.depthTest = true;
      mat.depthFunc = 3;
      mat.depthWrite = false;
      mat.transparent = false;
      mat.needsUpdate = true;
      return mat;
    }
    CH.clearAt = 0;
    function chDepthClear(renderer) {
      try {
        var now = performance.now();
        if (now - CH.clearAt < 4) return;
        CH.clearAt = now;
        renderer.clearDepth();
      } catch (e) {}
    }
    function chTint(material, color) {
      var mats = Array.isArray(material) ? material : [material];
      for (var i = 0; i < mats.length; i++) {
        var mat = mats[i];
        if (mat && mat.color && mat.color.set) mat.color.set(color);
        if (mat && mat.emissive && mat.emissive.set) mat.emissive.set(color);
      }
    }
    function chPartVisible(g, mesh, fallback) {
      try {
        if (!CH.point) CH.point = g.camera.position.clone();
        if (mesh.geometry && mesh.geometry.boundingSphere === null && mesh.geometry.computeBoundingSphere) mesh.geometry.computeBoundingSphere();
        var center = mesh.geometry && mesh.geometry.boundingSphere && mesh.geometry.boundingSphere.center;
        if (center && mesh.localToWorld) CH.point.copy(center); else CH.point.set(0, 0, 0);
        if (mesh.localToWorld) mesh.localToWorld(CH.point);
        else if (mesh.getWorldPosition) mesh.getWorldPosition(CH.point);
        else return fallback;
        return hasLineOfSight(g, g.camera, CH.point);
      } catch (e) { return fallback; }
    }
    function chTick(g) {
      if (!CH.on || !g || !g.P || !g.P.s || !g.bots) { if (CH.entries.length) chRestore(); return; }
      var now = performance.now();
      if (now < CH.at) return;
      CH.at = now + 300;
      if (CH.game && CH.game !== g) chRestore();
      CH.game = g;
      var active = new Set();
      for (var i = 0; i < g.bots.length; i++) {
        var p = g.bots[i];
        if (!p || p === g.P.s || p.team === g.P.s.team || p.dead || !(p.hp > 0) || !p.obj || !p.obj.traverse) continue;
        var head = headPoint(p);
        var headVisible = !!(head && hasLineOfSight(g, g.camera, head));
        p.obj.traverse(function (mesh) {
          if (!mesh || !mesh.isMesh || !mesh.material) return;
          var color = chPartVisible(g, mesh, headVisible) ? CH.visibleColor : CH.blockedColor;
          active.add(mesh);
          for (var k = 0; k < CH.entries.length; k++) {
            if (CH.entries[k].mesh !== mesh) continue;
            if (CH.entries[k].color !== color) { chTint(CH.entries[k].chams, color); CH.entries[k].color = color; }
            return;
          }
          try {
            var original = mesh.material;
            var tinted = Array.isArray(original) ? original.map(function (mat) { return chMaterial(mat, color); }) : chMaterial(original, color);
            if (tinted === original) return;
            CH.entries.push({ mesh: mesh, material: original, chams: tinted, renderOrder: mesh.renderOrder, prevOBR: mesh.onBeforeRender, color: color });
            mesh.material = tinted;
            mesh.renderOrder = 500;
            mesh.onBeforeRender = chDepthClear;
          } catch (e) {}
        });
      }
      for (var n = CH.entries.length - 1; n >= 0; n--) {
        var entry = CH.entries[n];
        if (active.has(entry.mesh)) continue;
        try {
          entry.mesh.material = entry.material;
          entry.mesh.renderOrder = entry.renderOrder;
          entry.mesh.onBeforeRender = entry.prevOBR;
          var old = Array.isArray(entry.chams) ? entry.chams : [entry.chams];
          for (var m = 0; m < old.length; m++) if (old[m] && old[m].dispose) old[m].dispose();
        } catch (e) {}
        CH.entries.splice(n, 1);
      }
    }
    function chColor(kind, value) {
      var key = kind === 'blocked' ? 'blockedColor' : 'visibleColor';
      if (!/^#[0-9a-fA-F]{6}$/.test(value || '')) return CH[key];
      var old = CH[key];
      CH[key] = value.toLowerCase();
      for (var i = 0; i < CH.entries.length; i++) {
        if (CH.entries[i].color !== old) continue;
        chTint(CH.entries[i].chams, CH[key]);
        CH.entries[i].color = CH[key];
      }
      try { localStorage.setItem('pbweb_chams_' + kind + '_color', CH[key]); } catch (e) {}
      return CH[key];
    }


  const panel=document.createElement('div');
  panel.setAttribute('data-pb','1');
  panel.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483001;background:#171717;color:#eee;border:1px solid #555;border-radius:8px;padding:10px 12px;font:12px system-ui,sans-serif;box-shadow:0 8px 24px #0008;min-width:180px';
  panel.innerHTML='<div style="font-weight:700;margin-bottom:9px">Visual</div><label style="display:flex;justify-content:space-between;gap:12px">Skeleton <input type="checkbox" data-control="bone"></label><label style="display:flex;justify-content:space-between;gap:12px;margin-top:9px">Chams <input type="checkbox" data-control="chams"></label><label style="display:block;margin-top:9px">Jarak Skeleton <input type="range" min="20" max="120" step="5" value="60" data-control="range"></label><div style="display:flex;gap:6px;margin-top:9px"><input type="color" value="#ff5252" title="Terlihat" data-control="visible"><input type="color" value="#ffd43b" title="Terhalang" data-control="blocked"></div>';
  const boneInput=panel.querySelector('[data-control="bone"]');
  const chamsInput=panel.querySelector('[data-control="chams"]');
  const rangeInput=panel.querySelector('[data-control="range"]');
  const visibleInput=panel.querySelector('[data-control="visible"]');
  const blockedInput=panel.querySelector('[data-control="blocked"]');
  visibleInput.value=CH.visibleColor; blockedInput.value=CH.blockedColor;
  boneInput.addEventListener('change',()=>{ BE.on=boneInput.checked?1:0; if (!BE.on) beClear(); });
  chamsInput.addEventListener('change',()=>{ CH.on=chamsInput.checked?1:0; if (!CH.on) chRestore(); });
  rangeInput.addEventListener('input',()=>{ BE.range=Number(rangeInput.value); });
  visibleInput.addEventListener('input',()=>chColor('visible',visibleInput.value));
  blockedInput.addEventListener('input',()=>chColor('blocked',blockedInput.value));
  function mount() {
    var host=document.body||document.documentElement;
    if (!host) return setTimeout(mount,50);
    host.appendChild(panel);
  }
  mount();
  function frame() {
    requestAnimationFrame(frame);
    var g=window.G;
    if (BE.on) { try { if (g) beDraw(g); else beClear(); } catch (_) { beClear(); } }
    if (CH.on) { try { chTick(g); } catch (_) { chRestore(); } }
  }
  requestAnimationFrame(frame);
})();
