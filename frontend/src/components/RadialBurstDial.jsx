import React, { useMemo } from 'react';
import './RadialBurstDial.css';

/**
 * RadialBurstDial
 * Recreates the luxury radial tick/pin gauge shown in the user's reference screenshot:
 * - Circular dial of 72 needle-tapered rays radiating outward
 * - Angular color gradient: Mint Green -> Pure White -> Champagne / Gold -> Warm Bronze
 * - Big bold center value with clean subtitle
 * - Active progress illumination with inactive sleek dark metallic rays
 */
export default function RadialBurstDial({
  value = 0,
  max = 100,
  label = 'Hydrated',
  unit = '%',
  size = 180,
  activeColor = null, // Optional override color for active spokes
  className = '',
  showPercentSign = true,
  displayValue = null // Optional explicit string/number to show in center
}) {
  const TOTAL_SPOKES = 72;
  const numValue = Number(value) || 0;
  const safePercent = Math.max(0, Math.min(100, (numValue / (max || 1)) * 100));
  const activeCount = Math.round((safePercent / 100) * TOTAL_SPOKES);

  // Generate color for each spoke around 360 degrees matching the reference image:
  // Top (index 0, -90° / 12 o'clock): Pure White (#FFFFFF)
  // 12 -> 3 o'clock (indexes 0 to 18): Champagne White -> Pale Gold -> Amber Gold (#FEF3C7 -> #FDE68A -> #F59E0B)
  // 3 -> 6 o'clock (indexes 18 to 36): Warm Bronze / Amber -> Earthy Copper (#D97706 -> #B45309 -> #8C4A2F)
  // 6 -> 9 o'clock (indexes 36 to 54): Warm Bronze transitioning into Sage / Mint (#94A3B8 -> #6EE7B7 -> #34D399)
  // 9 -> 12 o'clock (indexes 54 to 72): Mint Emerald -> Pale Aqua -> Pure White (#10B981 -> #A7F3D0 -> #FFFFFF)
  const spokes = useMemo(() => {
    const list = [];

    // Helper: interpolate between two hex colors
    const interpolateColor = (color1, color2, factor) => {
      const c1 = parseInt(color1.slice(1), 16);
      const c2 = parseInt(color2.slice(1), 16);
      const r1 = (c1 >> 16) & 255;
      const g1 = (c1 >> 8) & 255;
      const b1 = c1 & 255;
      const r2 = (c2 >> 16) & 255;
      const g2 = (c2 >> 8) & 255;
      const b2 = c2 & 255;
      const r = Math.round(r1 + factor * (r2 - r1));
      const g = Math.round(g1 + factor * (g2 - g1));
      const b = Math.round(b1 + factor * (b2 - b1));
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Reference gradient color stops around the 72 spokes starting from 12 o'clock clockwise:
    const stops = [
      { pos: 0.0, color: '#ffffff' },  // 12 o'clock (top) - bright white
      { pos: 0.12, color: '#fef3c7' }, // 1:30 - champagne ivory
      { pos: 0.25, color: '#fde68a' }, // 3 o'clock - warm gold
      { pos: 0.38, color: '#f59e0b' }, // 4:30 - rich amber gold
      { pos: 0.50, color: '#d97706' }, // 6 o'clock - warm bronze
      { pos: 0.62, color: '#94a3b8' }, // 7:30 - muted slate bronze transition
      { pos: 0.72, color: '#34d399' }, // 8:40 - emerald mint
      { pos: 0.85, color: '#6ee7b7' }, // 10:15 - bright mint green
      { pos: 0.95, color: '#d1fae5' }, // 11:30 - light mint glow
      { pos: 1.0, color: '#ffffff' }   // 12 o'clock - return to pure white
    ];

    const getColorAtFactor = (f) => {
      for (let i = 0; i < stops.length - 1; i++) {
        if (f >= stops[i].pos && f <= stops[i + 1].pos) {
          const segFactor = (f - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
          return interpolateColor(stops[i].color, stops[i + 1].color, segFactor);
        }
      }
      return '#ffffff';
    };

    for (let i = 0; i < TOTAL_SPOKES; i++) {
      const factor = i / TOTAL_SPOKES;
      const angle = (i * 360) / TOTAL_SPOKES; // 0 is top (12 o'clock)
      const baseColor = getColorAtFactor(factor);

      list.push({
        index: i,
        angle,
        baseColor
      });
    }

    return list;
  }, []);

  const centerDisplay = displayValue !== null
    ? displayValue
    : showPercentSign
      ? `${Math.round(numValue)}${unit}`
      : `${Math.round(numValue)}`;

  return (
    <div
      className={`radial-burst-dial-container ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        viewBox="-100 -100 200 200"
        className="radial-burst-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="centerGlow" cx="0" cy="0" r="50%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.05)" />
            <stop offset="80%" stopColor="rgba(0, 0, 0, 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Ambient Center Glow */}
        <circle cx="0" cy="0" r="48" fill="url(#centerGlow)" />

        {/* 72 Radial Needle Ticks */}
        <g className="radial-spokes-group">
          {spokes.map((spoke) => {
            // Determine active vs inactive
            const isActive = activeCount > 0 && spoke.index <= activeCount;
            const spokeColor = activeColor || spoke.baseColor;

            // Needle-tapered ray path:
            // Starts at inner radius y = -53 with width 3.2px (-1.6 to 1.6)
            // Extends to y = -80 with width 3.0px (-1.5 to 1.5)
            // Tapers smoothly to y = -89 with needle point (width 0.6px, -0.3 to 0.3)
            return (
              <path
                key={spoke.index}
                d="M -1.6 -53 L 1.6 -53 L 1.4 -79 L 0.3 -89 L -0.3 -89 L -1.4 -79 Z"
                transform={`rotate(${spoke.angle})`}
                fill={isActive ? spokeColor : spoke.baseColor}
                opacity={isActive ? 1.0 : activeCount === 0 ? 0.45 : 0.16}
                className={`radial-spoke ${isActive ? 'is-active' : 'is-inactive'}`}
                style={{
                  filter: isActive ? `drop-shadow(0 0 3px ${spokeColor})` : 'none',
                  transition: 'opacity 0.25s ease, filter 0.25s ease, fill 0.25s ease'
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Center Label and Value Display */}
      <div className="radial-burst-center">
        <span className="radial-burst-value">{centerDisplay}</span>
        {label && <span className="radial-burst-label">{label}</span>}
      </div>
    </div>
  );
}
