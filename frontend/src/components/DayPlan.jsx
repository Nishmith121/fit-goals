import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import './DayPlan.css';

const API = '/api';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// One free-text note for one date. Saves automatically a moment after typing stops.
function PlanNote({ date, title, placeholder }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const timerRef = useRef(null);
  const loadedDateRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadedDateRef.current = null;
    setStatus('idle');
    (async () => {
      try {
        const res = await apiFetch(`${API}/plan?date=${encodeURIComponent(date)}`);
        const data = res.ok ? await res.json() : { text: '' };
        if (!cancelled) {
          setText(data.text || '');
          loadedDateRef.current = date;
        }
      } catch {
        if (!cancelled) {
          setText('');
          loadedDateRef.current = date;
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [date]);

  const save = async (value) => {
    setStatus('saving');
    try {
      const res = await apiFetch(`${API}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, text: value })
      });
      setStatus(res.ok ? 'saved' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (loadedDateRef.current !== date) return;
    setStatus('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 700);
  };

  const handleBlur = () => {
    if (status === 'saving' && loadedDateRef.current === date) {
      clearTimeout(timerRef.current);
      save(text);
    }
  };

  return (
    <div className="plan-note">
      <div className="plan-note-head">
        <span className="plan-note-title">{title}</span>
        <span className="plan-note-date">{formatDate(date)}</span>
        <span className={`plan-note-status ${status}`}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Not saved' : ''}
        </span>
      </div>
      <textarea
        className="plan-note-area"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={4000}
        rows={12}
      />
    </div>
  );
}

function localToday() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export default function PlanPage() {
  const todayStr = localToday();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;
  const nextDate = addDays(selectedDate, 1);
  const dayName = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="plan-page">
      <header className="plan-page-head">
        <div>
          <h2 className="plan-page-title">Plan</h2>
          <p className="plan-card-sub">Write what you'll eat and do. It saves as you type.</p>
        </div>

        <div className="plan-date-bar">
          <button type="button" className="plan-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, -1))} title="Previous day">
            ‹
          </button>
          <div className="plan-date-display">
            <span className="plan-date-day">
              {dayName} {isToday && <span className="plan-today-pill">Today</span>}
            </span>
            <span className="plan-note-date">{fullDate}</span>
          </div>
          <button type="button" className="plan-nav-btn" onClick={() => setSelectedDate(addDays(selectedDate, 1))} title="Next day">
            ›
          </button>
          {!isToday && (
            <button type="button" className="plan-today-btn" onClick={() => setSelectedDate(todayStr)}>
              Today
            </button>
          )}
        </div>
      </header>

      <section className="plan-card">
        <div className="plan-grid">
          <PlanNote
            date={selectedDate}
            title={isToday ? "Today's plan" : 'Plan for this day'}
            placeholder="Nothing written for this day."
          />
          <PlanNote
            date={nextDate}
            title={isToday ? "Tomorrow's plan" : 'Plan for the next day'}
            placeholder="What will you do tomorrow? e.g. oats for breakfast, no fried snacks, 3 L of water."
          />
        </div>
      </section>
    </div>
  );
}
