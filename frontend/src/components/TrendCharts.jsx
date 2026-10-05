import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './TrendCharts.css';

/* ---------- date helpers (all in UTC so day keys never shift) ---------- */
const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const dayKey = (date) => date.toISOString().split('T')[0];
const todayKey = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
const shortDate = (date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/* Turn the per-day history into evenly spaced points for one view. */
function buildSeries(days, mode) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = parseDay(todayKey());

  const foodOf = (d) => (d && (d.items_count || (d.items || []).length) > 0 ? Number(d.total_score) || 0 : null);
  const waterOf = (d) => (d ? Number(d.water?.total_ml) || 0 : null);

  const bucket = (dates) => {
    const records = dates.map((k) => byDate.get(k)).filter(Boolean);
    return {
      food: mean(records.map(foodOf).filter((v) => v !== null)),
      water: mean(records.map(waterOf).filter((v) => v !== null)),
      days: records.length
    };
  };

  const points = [];
  if (mode === 'daily') {
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today.getTime() - i * DAY_MS);
      const b = bucket([dayKey(date)]);
      points.push({ label: shortDate(date), full: `${WEEKDAYS[date.getUTCDay()]}, ${shortDate(date)}`, ...b });
    }
  } else if (mode === 'weekly') {
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const thisMonday = new Date(today.getTime() - mondayOffset * DAY_MS);
    for (let w = 7; w >= 0; w--) {
      const start = new Date(thisMonday.getTime() - w * 7 * DAY_MS);
      const dates = Array.from({ length: 7 }, (_, i) => dayKey(new Date(start.getTime() + i * DAY_MS)));
      const end = new Date(start.getTime() + 6 * DAY_MS);
      points.push({ label: shortDate(start), full: `Week of ${shortDate(start)} to ${shortDate(end)}`, ...bucket(dates) });
    }
  } else {
    for (let m = 5; m >= 0; m--) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1));
      const dates = [];
      for (let d = new Date(start); d.getUTCMonth() === start.getUTCMonth(); d = new Date(d.getTime() + DAY_MS)) {
        dates.push(dayKey(d));
      }
      points.push({
        label: MONTHS[start.getUTCMonth()],
        full: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
        ...bucket(dates)
      });
    }
  }
  return points;
}

