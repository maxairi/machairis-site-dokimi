(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;


  /* ---- Quote form: opens the visitor's email with the request filled in ---- */
  const form = document.getElementById('quote');
  if (form) {
    const msg = document.getElementById('formMsg'), T = form.dataset;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const g = n => ((form.elements[n] && form.elements[n].value) || '').trim();
      if (!g('name') || !g('phone')) {
        msg.textContent = T.missing;
        (g('name') ? form.elements.phone : form.elements.name).focus();
        return;
      }
      const svc = form.querySelector('input[name=svc]:checked');
      const svcLabel = svc ? form.querySelector('label[for="' + svc.id + '"]').textContent : '';
      const body = [T.lService + ': ' + svcLabel, T.lName + ': ' + g('name'), T.lPhone + ': ' + g('phone'),
        T.lEmail + ': ' + g('email'), T.lVol + ': ' + g('volume'), '', g('msg')].join('\n');
      location.href = 'mailto:info@machairistransport.com?subject=' + encodeURIComponent(T.subject + ' – ' + g('name')) + '&body=' + encodeURIComponent(body);
      msg.textContent = T.sent;
    });
  }

  /* ---- Scroll road: the little truck drives with the page ---- */
  const topBar = document.querySelector('.top');
  const truckEl = document.getElementById('roadTruck');
  if (!topBar || !truckEl) return;
  let lastY = scrollY, dir = 1;
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    topBar.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (!reduce) {
    addEventListener('scroll', () => {
      const dy = scrollY - lastY; lastY = scrollY;
      if (Math.abs(dy) > 0.5) dir = dy > 0 ? 1 : -1;
      truckEl.style.transform = `scaleX(${dir})`;
    }, { passive: true });
  }

  if (reduce) return;

  /* ---- Shared pointer state ---- */
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  const head = { x: mouse.x, y: mouse.y };   // smoothed point the trail follows

  /* ---- Card spotlight + gentle tilt ---- */
  document.querySelectorAll('.card').forEach(card => {
    const tilt = card.classList.contains('tilt') && fine;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
      if (tilt) {
        const rx = ((y / r.height) - .5) * -4, ry = ((x / r.width) - .5) * 5;
        card.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });

  if (!fine) return;

  /* ---- Custom cursor: a small truck that drives after the mouse ---- */
  root.classList.add('cursor-on');
  const ct = document.getElementById('cTruck');
  const trail = document.getElementById('trail');
  const tctx = trail.getContext('2d');
  function sizeTrail() {
    const d = Math.min(devicePixelRatio || 1, 2);
    trail.width = innerWidth * d; trail.height = innerHeight * d;
    tctx.setTransform(d, 0, 0, d, 0, 0);
  }
  sizeTrail(); addEventListener('resize', sizeTrail);

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!mouse.active) { head.x = mouse.x; head.y = mouse.y; mouse.active = true; }
    root.classList.remove('cursor-hide');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.add('cursor-hide'));
  document.addEventListener('pointerenter', () => root.classList.remove('cursor-hide'));
  addEventListener('pointerdown', () => ct.classList.add('is-down'));
  addEventListener('pointerup', () => ct.classList.remove('is-down'));

  // Hover sensitivity: over links/buttons the truck grows and glows lime; in text fields it steps aside
  document.addEventListener('pointerover', e => {
    const t = e.target;
    ct.classList.toggle('is-link', !!t.closest('a, button, .seg label, select, summary'));
    ct.classList.toggle('is-typing', !!t.closest('input, textarea'));
  });

  // Magnetic buttons
  document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1), background .25s, color .25s, border-color .25s';
      el.style.transform = '';
      setTimeout(() => el.style.transition = '', 500);
    });
  });

  // Truck follows a smoothed head, turns toward its direction and leaves fading tyre tracks
  const pts = [];
  const LIFE = 1600;
  let ang = 0;
  function drawTrail(now) {
    const px = head.x, py = head.y;
    head.x += (mouse.x - head.x) * 0.14;
    head.y += (mouse.y - head.y) * 0.14;
    const dx = head.x - px, dy = head.y - py, step = Math.hypot(dx, dy);
    if (step > 1.2) {
      let d = Math.atan2(dy, dx) - ang;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      ang += d * 0.25;
    }
    if (mouse.active && step > 0.4) pts.push({ x: head.x, y: head.y, t: now, a: ang });
    while (pts.length && now - pts[0].t > LIFE) pts.shift();

    tctx.clearRect(0, 0, innerWidth, innerHeight);
    if (pts.length > 2) {
      tctx.lineWidth = 3; tctx.lineCap = 'butt'; tctx.setLineDash([3, 3]);
      for (const side of [-1, 1]) {
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1], p1 = pts[i];
          const life = 1 - (now - p1.t) / LIFE;
          const o = q => [q.x - Math.cos(q.a) * 18 - Math.sin(q.a) * 8 * side, q.y - Math.sin(q.a) * 18 + Math.cos(q.a) * 8 * side];
          const [x0, y0] = o(p0), [x1, y1] = o(p1);
          tctx.strokeStyle = `rgba(128,136,118,${0.5 * life})`;
          tctx.beginPath(); tctx.moveTo(x0, y0); tctx.lineTo(x1, y1); tctx.stroke();
        }
      }
      tctx.setLineDash([]);
    }
    ct.style.transform = `translate3d(${head.x}px, ${head.y}px, 0) rotate(${ang}rad)`;
    requestAnimationFrame(drawTrail);
  }
  requestAnimationFrame(drawTrail);
})();
