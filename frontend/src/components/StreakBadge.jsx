import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { apiFetch } from '../services/api';
import './StreakBadge.css';

// Flame chip in the top-right corner: shows the clean-eating streak,
// click it to see the details.
export default function StreakBadge({ refreshKey }) {
  const [streak, setStreak] = useState(null);
  const [best, setBest] = useState(0);
  const [todayClean, setTodayClean] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const res = await apiFetch(`/api/pet?date=${today}`);
      if (!res.ok) return;
      const data = await res.json();
      setStreak(data.pet?.clean_streak ?? 0);
      setBest(data.pet?.best_clean_streak ?? 0);
      setTodayClean(Boolean(data.pet?.today_clean));
    } catch {
      /* keep the last known value */
    }
  }, []);

  // refreshKey changes whenever the user's points change (i.e. after logging food)
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (streak === null) return null;

  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const active = streak > 0;

  let headline;
  let detail;
  if (streak >= 2) {
    headline = `You have been eating clean food for the past ${days(streak)}.`;
  } else if (streak === 1) {
    headline = 'You have eaten clean food for 1 day. Your streak has started.';
  } else {
    headline = 'No clean streak right now.';
  }
  if (!active) {
    detail = 'Log your meals today with no junk food to start a streak.';
  } else if (todayClean) {
    detail = 'Today is counted. Keep it clean tomorrow to make it grow.';
  } else {
    detail = 'Log a clean meal today to keep it going.';
  }

  return (
    <div className="streak-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`streak-chip${active ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Clean eating streak: ${days(streak)}`}
        title="Clean eating streak"
      >
        <Flame size={16} className="streak-chip-icon" />
        <span className="streak-chip-count">{streak}</span>
      </button>

      {open && (
        <div className="streak-popover animate-fade-in" role="dialog" aria-label="Clean eating streak">
          <div className="streak-pop-top">
            <div className={`streak-pop-flame${active ? ' is-active' : ''}`}><Flame size={22} /></div>
            <div className="streak-pop-number">
              {streak}
              <span className="streak-pop-unit">{streak === 1 ? 'day' : 'days'}</span>
            </div>
            <span className="streak-pop-label">Clean eating streak</span>
          </div>
          <p className="streak-pop-headline">{headline}</p>
          <p className="streak-pop-detail">{detail}</p>
          <div className="streak-pop-foot">
            <span>Best streak</span>
            <strong>{days(best)}</strong>
          </div>
          <p className="streak-pop-rule">
            A day counts when you log food and nothing is rated "Not good".
          </p>
        </div>
      )}
    </div>
  );
}