/* ---------- one line chart ---------- */
function LineChart({ title, points, field, color, yMax, ticks, format, unit, reference, periodWord, higherIsBetter = true }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(520);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(260, Math.round(entries[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 210;
  const m = { top: 18, right: 46, bottom: 28, left: 44 };
  const innerW = width - m.left - m.right;
  const innerH = height - m.top - m.bottom;
  const n = points.length;
  const x = (i) => m.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => m.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

  const values = points.map((p) => p[field]);
  const known = values.map((v, i) => (v === null ? null : i)).filter((i) => i !== null);
  const lastIdx = known.length ? known[known.length - 1] : null;
  const prevIdx = known.length > 1 ? known[known.length - 2] : null;
  const delta = lastIdx !== null && prevIdx !== null ? values[lastIdx] - values[prevIdx] : null;

  // consecutive known points become one line segment; gaps stay gaps
  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) segments.push(current);

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 58))));

  const moveTo = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const idx = n === 1 ? 0 : Math.round(((px - m.left) / innerW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const start = active === null ? (lastIdx ?? n - 1) : active;
      setActive(Math.max(0, Math.min(n - 1, start + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  // the latest value is also shown in the header, so drop the end label when it would sit on the reference label
  const endLabelCollides =
    lastIdx !== null && reference && lastIdx === n - 1 && Math.abs(y(values[lastIdx]) - y(reference.value)) < 14;

  const good = delta !== null && (higherIsBetter ? delta > 0 : delta < 0);
  const flat = delta !== null && Math.abs(delta) < 0.5;
  const DeltaIcon = flat ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const activePoint = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? Math.max(70, Math.min(width - 70, x(active))) : 0;

  return (
    <div className="tc-chart">
      <div className="tc-chart-head">
        <div className="tc-chart-title">
          <span className="tc-key" style={{ backgroundColor: color }} />
          {title}
        </div>
        <div className="tc-chart-stat">
          <span className="tc-stat-value">{lastIdx !== null ? format(values[lastIdx]) : '—'}</span>
          {unit && lastIdx !== null && <span className="tc-stat-unit">{unit}</span>}
          {delta !== null && (
            <span className={`tc-delta ${flat ? 'flat' : good ? 'good' : 'bad'}`}>
              <DeltaIcon size={13} />
              {flat ? 'No change' : `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`} vs previous {periodWord}
            </span>
          )}
        </div>
      </div>

      <div
        className="tc-plot"
        ref={wrapRef}
        tabIndex={0}
        role="img"
        aria-label={`${title}. Use left and right arrow keys to read values.`}
        onPointerMove={(e) => moveTo(e.clientX)}
        onPointerDown={(e) => moveTo(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg width={width} height={height}>
          {/* grid and y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="tc-grid" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tc-tick">{format(t)}</text>
            </g>
          ))}

          {/* reference line */}
          {reference && reference.value <= yMax && (
            <g>
              <line x1={m.left} x2={width - m.right} y1={y(reference.value)} y2={y(reference.value)} className="tc-ref" />
              <text x={width - m.right + 6} y={y(reference.value)} dy="0.32em" className="tc-ref-label">{reference.label}</text>
            </g>
          )}

          {/* x labels */}
          {points.map((p, i) =>
            i % labelEvery === (n - 1) % labelEvery ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="tc-tick">{p.label}</text>
            ) : null
          )}

          {/* crosshair */}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + innerH} className="tc-crosshair" />
          )}

          {/* area wash + line */}
          {segments.map((seg, si) => {
            const line = seg.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`).join(' ');
            const area = `${line} L${x(seg[seg.length - 1]).toFixed(1)} ${m.top + innerH} L${x(seg[0]).toFixed(1)} ${m.top + innerH} Z`;
            return (
              <g key={si}>
                {seg.length > 1 && <path d={area} fill={color} opacity="0.1" />}
                {seg.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              </g>
            );
          })}

          {/* markers with a surface ring */}
          {known.map((i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(values[i])}
              r={i === active ? 5.5 : 4}
              fill={color}
              className="tc-dot"
            />
          ))}

          {/* direct label on the latest point only */}
          {lastIdx !== null && active === null && !endLabelCollides && (
            <text x={x(lastIdx) + 9} y={y(values[lastIdx])} dy="0.32em" className="tc-end-label">
              {format(values[lastIdx])}
            </text>
          )}
        </svg>

        {activePoint && (
          <div className="tc-tooltip" style={{ left: `${tooltipLeft}px` }}>
            <span className="tc-tooltip-value">
              <span className="tc-line-key" style={{ backgroundColor: color }} />
              {activePoint[field] === null ? 'No data' : `${format(activePoint[field])}${unit ? ` ${unit}` : ''}`}
            </span>
            <span className="tc-tooltip-label">{activePoint.full}</span>
            {activePoint[field] !== null && periodWord !== 'day' && (
              <span className="tc-tooltip-label">Average of {activePoint.days} logged {activePoint.days === 1 ? 'day' : 'days'}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const MODES = [
  { id: 'daily', label: 'Daily', word: 'day', note: 'Last 14 days' },
  { id: 'weekly', label: 'Weekly', word: 'week', note: 'Last 8 weeks, averaged per week' },
  { id: 'monthly', label: 'Monthly', word: 'month', note: 'Last 6 months, averaged per month' }
];

export default function TrendCharts({ days }) {
  const [mode, setMode] = useState('daily');
  const active = MODES.find((x) => x.id === mode);
  const points = useMemo(() => buildSeries(days || [], mode), [days, mode]);

  const waterGoal = useMemo(() => {
    const latest = (days || []).find((d) => d.water?.target_ml);
    return latest ? latest.water.target_ml : 2500;
  }, [days]);

  const waterMax = useMemo(() => {
    const top = Math.max(waterGoal, ...points.map((p) => p.water || 0));
    return Math.max(1000, Math.ceil(top / 1000) * 1000);
  }, [points, waterGoal]);
  const waterStep = waterMax <= 2000 ? 500 : 1000;
  const waterTicks = Array.from({ length: Math.floor(waterMax / waterStep) + 1 }, (_, i) => i * waterStep);

  return (
    <section className="tc-root">
      <div className="tc-head">
        <div>
          <h4 className="tc-title">Progress</h4>
          <p className="tc-note">{active.note}. Days with nothing logged are left as gaps.</p>
        </div>
        <div className="tc-toggle" role="tablist" aria-label="Chart period">
          {MODES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={mode === opt.id}
              className={`tc-toggle-btn ${mode === opt.id ? 'active' : ''}`}
              onClick={() => setMode(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tc-grid-wrap">
        <LineChart
          title="Food score"
          points={points}
          field="food"
          color="var(--tc-food)"
          yMax={90}
          ticks={[0, 30, 60, 90]}
          format={(v) => String(Math.round(v))}
          unit="/ 90"
          reference={{ value: 65, label: 'Good' }}
          periodWord={active.word}
        />
        <LineChart
          title={mode === 'daily' ? 'Water' : 'Water per day'}
          points={points}
          field="water"
          color="var(--tc-water)"
          yMax={waterMax}
          ticks={waterTicks}
          format={(v) => Math.round(v).toLocaleString()}
          unit="ml"
          reference={{ value: waterGoal, label: 'Goal' }}
          periodWord={active.word}
        />
      </div>
    </section>
  );
}
