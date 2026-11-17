/* ---- 3D truck: three.js loads after the page has painted, so the text appears first ---- */
function start3D() {
  const sec = document.getElementById('truck3d');
  const sticky = sec.querySelector('.s3-sticky');
  const cvs = document.getElementById('truckCanvas');
  const steps = [...document.querySelectorAll('#s3steps li')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  function progress() {
    const r = sec.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - sticky.clientHeight));
  }
  function markStep(p) {
    const idx = p < .36 ? 0 : p < .68 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-on', i === idx));
  }
  addEventListener('scroll', () => markStep(progress()), { passive: true });

  if (!window.THREE) { sec.classList.add('no3d'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true }); }
  catch (e) { sec.classList.add('no3d'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.physicallyCorrectLights = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2c2f33');
  scene.fog = new THREE.Fog('#2c2f33', 20, 42);
  const cam = new THREE.PerspectiveCamera(30, 1, .6, 90);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3d40, .38));
  const sun = new THREE.DirectionalLight(0xffffff, .95);
  sun.position.set(6, 11, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xc6f135, .45); rim.position.set(-8, 5, -7); scene.add(rim);

  // ground, grid, road
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .38 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(60, 60, 0x4d5258, 0x3a3e43); grid.position.y = .002; scene.add(grid);
  const road = new THREE.Group(); scene.add(road);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xc6f135 });
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .12), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(-26 + i * 2.4, .01, 2.3); road.add(d);
  }

  // ---------- studio reflections (a soft gradient sky baked into an environment map) ----------
  (function () {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#f4f6f0'); gr.addColorStop(.42, '#9aa09a'); gr.addColorStop(.5, '#d8f27a');
    gr.addColorStop(.53, '#4a4f55'); gr.addColorStop(1, '#202326');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(60, 30, 120, 26); g.fillRect(300, 22, 150, 20); // softbox highlights
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(t).texture;
    t.dispose(); pm.dispose();
  })();

  // ---------- the truck ----------
  const truck = new THREE.Group(); scene.add(truck);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .55, metalness: .1 }, o));
  const add = (geo, mat, x, y, z, parent = truck) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cyl = (r, h, mat, x, y, z, axis = 'y', seg = 20) => {
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    if (axis === 'x') geo.rotateZ(Math.PI / 2); if (axis === 'z') geo.rotateX(Math.PI / 2);
    return add(geo, mat, x, y, z);
  };
  const extrude = (pts, depth, mat, bevel = .06) => {
    const sh = new THREE.Shape();
    pts.forEach((p, i) => p.q ? sh.quadraticCurveTo(p.q[0], p.q[1], p.x, p.y) : (i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 14 });
    geo.translate(0, 0, -depth / 2);
    return add(geo, mat, 0, 0, 0);
  };

  const paint = new THREE.MeshPhysicalMaterial({ color: '#b9ec10', roughness: .32, metalness: .05, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .55 });
  const dark = M('#1c1f22', { roughness: .65, metalness: .2 });
  const chrome = M('#e8ebe6', { roughness: .12, metalness: 1 });
  const alu = M('#bcc1b9', { roughness: .3, metalness: .85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0f1214', roughness: .04, metalness: .9, clearcoat: 1, side: THREE.DoubleSide });
  const rubber = M('#141618', { roughness: .92, metalness: 0 });
  const glow = (c, e, k = 1.4) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: k });

  // trailer box with the livery on both sides
  function sideTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 416;
    const g = c.getContext('2d');
    g.fillStyle = '#eef0ea'; g.fillRect(0, 0, 1024, 416);
    const sh = g.createLinearGradient(0, 0, 0, 416); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.06)');
    g.fillStyle = sh; g.fillRect(0, 0, 1024, 416);
    g.strokeStyle = '#d3d7cf'; g.lineWidth = 3;
    for (let x = 64; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 336); g.stroke(); }
    g.fillStyle = '#c6f135'; g.fillRect(0, 344, 1024, 44);
    g.fillStyle = '#2c2f33'; g.fillRect(0, 388, 1024, 6);
    g.textAlign = 'center';
    g.fillStyle = '#2c2f33'; g.font = '800 150px Manrope, Inter, Arial, sans-serif'; g.fillText('MACHAIRIS', 512, 200);
    g.fillStyle = '#5c6168'; g.font = '700 38px "JetBrains Mono", Menlo, monospace'; g.fillText('TRANSPORT & LOGISTICS', 512, 268);
    g.fillStyle = '#4b6600'; g.font = '600 26px Inter, Arial, sans-serif'; g.fillText('Ασπρόπυργος · Αττική', 512, 316);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  const trailerMat = M('#e9ece4', { roughness: .4, metalness: .02, envMapIntensity: .5 });
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTexture(), roughness: .4, metalness: .02, envMapIntensity: .5 });
  add(new THREE.BoxGeometry(6.4, 2.6, 2.4), [trailerMat, trailerMat, trailerMat, trailerMat, sideMat, sideMat], -1, 2.35, 0);
  if (document.fonts) document.fonts.ready.then(() => { const old = sideMat.map; sideMat.map = sideTexture(); sideMat.needsUpdate = true; old.dispose(); });
  // corner posts, top and bottom rails
  [[1.2, 1.2], [1.2, -1.2], [-1.2, 1.2], [-1.2, -1.2]].forEach(([dx, dz]) => box(.08, 2.62, .08, alu, -1 + dx * 2.66, 2.35, dz * 1.0));
  [1.21, -1.21].forEach(z => { box(6.42, .08, .05, alu, -1, 3.64, z); box(6.42, .14, .06, dark, -1, 1.1, z); });
  // rear doors: split, four lock bars, hinges, handles
  box(.03, 2.5, .03, dark, -4.225, 2.35, 0);
  [-.9, -.32, .32, .9].forEach(z => { cyl(.028, 2.45, chrome, -4.25, 2.35, z, 'y', 10); box(.05, .06, .12, chrome, -4.25, 2.1, z + (z > 0 ? .08 : -.08)); });
  [-1.12, 1.12].forEach(z => [1.5, 2.35, 3.2].forEach(y => box(.06, .14, .12, alu, -4.24, y, z)));
  const tail = glow('#ff5a3c', '#ff2a10', 1.1), amber = glow('#ffb52e', '#ff9a00', 1.2);
  [.95, -.95].forEach(z => { box(.05, .18, .34, tail, -4.27, 1.25, z); box(.05, .1, .14, amber, -4.27, 1.25, z * .62); });
  box(.14, .16, 2.25, dark, -4.12, .78, 0);                          // rear underride bar
  [.8, -.8].forEach(z => box(.08, .3, .08, dark, -4.0, .95, z));
  // side marker lights + side guards between the axles
  [1.215, -1.215].forEach(z => {
    for (let i = 0; i < 6; i++) box(.12, .06, .02, amber, -3.9 + i * 1.15, 1.2, z);
    box(2.9, .06, .04, alu, -.2, .72, z * .95); box(2.9, .06, .04, alu, -.2, .95, z * .95);
  });
  // landing legs
  [.75, -.75].forEach(z => { box(.12, .82, .12, dark, 1.25, .62, z); box(.3, .04, .3, dark, 1.25, .22, z); });

  // chassis and coupling
  box(8.7, .28, 1.4, dark, .15, .9, 0);
  box(.6, .1, 1.2, alu, 2.4, 1.1, 0);

  // cab: real side profile with a raked windscreen, extruded with rounded edges
  const CAB_D = 2.1;
  extrude([{ x: 2.5, y: 1.08 }, { x: 4.46, y: 1.08 }, { x: 4.48, y: 2.1 }, { x: 4.22, y: 3.25 }, { x: 3.9, y: 3.52, q: [4.16, 3.52] },
           { x: 2.75, y: 3.52 }, { x: 2.5, y: 3.3, q: [2.5, 3.52] }, { x: 2.5, y: 1.08 }], CAB_D, paint, .07);
  // roof deflector
  extrude([{ x: 2.72, y: 3.5 }, { x: 3.92, y: 3.5 }, { x: 3.5, y: 3.92, q: [3.78, 3.62] }, { x: 2.78, y: 4.02 }, { x: 2.72, y: 3.5 }], 1.96, paint, .05);
  // windscreen (follows the rake) and visor
  const ws = box(.03, 1.0, 1.98, glass, 4.42, 2.66, 0); ws.rotation.z = Math.atan2(.26, 1.15);
  const vis = box(.32, .06, 2.05, dark, 4.18, 3.36, 0); vis.rotation.z = -.25;
  // side windows, door seam, handle, steps, mirrors
  const winShape = new THREE.Shape(); winShape.moveTo(3.55, 2.32); winShape.lineTo(4.33, 2.32); winShape.lineTo(4.16, 3.1); winShape.lineTo(3.55, 3.1); winShape.lineTo(3.55, 2.32);
  [1, -1].forEach(sd => {
    const z = sd * (CAB_D / 2 + .075);
    add(new THREE.ShapeGeometry(winShape), glass, 0, 0, z);
    box(.02, 2.0, .01, dark, 3.48, 2.15, z);
    box(.2, .05, .03, chrome, 3.62, 2.12, z + sd * .01);
    box(.42, .05, .3, alu, 3.0, 1.32, sd * 1.2); box(.42, .05, .3, alu, 3.0, 1.72, sd * 1.2);
    box(.06, .06, .5, chrome, 4.24, 2.95, sd * 1.28);
    box(.1, .55, .16, dark, 4.22, 2.8, sd * 1.53);
    box(.02, .46, .12, glass, 4.28, 2.8, sd * 1.53);
  });
  // grille with chrome slats, bumper, lights
  box(.06, .82, 1.55, dark, 4.575, 1.78, 0);
  for (let i = 0; i < 5; i++) box(.07, .05, 1.42, chrome, 4.625, 1.46 + i * .15, 0);
  box(.38, .42, 2.24, dark, 4.6, 1.05, 0);
  const head = glow('#fffdf0', '#fff4c4', 2.2);
  [.82, -.82].forEach(z => {
    box(.1, .26, .5, chrome, 4.6, 1.5, z * 1.06); box(.04, .2, .44, head, 4.67, 1.5, z * 1.06);
    box(.04, .1, .2, glow('#fffdf0', '#fff4c4', 1.6), 4.805, 1.0, z * .92);  // fog lights
  });
  // exhaust stack and fuel tanks
  cyl(.085, 2.7, chrome, 2.38, 2.45, .95, 'y', 16);
  cyl(.1, .14, dark, 2.38, 3.83, .95, 'y', 16);
  [.78, -.78].forEach(z => { cyl(.27, .62, chrome, 2.86, .98, z, 'x', 24); });

  // wheels: lathe-turned tyres, alloy rims, lime hub caps
  const wheels = [];
  const tyreGeo = new THREE.LatheGeometry([
    new THREE.Vector2(.33, -.2), new THREE.Vector2(.48, -.215), new THREE.Vector2(.545, -.18), new THREE.Vector2(.565, -.1),
    new THREE.Vector2(.565, .1), new THREE.Vector2(.545, .18), new THREE.Vector2(.48, .215), new THREE.Vector2(.33, .2)
  ], 40); tyreGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(.34, .34, .36, 32); rimGeo.rotateX(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(.11, .13, .43, 20); capGeo.rotateX(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#141618', roughness: .9, side: THREE.DoubleSide });
  const capMat = new THREE.MeshPhysicalMaterial({ color: '#c6f135', roughness: .3, metalness: .4, clearcoat: 1 });
  function wheel(x, z, wide) {
    const w = new THREE.Group(); w.position.set(x, .565, z); truck.add(w);
    const t = add(tyreGeo, tyreMat, 0, 0, 0, w); const r = add(rimGeo, alu, 0, 0, 0, w);
    if (wide) { t.scale.z = 1.3; r.scale.z = 1.3; }
    add(capGeo, capMat, 0, 0, 0, w);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(new THREE.CylinderGeometry(.025, .025, .4, 8).rotateX(Math.PI / 2), chrome, Math.cos(a) * .21, Math.sin(a) * .21, 0, w); }
    wheels.push(w);
  }
  [-3.45, -2.3].forEach(x => [.93, -.93].forEach(z => wheel(x, z, true)));
  [1.95].forEach(x => [.93, -.93].forEach(z => wheel(x, z, true)));
  [3.7].forEach(x => [1.0, -1.0].forEach(z => wheel(x, z, false)));
  // mudflaps
  [[-4.05, 1], [-4.05, -1], [1.25, 1], [1.25, -1]].forEach(([x, sd]) => box(.04, .5, .5, rubber, x, .62, sd * .95));

  // headlight beams that wake up for the delivery run
  const beams = [.82, -.82].map(z => {
    const sp = new THREE.SpotLight(0xfff3c4, 0, 22, .42, .65, 1.2);
    sp.position.set(4.75, 1.5, z); sp.target.position.set(14, 0, z * 1.6);
    truck.add(sp); truck.add(sp.target); return sp;
  });

  // ---------- pallets (stage 1) ----------
  const palletMat = M('#c8b088', { roughness: .8 });
  const tapeMat = M('#c6f135', { roughness: .5 });
  const pallets = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    add(new THREE.BoxGeometry(.95, .85, .95), palletMat, 0, .55, 0, g);
    add(new THREE.BoxGeometry(.97, .1, .3), tapeMat, 0, .98, 0, g);
    add(new THREE.BoxGeometry(1, .14, 1), M('#8a7656', { roughness: .9 }), 0, .07, 0, g);
    const start = new THREE.Vector3(-1.6 - (i % 3) * 1.2, 0, 3.4 + Math.floor(i / 3) * 1.25);
    g.position.copy(start); scene.add(g);
    pallets.push({ g, start });
  }

  // ---------- warehouse outline (stage 2) ----------
  const whGeo = new THREE.BoxGeometry(13, 5.6, 7.4);
  const wh = new THREE.LineSegments(new THREE.EdgesGeometry(whGeo), new THREE.LineBasicMaterial({ color: 0xc6f135, transparent: true, opacity: 0 }));
  wh.position.set(-.5, 2.8, 0); scene.add(wh);
  const roofLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-7, 5.6, -3.7), new THREE.Vector3(-7, 7, 0), new THREE.Vector3(-7, 5.6, 3.7),
    new THREE.Vector3(-7, 7, 0), new THREE.Vector3(6, 7, 0), new THREE.Vector3(6, 5.6, -3.7),
    new THREE.Vector3(6, 7, 0), new THREE.Vector3(6, 5.6, 3.7)
  ]), wh.material);
  scene.add(roofLine);

  // ---------- interaction ----------
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let mx = 0, my = 0, drag = 0, dragV = 0, dragging = false, lastX = 0;
  if (fine) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  cvs.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; cvs.setPointerCapture(e.pointerId); });
  cvs.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; drag += dx * .008; dragV = dx * .008; });
  const end = () => { dragging = false; };
  cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', end);

  let W = 0, H = 0;
  function resize() {
    W = sticky.clientWidth; H = sticky.clientHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
  }
  resize(); new ResizeObserver(resize).observe(sticky);

  let visible = true;
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(sec);

  const cur = { theta: .6, phi: .32, tx: 0, ty: 1.6, p: 0 };
  function frame(now) {
    const p = progress();
    cur.p = reduce ? p : lerp(cur.p, p, .12);
    const q = cur.p;
    markStep(p);

    // stage 1: pallets glide to the rear doors and disappear inside
    const s1 = clamp((q - .04) / .3);
    pallets.forEach((pl, i) => {
      const t = ease(clamp(s1 * 1.7 - i * .14));
      const door = new THREE.Vector3(-4.6, 1.2, 0);
      pl.g.position.lerpVectors(pl.start, door, t);
      pl.g.position.y = Math.sin(t * Math.PI) * .9 + (t > .5 ? lerp(0, 1.2, (t - .5) * 2) * (1 - t) : 0);
      const sc = t > .82 ? clamp(1 - (t - .82) / .18) : 1;
      pl.g.scale.setScalar(Math.max(.001, sc));
    });
    // stage 2: warehouse outline
    const s2 = clamp((q - .34) / .1) * (1 - clamp((q - .64) / .08));
    wh.material.opacity = s2 * .9;
    // stage 3: drive out
    const s3 = ease(clamp((q - .68) / .32));
    truck.position.x = s3 * 9;
    const spin = -truck.position.x / .56;
    wheels.forEach(w => w.rotation.z = spin);
    road.position.x = -((truck.position.x * .6) % 2.4);
    truck.position.y = s3 > 0 && s3 < 1 && !reduce ? Math.sin(now * .02) * .015 : 0;
    beams.forEach(b => b.intensity = .35 + s3 * 2.2);

    // camera
    if (!dragging) { dragV *= .92; drag += dragV; }
    const narrow = W / H < 1;
    const baseTheta = lerp(.75, -.45, q) + drag;
    const tTheta = baseTheta + (fine ? mx * .6 : 0);
    const tPhi = .3 + (fine ? -my * .18 : 0) + s2 * .12;
    cur.theta = lerp(cur.theta, tTheta, .08);
    cur.phi = lerp(cur.phi, tPhi, .08);
    const R = narrow ? Math.min(42, 10.5 / (0.536 * (W / H))) : 25 + s2 * 3;
    scene.fog.near = R + 2; scene.fog.far = R + 24;
    const look = new THREE.Vector3(truck.position.x * .7 - (narrow ? 0 : 5.2), narrow ? 2.6 : 2.2, 0);
    cam.position.set(
      look.x + Math.sin(cur.theta) * Math.cos(cur.phi) * R,
      look.y + Math.sin(cur.phi) * R,
      look.z + Math.cos(cur.theta) * Math.cos(cur.phi) * R
    );
    cam.lookAt(look);
    sun.position.set(truck.position.x + 6, 11, 8); sun.target.position.set(truck.position.x, 0, 0); sun.target.updateMatrixWorld();
    renderer.render(scene, cam);
  }
  (function loop(now) { if (visible) frame(now); requestAnimationFrame(loop); })(performance.now());
}
(() => {
  const go = () => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    sc.onload = start3D;
    sc.onerror = () => document.getElementById('truck3d').classList.add('no3d');
    document.head.appendChild(sc);
  };
  if (!document.getElementById('truck3d')) return;
  if (document.readyState === 'complete') setTimeout(go, 30); else addEventListener('load', () => setTimeout(go, 30));
})();
