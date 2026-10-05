import React, { useEffect, useRef } from 'react';

function baseSpread(size) {
  const pts = [
    [20, 0.2],
    [50, 0.5],
    [100, 1.5]
  ];
  if (size <= pts[0][0]) return pts[0][1];
  if (size >= pts[2][0]) return pts[2][1];
  const i = size <= pts[1][0] ? 0 : 1;
  return (
    pts[i][1] +
    ((size - pts[i][0]) * (pts[i + 1][1] - pts[i][1])) /
      (pts[i + 1][0] - pts[i][0])
  );
}

export default function VaporText({
  texts = ['Hi There !', 'i am ZOOF ', 'ur food tracker '],
  vaporizeTime = 2, // seconds
  fadeInTime = 1, // seconds
  waitTime = 1.3, // seconds
  spread = 5,
  density = 5,
  direction = 'left-to-right',
  align = 'center',
  className = '',
  style = {}
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const textList = Array.isArray(texts)
      ? texts.filter(Boolean)
      : texts.split('|').map((s) => s.trim()).filter(Boolean);

    if (!textList.length) return;

    el.innerHTML = '';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    el.appendChild(canvas);

    const VAPORIZE = Math.max(0.5, vaporizeTime) * 1000;
    const FADE_IN = Math.max(0.2, fadeInTime) * 1000;
    const WAIT = Math.max(0.1, waitTime) * 1000;
    const spreadIn = spread;
    const densityVal = 0.3 + (Math.min(10, Math.max(0, density)) / 10) * 0.7;
    const rtl = direction === 'right-to-left';

    let dpr = 1;
    let cssW = 0;
    let particles = [];
    let bounds = { left: 0, right: 0, width: 0 };
    let SPREAD = 1;
    let index = 0;
    let state = 'fadingIn';
    let progress = 0;
    let fade = 0;
    let last = 0;
    let timer = null;
    let animationFrameId = null;

    // Mouse tracking for cursor effect
    const mouse = { x: -9999, y: -9999, active: false };

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      mouse.x = rawX * dpr;
      mouse.y = rawY * dpr;

      // Active when mouse is within or near the text bounds
      mouse.active =
        rawX >= -120 &&
        rawX <= rect.width + 120 &&
        rawY >= -80 &&
        rawY <= rect.height + 80;
    }

    function onTouchMove(e) {
      if (e.touches && e.touches[0]) {
        onMouseMove(e.touches[0]);
      }
    }

    function onMouseLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function build() {
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 72;
      const rgbMatch = cs.color.match(/\d+/g);
      const rgb = rgbMatch ? rgbMatch.slice(0, 3).join(', ') : '255, 255, 255';
      SPREAD = baseSpread(fontSize) * spreadIn;

      dpr = (window.devicePixelRatio || 1) * 1.5;
      cssW = el.clientWidth || window.innerWidth;
      const cssH = el.clientHeight || 180;
      const W = (canvas.width = Math.max(1, Math.floor(cssW * dpr)));
      const H = (canvas.height = Math.max(1, Math.floor(cssH * dpr)));

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.font = `${cs.fontWeight || '800'} ${fontSize * dpr}px ${cs.fontFamily || 'Outfit, sans-serif'}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';

      const textX = align === 'left' ? 0 : align === 'right' ? W : W / 2;
      const currentText = textList[index];
      const tw = ctx.measureText(currentText).width;

      bounds.left = align === 'center' ? textX - tw / 2 : align === 'left' ? textX : textX - tw;
      bounds.right = bounds.left + tw;
      bounds.width = tw;

      ctx.fillText(currentText, textX, H / 2);

      const data = ctx.getImageData(0, 0, W, H).data;
      const cur = W / (cssW || 1);
      const rate = Math.max(1, Math.round(cur / 3));
      particles = [];

      for (let y = 0; y < H; y += rate) {
        for (let x = 0; x < W; x += rate) {
          const a = data[(y * W + x) * 4 + 3];
          if (a > 0) {
            const oa = (a / 255) * (rate / cur);
            particles.push({
              x,
              y,
              ox: x,
              oy: y,
              oa,
              o: oa,
              vx: 0,
              vy: 0,
              speed: 0,
              quick: false,
              rgb
            });
          }
        }
      }
      ctx.clearRect(0, 0, W, H);
    }

    // Step physics for idle / resting state with organic mouse repulsion & spring back
    function stepIdle(dt) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          const triggerDist = 80 * dpr;

          if (mdist < triggerDist && mdist > 0) {
            const force = (1 - mdist / triggerDist) * (24 * SPREAD);
            const ang = Math.atan2(mdy, mdx);
            p.vx += Math.cos(ang) * force;
            p.vy += Math.sin(ang) * force;
          }
        }

        // Spring physics back to initial position (ox, oy)
        const hdx = p.ox - p.x;
        const hdy = p.oy - p.y;
        p.vx += hdx * 0.12;
        p.vy += hdy * 0.12;
        p.vx *= 0.82; // friction damping
        p.vy *= 0.82;
        p.x += p.vx * dt * 25;
        p.y += p.vy * dt * 25;
      }
    }

    // Step physics for vaporizing state with mouse scatter
    function step(dt) {
      const edge = rtl
        ? bounds.right - (bounds.width * progress) / 100
        : bounds.left + (bounds.width * progress) / 100;
      let done = true;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Extra mouse turbulence during vaporization
        if (mouse.active) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          const triggerDist = 90 * dpr;
          if (mdist < triggerDist && mdist > 0) {
            const force = (1 - mdist / triggerDist) * (20 * SPREAD);
            const ang = Math.atan2(mdy, mdx);
            p.vx += Math.cos(ang) * force;
            p.vy += Math.sin(ang) * force;
            p.speed = Math.max(p.speed, force * 0.4);
          }
        }

        if (rtl ? p.ox >= edge : p.ox <= edge) {
          if (p.speed === 0) {
            const ang = Math.random() * Math.PI * 2;
            p.speed = (Math.random() + 0.5) * SPREAD;
            p.vx = Math.cos(ang) * p.speed;
            p.vy = Math.sin(ang) * p.speed;
            p.quick = Math.random() > densityVal;
          }
          if (p.quick) {
            p.o = Math.max(0, p.o - dt);
          } else {
            const dx = p.ox - p.x;
            const dy = p.oy - p.y;
            const damp = Math.max(0.95, 1 - Math.sqrt(dx * dx + dy * dy) / (100 * SPREAD));
            const rs = SPREAD * 3;
            p.vx = (p.vx + (Math.random() - 0.5) * rs + dx * 0.002) * damp;
            p.vy = (p.vy + (Math.random() - 0.5) * rs + dy * 0.002) * damp;
            const maxV = SPREAD * 2;
            const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (v > maxV) {
              p.vx *= maxV / v;
              p.vy *= maxV / v;
            }
            p.x += p.vx * dt * 20;
            p.y += p.vy * dt * 10;
            p.o = Math.max(0, p.o - dt * 0.25 * (2000 / VAPORIZE));
          }
          if (p.o > 0.01) done = false;
        } else {
          done = false;
        }
      }
      return done;
    }

    function render(mult) {
      ctx.save();
      ctx.scale(dpr, dpr);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const o = mult == null ? p.o : mult * p.oa;
        if (o > 0) {
          ctx.fillStyle = `rgba(${p.rgb}, ${o})`;
          ctx.fillRect(p.x / dpr, p.y / dpr, 1.1, 1.1);
        }
      }
      ctx.restore();
    }

    function reset() {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x = p.ox;
        p.y = p.oy;
        p.o = p.oa;
        p.speed = 0;
        p.vx = 0;
        p.vy = 0;
      }
    }

    function frame(now) {
      animationFrameId = requestAnimationFrame(frame);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (state === 'vaporizing') {
        progress += (dt * 100) / (VAPORIZE / 1000);
        const done = step(dt);
        render();
        if (progress >= 100 && done) {
          index = (index + 1) % textList.length;
          build();
          state = 'fadingIn';
          fade = 0;
        }
      } else if (state === 'fadingIn') {
        fade += (dt * 1000) / FADE_IN;
        stepIdle(dt);
        render(Math.min(fade, 1));
        if (fade >= 1) {
          state = 'waiting';
          timer = setTimeout(() => {
            reset();
            progress = 0;
            state = 'vaporizing';
          }, WAIT);
        }
      } else {
        // 'waiting' resting state with active cursor physics
        stepIdle(dt);
        render();
      }
    }

    function rebuild() {
      clearTimeout(timer);
      build();
      state = 'fadingIn';
      fade = 0;
    }

    build();
    let rw = el.clientWidth;
    let rh = el.clientHeight;
    let rd = window.devicePixelRatio;

    function onResize() {
      if (
        el.clientWidth === rw &&
        el.clientHeight === rh &&
        window.devicePixelRatio === rd
      )
        return;
      rw = el.clientWidth;
      rh = el.clientHeight;
      rd = window.devicePixelRatio;
      rebuild();
    }

    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      if (resizeObserver) resizeObserver.disconnect();
      if (el.contains(canvas)) {
        el.removeChild(canvas);
      }
    };
  }, [texts, vaporizeTime, fadeInTime, waitTime, spread, density, direction, align]);

  return (
    <div
      ref={containerRef}
      className={`vapor-text ${className}`}
      style={style}
    />
  );
}
