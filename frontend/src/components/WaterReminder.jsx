import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playWaterDropSound, playReminderChime } from '../utils/sound';
import RadialBurstDial from './RadialBurstDial';
import Shredder from './Shredder';
import BentoCard from './BentoCard';
import { Droplet } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './WaterReminder.css';

const API = '/api';

export default function WaterReminder({ onReminderTrigger, onDrankWater }) {
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const { refreshUser } = useAuth();

  const [waterData, setWaterData] = useState({
    date: selectedDate,
    day: 'Today',
    target_ml: 2500,
    total_ml: 0,
    glass_count: 0,
    standard_glasses: 0,
    percentage: 0,
    entries: []
  });

  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [customMl, setCustomMl] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Hourly reminder settings
  const [reminderActive, setReminderActive] = useState(() => {
    const saved = localStorage.getItem('fitgoals_water_reminder_active');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Interval in minutes (default 60 = 1 hour)
  const [intervalMinutes, setIntervalMinutes] = useState(() => {
    const saved = localStorage.getItem('fitgoals_water_reminder_interval');
    return saved ? parseInt(saved, 10) : 60;
  });

  // Remaining seconds until next reminder
  const [secondsLeft, setSecondsLeft] = useState(() => intervalMinutes * 60);

  // In-app alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Save settings
  useEffect(() => {
    localStorage.setItem('fitgoals_water_reminder_active', JSON.stringify(reminderActive));
  }, [reminderActive]);

  useEffect(() => {
    localStorage.setItem('fitgoals_water_reminder_interval', intervalMinutes.toString());
    setSecondsLeft(intervalMinutes * 60);
  }, [intervalMinutes]);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Fetch water data for selectedDate
  const fetchWater = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/water?date=${encodeURIComponent(dateStr)}`);
      if (res.ok) {
        const data = await res.json();
        setWaterData(data);
      }
    } catch (err) {
      console.error('Failed to fetch water data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWater(selectedDate);
  }, [selectedDate, fetchWater]);

  // Trigger alert function
  const triggerHydrationAlert = useCallback(() => {
    playReminderChime();

    // Browser desktop notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('💧 Hydration Time!', {
          body: '1 hour is up! Take a break and drink a fresh glass of water.',
          icon: '/favicon.ico',
          tag: 'water-reminder'
        });
      } catch (e) {
        console.warn('Desktop notification failed:', e);
      }
    }

    setShowAlertModal(true);
    if (onReminderTrigger) onReminderTrigger();
  }, [onReminderTrigger]);

  // Countdown timer effect
  useEffect(() => {
    if (!reminderActive) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          triggerHydrationAlert();
          return intervalMinutes * 60; // reset
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reminderActive, intervalMinutes, triggerHydrationAlert]);

  // Add water entry
  const handleAddWater = async (amountMl = 250, typeName = 'Glass of water') => {
    setAdding(true);
    playWaterDropSound();

    try {
      const res = await apiFetch(`${API}/water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          amount_ml: amountMl,
          type: typeName
        })
      });

      if (res.ok) {
        const data = await res.json();
        setWaterData(data.day_summary);
        refreshUser();
        // Reset countdown timer since user drank water!
        setSecondsLeft(intervalMinutes * 60);
        setShowAlertModal(false);
        if (onDrankWater) onDrankWater(amountMl);
      }
    } catch (err) {
      console.error('Failed to add water entry:', err);
    }

    setAdding(false);
    setShowCustom(false);
    setCustomMl('');
  };

  // Delete water entry
  const handleDeleteWater = async (entryId) => {
    try {
      const res = await apiFetch(`${API}/water/${encodeURIComponent(entryId)}?date=${encodeURIComponent(selectedDate)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setWaterData(data);
        refreshUser();
      }
    } catch (err) {
      console.error('Failed to delete water entry:', err);
    }
  };

  // Update daily goal
  const handleUpdateTarget = async (newTarget) => {
    try {
      const res = await apiFetch(`${API}/water/target`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          target_ml: newTarget
        })
      });
      if (res.ok) {
        const data = await res.json();
        setWaterData(data);
        refreshUser();
      }
    } catch (err) {
      console.error('Failed to update water target:', err);
    }
  };

  // Date shifting
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === todayStr;

  // Format countdown string
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const currentPercent = waterData.percentage || 0;
  const isHydrated = currentPercent >= 100;

  // 10 glass icons calculation
  const totalGlassesTarget = Math.max(1, Math.round(waterData.target_ml / 250));
  const glassesFilled = Math.min(totalGlassesTarget, Math.floor(waterData.total_ml / 250));

  return (
    <div className="water-tracker-root animate-fade-in">
      {/* Floating In-App Reminder Modal when 1 hour is up */}
      {showAlertModal && (
        <div className="water-alert-overlay" onClick={() => setShowAlertModal(false)}>
          <div className="water-alert-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="alert-water-glow"><Droplet size={26} /></div>
            <h3 className="alert-title">Time for water</h3>
            <p className="alert-body-text">
              It's been a while since your last drink.
            </p>
            <div className="alert-buttons-group">
              <button
                type="button"
                className="alert-drank-btn"
                onClick={() => handleAddWater(250, 'Glass of water')}
              >
                Log a glass · 250 ml
              </button>
              <button
                type="button"
                className="alert-snooze-btn"
                onClick={() => {
                  setShowAlertModal(false);
                  setSecondsLeft(10 * 60); // Snooze 10 mins
                }}
              >
                Snooze 10 min
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Navigation Bar */}
      <div className="water-header-card">
        <div className="water-date-bar">
          <button
            type="button"
            className="water-nav-btn"
            onClick={() => shiftDate(-1)}
            title="Previous Day"
          >
            ‹
          </button>

          <div className="water-date-display">
            <div className="water-day-title">
              {waterData.day} {isToday && <span className="water-today-pill">Today</span>}
            </div>
            <div className="water-date-subtitle">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>

          <button
            type="button"
            className="water-nav-btn"
            onClick={() => shiftDate(1)}
            title="Next Day"
          >
            ›
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            className="reminder-action-btn"
            onClick={() => setSelectedDate(todayStr)}
          >
            Back to today
          </button>
        )}
      </div>

      {/* Hero Hydration Gauge & Stats */}
      <BentoCard className="water-hero-card" enableTilt={true} enableStars={true} glowColor="56, 189, 248" tiltMax={5}>
        {/* Radial Burst Dial Gauge matching reference design */}
        <RadialBurstDial
          value={currentPercent}
          max={100}
          label="Hydrated"
          unit="%"
          size={190}
          className="water-burst-gauge"
        />

        {/* Hero Information */}
        <div className="water-hero-info">
          <div className="water-stat-main">
            <span className="stat-drank-val">{waterData.total_ml.toLocaleString()}</span>
            <span className="stat-target-val">/ {waterData.target_ml.toLocaleString()} ml</span>
          </div>

          <div className="water-status-pills">
            {isHydrated ? (
              <span className="status-badge-hydrated">Goal reached</span>
            ) : (
              <span className="status-badge-pending">
                {(waterData.target_ml - waterData.total_ml).toLocaleString()} ml to go
              </span>
            )}
            <span className="preset-amount" style={{ fontSize: '0.8rem' }}>
              {waterData.glass_count} drink{waterData.glass_count !== 1 ? 's' : ''} logged
            </span>
          </div>

          {/* Primary Quick Log Action */}
          <button
            type="button"
            className="drink-glass-hero-btn"
            disabled={adding}
            onClick={() => handleAddWater(250, 'Glass of water')}
          >
            <span>Log a glass · 250 ml</span>
          </button>
        </div>
      </BentoCard>

      {/* Quick Volume Presets */}
      <div className="water-presets-grid">
        <button
          type="button"
          className="preset-chip-btn"
          onClick={() => handleAddWater(150, 'Cup of water')}
        >
          <span className="preset-title">Small cup</span>
          <span className="preset-amount">150 ml</span>
        </button>

        <button
          type="button"
          className="preset-chip-btn"
          onClick={() => handleAddWater(250, 'Glass of water')}
        >
          <span className="preset-title">Glass</span>
          <span className="preset-amount">250 ml</span>
        </button>

        <button
          type="button"
          className="preset-chip-btn"
          onClick={() => handleAddWater(350, 'Mug of water')}
        >
          <span className="preset-title">Mug</span>
          <span className="preset-amount">350 ml</span>
        </button>

        <button
          type="button"
          className="preset-chip-btn"
          onClick={() => handleAddWater(500, 'Water Bottle')}
        >
          <span className="preset-title">Half bottle</span>
          <span className="preset-amount">500 ml</span>
        </button>

        <button
          type="button"
          className="preset-chip-btn"
          onClick={() => setShowCustom(!showCustom)}
        >
          <span className="preset-title">Custom</span>
          <span className="preset-amount">{showCustom ? 'Close' : 'Enter ml'}</span>
        </button>
      </div>

      {/* Custom ML Input Row */}
      {showCustom && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const val = parseInt(customMl, 10);
            if (val > 0) handleAddWater(val, `Water (${val} ml)`);
          }}
          className="custom-ml-row animate-fade-in"
        >
          <input
            type="number"
            min="10"
            max="3000"
            className="custom-ml-input"
            placeholder="Amount in ml"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            autoFocus
          />
          <button type="submit" className="custom-ml-btn">
            Add
          </button>
        </form>
      )}

      {/* Hourly Reminder Controller Card */}
      <BentoCard className="reminder-card" enableTilt={true} enableStars={true} glowColor="14, 165, 233" tiltMax={5}>
        <div className="reminder-header-row">
          <div className="reminder-title-group">
            <h4 className="reminder-main-title">
              <span className={`reminder-pulse-dot ${!reminderActive ? 'off' : ''}`} />
              Reminders
            </h4>
            <span className="reminder-sub-desc">
              A chime and an on-screen alert at the interval you choose.
            </span>
          </div>

          {/* Toggle Switch */}
          <div
            className="toggle-switch-wrap"
            onClick={() => setReminderActive(!reminderActive)}
            title="Toggle Hourly Reminders"
          >
            <div className={`toggle-track ${reminderActive ? 'active' : ''}`}>
              <div className="toggle-thumb" />
            </div>
            <span className="toggle-label">{reminderActive ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Live Countdown Banner */}
        {reminderActive ? (
          <div className="countdown-banner">
            <div className="countdown-info">
              <span className="countdown-subtext">Next reminder in</span>
              <div className="countdown-digits">
                {formatTime(secondsLeft)}
                <span className="countdown-interval-tag">every {intervalMinutes} min</span>
              </div>
            </div>

            <div className="reminder-quick-actions">
              <button
                type="button"
                className="reminder-action-btn test-btn"
                onClick={triggerHydrationAlert}
                title="Hear sound and see alert immediately"
              >
                Test alert
              </button>
              <button
                type="button"
                className="reminder-action-btn"
                onClick={() => setSecondsLeft(intervalMinutes * 60)}
                title="Reset countdown timer"
              >
                Reset timer
              </button>
            </div>
          </div>
        ) : (
          <div className="countdown-banner" style={{ opacity: 0.6 }}>
            <span className="countdown-subtext">Reminders are paused.</span>
          </div>
        )}

        {/* Reminder Interval Selector */}
        <div className="interval-chips-row">
          <span className="interval-label">Interval</span>
          {[30, 45, 60, 90, 120].map((mins) => (
            <button
              key={mins}
              type="button"
              className={`interval-pill ${intervalMinutes === mins ? 'active' : ''}`}
              onClick={() => setIntervalMinutes(mins)}
            >
              {mins === 60 ? '1 hour' : mins === 120 ? '2 hours' : `${mins} min`}
            </button>
          ))}
        </div>
      </BentoCard>

      {/* Visual Glass Trackers */}
      <BentoCard className="glasses-grid-card" enableTilt={true} enableStars={true} glowColor="6, 182, 212" tiltMax={5}>
        <div className="glasses-header">
          <span className="glasses-title">Glasses · {glassesFilled} of {totalGlassesTarget}</span>
          <div className="interval-chips-row">
            <span className="interval-label" style={{ fontSize: '0.72rem' }}>Daily goal</span>
            {[2000, 2500, 3000, 3500].map((g) => (
              <button
                key={g}
                type="button"
                className={`interval-pill ${waterData.target_ml === g ? 'active' : ''}`}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}
                onClick={() => handleUpdateTarget(g)}
              >
                {g / 1000}L
              </button>
            ))}
          </div>
        </div>

        <div className="glasses-track">
          {Array.from({ length: totalGlassesTarget }).map((_, i) => (
            <div
              key={i}
              className={`glass-indicator-item ${i < glassesFilled ? 'filled' : ''}`}
              onClick={() => handleAddWater(250, 'Glass of water')}
              title={`Glass ${i + 1} (250 ml) — Click to log`}
            >
              {i < glassesFilled && <div className="glass-water-inner" />}
              <span className="glass-number">{i + 1}</span>
            </div>
          ))}
        </div>
      </BentoCard>

      {/* Today's Hydration Timeline History */}
      <BentoCard className="water-timeline-card" enableTilt={false} enableStars={true} glowColor="56, 189, 248">
        <div className="timeline-title">
          <span>Water log</span>
          <span className="timeline-count-tag">{waterData.entries.length} {waterData.entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>

        {waterData.entries.length === 0 ? (
          <div className="water-empty-state">
            Nothing logged yet.
          </div>
        ) : (
          <div className="shredder-water-wrapper">
            <Shredder
              items={[...waterData.entries].reverse()}
              renderItem={(entry) => (
                <div className="timeline-entry-row">
                  <div className="entry-left-meta">
                    <div className="entry-water-bubble" />
                    <div>
                      <div className="entry-type-text">{entry.type}</div>
                      <div className="entry-time-text">{entry.time}</div>
                    </div>
                  </div>

                  <div className="entry-right-meta">
                    <span className="entry-amount-pill">+{entry.amount_ml} ml</span>
                    <button
                      type="button"
                      className="entry-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWater(entry.id);
                      }}
                      title="Remove this log"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              onShred={(entry) => handleDeleteWater(entry.id)}
              width={600}
              height={Math.max(200, waterData.entries.length * 74 + 120)}
              gap={10}
              fallHeight={100}
              slitColor="rgba(255, 255, 255, 0.12)"
              slitHeight={3}
              feedSpeed={190}
              bite={20}
              stripWidth={9}
              curl={1.2}
            />
          </div>
        )}
      </BentoCard>
    </div>
  );
}
