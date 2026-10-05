import React, { useEffect, useRef } from 'react';

export default function DottedSurface({
  speed = 1,
  opacity = 0.8,
  size = 7,
  color = '#ffffff',
  className = ''
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const SEP = 150;
    const COLS = 40;
    const ROWS = 60;
    const BASE_CAM_Y = 355;
    const CAM_Z = 1220;
    const FOV = 60;
    const FOG_NEAR = 2000;
    const FOG_FAR = 10000;
    const TAN = Math.tan((FOV * Math.PI) / 360);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    el.innerHTML = '';
    el.appendChild(canvas);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let count = 0;
    let last = 0;
    let animationFrameId = null;

    // Mouse parallax variables
    let targetCamX = 0;
    let targetCamY = BASE_CAM_Y;
    let camX = 0;
    let camY = BASE_CAM_Y;
    let mouseNormX = 0;
    let mouseNormY = 0;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      w = el.clientWidth || window.innerWidth;
      h = el.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    }

    function onMouseMove(e) {
      mouseNormX = (e.clientX / window.innerWidth) - 0.5;
      mouseNormY = (e.clientY / window.innerHeight) - 0.5;
      targetCamX = mouseNormX * 360;
      targetCamY = BASE_CAM_Y - (mouseNormY * 220);
    }

    function draw(now) {
      animationFrameId = requestAnimationFrame(draw);
      if (!w || !h) return;
      if (last) {
        count += Math.min(now - last, 100) * 0.006 * speed;
      }
      last = now;

      // Smooth camera interpolation towards cursor
      camX += (targetCamX - camX) * 0.045;
      camY += (targetCamY - camY) * 0.045;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;

      const focal = (h / 2) / TAN;
      const cx = w / 2;
      const cy = h / 2;

      for (let ix = 0; ix < COLS; ix++) {
        const x = ix * SEP - (COLS * SEP) / 2;
        const sx = Math.sin((ix + count) * 0.3) * 50;

        for (let iy = 0; iy < ROWS; iy++) {
          const depth = CAM_Z - (iy * SEP - (ROWS * SEP) / 2);
          if (depth <= 1) continue;

          // Interactive 3D wave calculation
          const y = sx + Math.sin((iy + count) * 0.5) * 50;
          let s = size * (h / 2) / depth;

          // 3D perspective projection with dynamic camera tilt
          const px = cx + ((x - camX) * focal) / depth;
          const py = cy - ((y - camY) * focal) / depth;

          if (px < -s || px > w + s || py < -s || py > h + s) continue;

          let fog = (depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR);
          fog = fog < 0 ? 0 : fog > 1 ? 1 : fog;

          // Interactive mouse proximity wave swell
          const mDist = Math.hypot(px - (cx + mouseNormX * w * 0.5), py - (cy + mouseNormY * h * 0.5));
          let proximityBoost = 0;
          if (mDist < 140) {
            proximityBoost = (1 - mDist / 140) * 0.35;
            s = s * (1 + proximityBoost * 0.8);
          }

          ctx.globalAlpha = Math.min(1, (opacity + proximityBoost) * (1 - fog));
          ctx.fillRect(px - s / 2, py - s / 2, s, s);
        }
      }
    }

    resize();
    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(el);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      if (resizeObserver) resizeObserver.disconnect();
      if (el.contains(canvas)) {
        el.removeChild(canvas);
      }
    };
  }, [speed, opacity, size, color]);

  return (
    <div
      ref={containerRef}
      className={`dotted-surface is-fixed ${className}`}
      style={{ color }}
    />
  );
}
