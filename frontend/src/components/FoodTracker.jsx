import React, { useState, useEffect, useRef, useCallback } from 'react';
import RadialBurstDial from './RadialBurstDial';
import Shredder from './Shredder';
import BentoCard from './BentoCard';
import TrendCharts from './TrendCharts';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './FoodTracker.css';

const API = '/api';

// Rating color and badge mapping: Good, Okay, Not good
function getRatingMeta(rating) {
  switch (rating) {
    case 'Good':
      return {
        label: 'Good',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)'
      };
    case 'Ok':
    case 'Okay':
      return {
        label: 'Okay',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)'
      };
    case 'Bad':
    case 'Not good':
    default:
      return {
        label: 'Not good',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)'
      };
  }
}

// Circular Score Indicator
function ScoreRing({ score = 0, color = '#ffffff', size = 96 }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const safeScore = Math.max(0, Math.min(score, 90));
  const offset = score > 0 ? circ - (circ * safeScore) / 90 : circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth="7"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s',
          filter: score > 0 ? `drop-shadow(0 0 8px ${color}80)` : 'none'
        }}
      />
    </svg>
  );
}

// Food property questions for unknown foods
const FOOD_QUESTIONS = [
  { key: 'Healthy', label: 'Is it healthy / nutritious? (fruits, vegetables, clean meal)', positive: true },
  { key: 'Good_food', label: 'Is it a wholesome, home-cooked style food?', positive: true },
  { key: 'Protein_rich', label: 'Is it rich in protein? (dal, paneer, eggs, chicken, sprouts, tofu)', positive: true },
  { key: 'Fibre_rich', label: 'Is it high in dietary fibre? (salads, oats, whole grains, seeds)', positive: true },
  { key: 'Sugary_drink', label: 'Is it a soft drink, soda, cold drink, or energy drink?', positive: false },
  { key: 'Sugar', label: 'Does it contain added sugar, syrup, or sweets?', positive: false },
  { key: 'Junk', label: 'Is it packaged junk food / ultra-processed fast food?', positive: false },
  { key: 'Fried', label: 'Is it deep fried? (samosa, pakora, fries, bhatura)', positive: false },
  { key: 'Refined', label: 'Is it made with refined flour (maida)?', positive: false },
  { key: 'Oil', label: 'Is it cooked with excess oil / ghee / butter?', positive: false },
];

function calculateEstimatedScore(flags) {
  const pos = (flags.Healthy ? 15 : 0) +
              (flags.Good_food ? 15 : 0) +
              (flags.Protein_rich ? 5 : 0) +
              (flags.Fibre_rich ? 5 : 0);

  const isDrink = flags.Sugary_drink;
  const neg = (isDrink ? 25 : 0) +
              (flags.Sugar ? 12 : 0) +
              (flags.Junk ? 15 : 0) +
              (flags.Fried ? 15 : 0) +
              (flags.Refined ? 8 : 0) +
              (flags.Oil ? 5 : 0);

  if (pos === 0) {
    if (isDrink) return 25;
    if (neg > 0) return Math.max(10, Math.min(35, 35 - neg + 5));
    return 35;
  }

  const raw = 45 + pos - neg;
  if (isDrink) return 25;
  if (flags.Sugar && !flags.Healthy && !flags.Good_food) {
    return Math.max(15, Math.min(35, raw));
  }
  return Math.max(10, Math.min(90, raw));
}

// Unknown Food Questionnaire Modal
function UnknownFoodModal({ foodName, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState(() => {
    const init = {};
    FOOD_QUESTIONS.forEach(q => { init[q.key] = false; });

    // Auto-detection based on food name keywords
    const fn = (foodName || '').toLowerCase();
    const drinkKeywords = ['drink', 'soda', 'cola', 'coke', 'sprite', 'pepsi', 'fanta', 'dew', 'fizz', 'beverage', 'shake', 'juice'];
    const junkKeywords = ['chips', 'crisps', 'fry', 'fries', 'kurkure', 'puff', 'doritos', 'snack', 'candy'];
    const sweetKeywords = ['sweet', 'mithai', 'halwa', 'laddu', 'candy', 'chocolate', 'cake', 'pastry'];

    if (drinkKeywords.some(k => fn.includes(k))) {
      init.Sugary_drink = true;
      init.Sugar = true;
      init.Junk = true;
    }
    if (junkKeywords.some(k => fn.includes(k))) {
      init.Junk = true;
      init.Fried = true;
      init.Oil = true;
    }
    if (sweetKeywords.some(k => fn.includes(k))) {
      init.Sugar = true;
    }

    return init;
  });

  const toggle = (key) => {
    setAnswers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const estScore = calculateEstimatedScore(answers);
  const estRating = estScore >= 65 ? 'Good' : (estScore >= 40 ? 'Okay' : 'Not good');
  const estMeta = getRatingMeta(estRating);

  return (
    <div className="unknown-food-overlay" onClick={onCancel}>
      <div className="unknown-food-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ufm-header">
          <h3 className="ufm-title">"{foodName}" isn't in the database yet</h3>
          <p className="ufm-subtitle">
            Answer these once. The score is saved, so you won't be asked again for this food.
          </p>
        </div>

        <div className="ufm-questions">
          {FOOD_QUESTIONS.map((q) => (
            <button
              key={q.key}
              type="button"
              className={`ufm-question-btn ${answers[q.key] ? (q.positive ? 'ans-yes-good' : 'ans-yes-bad') : ''}`}
              onClick={() => toggle(q.key)}
            >
              <span className="ufm-q-text">{q.label}</span>
              <span className={`ufm-toggle ${answers[q.key] ? 'active' : ''}`}>
                {answers[q.key] ? 'Yes' : 'No'}
              </span>
            </button>
          ))}
        </div>

        {/* Real-time Estimated Score Card */}
        <div className="ufm-preview-card">
          <div className="ufm-preview-info">
            <span className="ufm-preview-label">Estimated score</span>
            <span className="ufm-preview-score" style={{ color: estMeta.color }}>
              {estScore}
              <span className="ufm-preview-scale">/ 90</span>
            </span>
          </div>
          <div
            className="ufm-preview-badge"
            style={{
              color: estMeta.color,
              background: estMeta.bg,
              borderColor: estMeta.border,
            }}
          >
            {estMeta.label}
          </div>
        </div>

        <div className="ufm-actions">
          <button type="button" className="ufm-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="ufm-submit-btn"
            onClick={() => onSubmit(answers)}
          >
            Save score
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FoodTracker({ initialDate, defaultView = 'tracker' }) {
  // Today's date string YYYY-MM-DD
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(initialDate || todayStr);
  const { refreshUser } = useAuth();

  // Day log data state
  const [dayData, setDayData] = useState({
    date: selectedDate,
    day: 'Today',
    items: [],
    items_count: 0,
    total_score: 0.0,
    overall_rating: 'None',
    overall_verdict: 'No food logged yet today. Starts at 0 score.'
  });

  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [foodInput, setFoodInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSugIndex, setSelectedSugIndex] = useState(-1);
  const [allDaysHistory, setAllDaysHistory] = useState([]);
  const [viewMode, setViewMode] = useState(defaultView);

  // Unknown food modal state
  const [unknownFood, setUnknownFood] = useState(null); // { name: string } or null

  useEffect(() => {
    if (defaultView) setViewMode(defaultView);
  }, [defaultView]);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Fetch food log for selectedDate
  const fetchDayLog = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/logs?date=${encodeURIComponent(dateStr)}`);
      if (res.ok) {
        const data = await res.json();
        setDayData(data);
      }
    } catch (err) {
      console.error('Failed to fetch day log:', err);
    }
    setLoading(false);
  }, []);

  // Fetch all days history dataset
  const fetchAllHistory = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/logs/all`);
      if (res.ok) {
        const data = await res.json();
        setAllDaysHistory(data.days || []);
      }
    } catch (err) {
      console.error('Failed to fetch all history:', err);
    }
  }, []);

  useEffect(() => {
    fetchDayLog(selectedDate);
    fetchAllHistory();
  }, [selectedDate, fetchDayLog, fetchAllHistory]);

  // Autocomplete suggestions (returns objects with name, score, rating)
  useEffect(() => {
    const q = foodInput.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedSugIndex(-1);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`${API}/suggestions?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setSuggestions(d.suggestions || []);
          setShowSuggestions(true);
          setSelectedSugIndex(-1);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    }, 90);
    return () => clearTimeout(debounceRef.current);
  }, [foodInput]);

  // Add food — first check if it's in dataset, if not show questionnaire
  const handleAddFood = async (e) => {
    if (e) e.preventDefault();
    const query = foodInput.trim();
    if (!query) return;

    setAdding(true);
    setShowSuggestions(false);

    try {
      // First check if food exists in dataset by scoring it
      const checkRes = await apiFetch(`${API}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query })
      });

      if (checkRes.ok) {
        const scoreData = await checkRes.json();

        if (!scoreData.from_dataset) {
          // Food NOT in dataset — show questionnaire
          setAdding(false);
          setUnknownFood({ name: query });
          return;
        }

        // Food IS in dataset — add it directly
        const res = await apiFetch(`${API}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ food: query, date: selectedDate })
        });
        if (res.ok) {
          const data = await res.json();
          setDayData(data.day_summary);
        refreshUser();
          setFoodInput('');
          fetchAllHistory();
        }
      }
    } catch (err) {
      console.error('Failed to add food:', err);
    }
    setAdding(false);
  };

  // Submit unknown food with user-provided flags
  const handleUnknownFoodSubmit = async (flags) => {
    if (!unknownFood) return;
    setAdding(true);

    try {
      const res = await apiFetch(`${API}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food: unknownFood.name,
          date: selectedDate,
          custom_flags: flags
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDayData(data.day_summary);
        refreshUser();
        setFoodInput('');
        fetchAllHistory();
      }
    } catch (err) {
      console.error('Failed to add custom-scored food:', err);
    }

    setUnknownFood(null);
    setAdding(false);
  };

  const handlePickSuggestion = async (sugName) => {
    setFoodInput(sugName);
    setShowSuggestions(false);
    setAdding(true);
    try {
      const checkRes = await apiFetch(`${API}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sugName })
      });
      if (checkRes.ok) {
        const scoreData = await checkRes.json();
        if (!scoreData.from_dataset) {
          setAdding(false);
          setUnknownFood({ name: sugName });
          return;
        }
      }

      const res = await apiFetch(`${API}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food: sugName, date: selectedDate })
      });
      if (res.ok) {
        const data = await res.json();
        setDayData(data.day_summary);
        refreshUser();
        setFoodInput('');
        fetchAllHistory();
      }
    } catch (err) {
      console.error('Failed to log suggested food:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleAddFood(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSugIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSugIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSugIndex >= 0 && selectedSugIndex < suggestions.length) {
        const picked = suggestions[selectedSugIndex];
        const sugName = typeof picked === 'string' ? picked : picked.name;
        handlePickSuggestion(sugName);
      } else {
        handleAddFood(e);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Delete food item
  const handleDeleteItem = async (itemId) => {
    try {
      const res = await apiFetch(`${API}/logs/${encodeURIComponent(itemId)}?date=${encodeURIComponent(selectedDate)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updated = await res.json();
        setDayData(updated);
        fetchAllHistory();
        refreshUser();
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // Date navigation helpers
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const nextStr = d.toISOString().split('T')[0];
    setSelectedDate(nextStr);
  };

  const isToday = selectedDate === todayStr;
  const dayMeta = dayData.overall_rating !== 'None' ? getRatingMeta(dayData.overall_rating) : null;

  // Export the report as JSON, grouped by day, week or month
  const [showExport, setShowExport] = useState(false);

  const handleExportDataset = (grouping) => {
    const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const days = [...allDaysHistory].sort((x, y) => (x.date < y.date ? -1 : 1));

    const summarise = (list) => {
      const foodDays = list.filter((d) => (d.items || []).length > 0);
      const avg = (values) => (values.length ? Math.round((values.reduce((p, c) => p + c, 0) / values.length) * 10) / 10 : 0);
      return {
        days_logged: list.length,
        meals_logged: list.reduce((sum, d) => sum + (d.items || []).length, 0),
        avg_food_score: avg(foodDays.map((d) => Number(d.total_score) || 0)),
        avg_water_ml: Math.round(avg(list.map((d) => Number(d.water?.total_ml) || 0))),
        water_goal_days: list.filter((d) => (d.water?.percentage || 0) >= 100).length
      };
    };

    const groupBy = (keyOf, labelOf) => {
      const groups = new Map();
      days.forEach((d) => {
        const key = keyOf(d.date);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
      });
      return [...groups.entries()].map(([key, list]) => ({ ...labelOf(key), ...summarise(list), days: list }));
    };

    const weekStart = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
      return d.toISOString().split('T')[0];
    };
    const addDays = (dateStr, n) => {
      const d = new Date(dateStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    let payload;
    if (grouping === 'weeks') {
      payload = groupBy(weekStart, (key) => ({ week_start: key, week_end: addDays(key, 6) }));
    } else if (grouping === 'months') {
      payload = groupBy((date) => date.slice(0, 7), (key) => ({ month: key }));
    } else {
      payload = days;
    }

    const body = { grouping, exported_on: stamp, total: summarise(days), [grouping]: payload };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(body, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fitgoals_report_by_${grouping}_${stamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowExport(false);
  };

  return (
    <div className="food-tracker-root animate-fade-in">
      {/* Unknown Food Questionnaire Modal */}
      {unknownFood && (
        <UnknownFoodModal
          foodName={unknownFood.name}
          onSubmit={handleUnknownFoodSubmit}
          onCancel={() => setUnknownFood(null)}
        />
      )}

      {/* Export: ask how to group the file */}
      {showExport && (
        <div className="unknown-food-overlay" onClick={() => setShowExport(false)}>
          <div className="unknown-food-modal export-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ufm-header">
              <h3 className="ufm-title">Export report</h3>
              <p className="ufm-subtitle">How should the file be grouped?</p>
            </div>
            <div className="export-options">
              {[
                { id: 'days', title: 'Days', desc: 'One entry per day, with every meal and drink.' },
                { id: 'weeks', title: 'Weeks', desc: 'Grouped Monday to Sunday, with weekly averages.' },
                { id: 'months', title: 'Months', desc: 'Grouped by calendar month, with monthly averages.' }
              ].map((opt) => (
                <button key={opt.id} type="button" className="export-option" onClick={() => handleExportDataset(opt.id)}>
                  <span className="export-option-title">{opt.title}</span>
                  <span className="export-option-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div className="ufm-actions">
              <button type="button" className="ufm-cancel-btn" onClick={() => setShowExport(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Switcher Bar */}
      <div className="tracker-nav-header">
        <div className="view-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'tracker' ? 'active' : ''}`}
            style={viewMode === 'tracker' ? { background: '#ffffff', color: '#000000' } : {}}
            onClick={() => setViewMode('tracker')}
          >
            <span style={viewMode === 'tracker' ? { color: '#000000' } : {}}>Food Tracker</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'history' ? 'active' : ''}`}
            style={viewMode === 'history' ? { background: '#ffffff', color: '#000000' } : {}}
            onClick={() => setViewMode('history')}
          >
            <span style={viewMode === 'history' ? { color: '#000000' } : {}}>
              Report ({allDaysHistory.length} {allDaysHistory.length === 1 ? 'day' : 'days'})
            </span>
          </button>
        </div>

        {viewMode === 'tracker' && allDaysHistory.length > 0 && (
          <button
            type="button"
            className="export-dataset-btn"
            onClick={() => setShowExport(true)}
            title="Download the full food and water report as JSON"
          >
            <span>Export JSON</span>
          </button>
        )}
      </div>

      {viewMode === 'tracker' ? (
        <div className="tracker-main-container">
          {/* Day Date Navigation Strip */}
          <div className="date-nav-bar">
            <button
              type="button"
              className="nav-arrow-btn"
              onClick={() => shiftDate(-1)}
              title="Previous Day"
            >
              ‹
            </button>

            <div className="date-info-display">
              <div className="date-day-name">
                {dayData.day} {isToday && <span className="today-badge">Today</span>}
              </div>
              <div className="date-full-text">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>

            <button
              type="button"
              className="nav-arrow-btn"
              onClick={() => shiftDate(1)}
              title="Next Day"
            >
              ›
            </button>

            {!isToday && (
              <button
                type="button"
                className="reset-today-btn"
                onClick={() => setSelectedDate(todayStr)}
              >
                Go to Today
              </button>
            )}
          </div>

          {/* Quick Days Strip */}
          {allDaysHistory.length > 0 && (
            <div className="history-quick-strip">
              <span className="quick-strip-label">Recent</span>
              {allDaysHistory.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className={`day-chip ${d.date === selectedDate ? 'chip-active' : ''}`}
                  onClick={() => setSelectedDate(d.date)}
                >
                  <span className="chip-day">{d.day.slice(0, 3)}</span>
                  <span className="chip-score">{d.total_score > 0 ? `${Math.round(d.total_score)}` : '0'}</span>
                </button>
              ))}
            </div>
          )}

          {/* Add Food Input Box */}
          <div className="food-input-card">
            <form onSubmit={handleAddFood} className="food-input-form">
              <div className="food-input-wrap">
                <input
                  ref={inputRef}
                  type="text"
                  className="food-text-field"
                  placeholder="Search or type a food, e.g. dosa, biryani, banana"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0 || foodInput.trim()) setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                  onKeyDown={handleKeyDown}
                />
                {foodInput && (
                  <button
                    type="button"
                    className="clear-input-btn"
                    onClick={() => {
                      setFoodInput('');
                      setShowSuggestions(false);
                      setSelectedSugIndex(-1);
                      inputRef.current?.focus();
                    }}
                  >
                    ×
                  </button>
                )}

                {/* Suggestions Dropdown — shows name, score, rating with keyboard & click support */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-popover" onMouseDown={(e) => e.preventDefault()}>
                    <div className="suggestions-header">
                      <span>Foods starting with "{foodInput.trim()}" ({suggestions.length})</span>
                      <span className="suggestions-tip">↑ / ↓ to navigate • Enter to select</span>
                    </div>
                    <div className="suggestions-list-scroll">
                      {suggestions.map((sug, i) => {
                        const sugName = typeof sug === 'string' ? sug : sug.name;
                        const sugScore = typeof sug === 'object' ? sug.score : null;
                        const sugRating = typeof sug === 'object' ? sug.rating : null;
                        const rm = sugRating ? getRatingMeta(sugRating) : null;
                        const isSelected = i === selectedSugIndex;

                        return (
                          <button
                            key={i}
                            type="button"
                            className={`suggestion-row ${isSelected ? 'is-selected' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickSuggestion(sugName);
                            }}
                            onMouseEnter={() => setSelectedSugIndex(i)}
                          >
                            <span className="sug-name">{sugName}</span>
                            {sugScore !== null && (
                              <span className="sug-score-info">
                                <span className="sug-score-num" style={{ color: rm ? rm.color : '#94a3b8' }}>
                                  {sugScore}
                                </span>
                                <span className="sug-score-max">/90</span>
                                {rm && (
                                  <span
                                    className="sug-rating-tag"
                                    style={{ color: rm.color, backgroundColor: rm.bg, borderColor: rm.border }}
                                  >
                                    {rm.label}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="add-food-btn"
                disabled={adding || !foodInput.trim()}
              >
                {adding ? (
                  <span>Checking…</span>
                ) : (
                  <span>Add food</span>
                )}
              </button>
            </form>
          </div>

          {/* Day Total Score Highlight Card */}
          <BentoCard
            className="day-score-banner"
            enableTilt={true}
            enableStars={true}
            glowColor={dayMeta ? (dayMeta.color === '#10b981' ? '16, 185, 129' : dayMeta.color === '#f59e0b' ? '245, 158, 11' : '239, 68, 68') : '56, 189, 248'}
            tiltMax={5}
          >
            <RadialBurstDial
              value={dayData.items_count > 0 ? dayData.total_score : 0}
              max={90}
              displayValue={dayData.items_count > 0 ? Math.round(dayData.total_score) : 0}
              label="/ 90"
              size={120}
              activeColor={dayMeta ? dayMeta.color : null}
              className="food-score-burst-gauge"
            />

            <div className="day-score-info">
              <div className="day-score-header">
                <h3 className="day-score-title">
                  {isToday ? "Today's score" : `${dayData.day}'s score`}
                </h3>
                {dayMeta ? (
                  <div
                    className="rating-badge"
                    style={{
                      backgroundColor: dayMeta.bg,
                      borderColor: dayMeta.border,
                      color: dayMeta.color
                    }}
                  >
                    <span>{dayMeta.label}</span>
                  </div>
                ) : (
                  <div className="rating-badge rating-awaiting">
                    <span>No entries</span>
                  </div>
                )}
              </div>

              <p className="day-verdict-text">
                {dayData.items_count > 0
                  ? dayData.overall_verdict
                  : 'Add what you ate to see each item\'s score and your daily average.'}
              </p>

              <div className="day-score-meta">
                <span className="item-count-chip">
                  <strong>{dayData.items_count}</strong> {dayData.items_count === 1 ? 'item' : 'items'} logged
                </span>
              </div>
            </div>
          </BentoCard>

          {/* List of Eaten Foods for Selected Day */}
          <BentoCard
            className="eaten-list-card"
            enableTilt={false}
            enableStars={true}
            glowColor="132, 0, 255"
          >
            <div className="list-card-header">
              <h4 className="list-title">Food log</h4>
              <span className="list-subtitle">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>

            {dayData.items.length === 0 ? (
              <div className="empty-day-state">
                <p className="empty-title">Nothing logged yet</p>
                <p className="empty-sub">
                  {isToday
                    ? 'Type a food above to score it and add it to today.'
                    : `No food was recorded for ${dayData.day}.`}
                </p>
              </div>
            ) : (
              <div className="shredder-food-wrapper">
                <Shredder
                  items={dayData.items}
                  renderItem={(item) => {
                    const m = getRatingMeta(item.rating);
                    return (
                      <div className="food-item-row">
                        <div className="item-left">
                          <div className="item-text-col">
                            <div className="item-name-row">
                              <span className="food-name-text">{item.name}</span>
                              <span
                                className="food-badge-simple"
                                style={{
                                  color: m.color,
                                  backgroundColor: m.bg,
                                  borderColor: m.border
                                }}
                              >
                                {m.label}
                              </span>
                            </div>
                            <div className="food-verdict-sub">
                              {item.verdict} • <span className="time-sub">{item.time}</span>
                            </div>
                          </div>
                        </div>

                        <div className="item-right">
                          <div className="item-score-pill">
                            <span className="score-val" style={{ color: m.color }}>
                              {Math.round(item.score)}
                            </span>
                            <span className="score-denom">/ 90</span>
                          </div>
                          <button
                            type="button"
                            className="delete-item-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            title="Remove food"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  }}
                  onShred={(item) => handleDeleteItem(item.id)}
                  width={680}
                  height={Math.max(220, dayData.items.length * 82 + 130)}
                  gap={10}
                  fallHeight={110}
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
      ) : (
        /* Report View */
        <BentoCard className="dataset-history-view animate-fade-in" enableTilt={false} enableStars={true} glowColor="56, 189, 248">
          <div className="history-view-header">
            <div>
              <h3 className="history-main-title">Report</h3>
              <p className="history-subtitle">Meals, scores and water intake by day.</p>
            </div>
            <button type="button" className="export-dataset-btn" onClick={() => setShowExport(true)}>
              <span>Export JSON</span>
            </button>
          </div>

          {/* Summary across all days */}
          {(() => {
            const days = allDaysHistory;
            const foodDays = days.filter((d) => (d.items || []).length > 0);
            const avgFood = foodDays.length
              ? Math.round(foodDays.reduce((sum, d) => sum + (d.total_score || 0), 0) / foodDays.length)
              : 0;
            const avgWater = days.length
              ? Math.round(days.reduce((sum, d) => sum + (d.water?.total_ml || 0), 0) / days.length)
              : 0;
            const goalDays = days.filter((d) => (d.water?.percentage || 0) >= 100).length;
            const meals = days.reduce((sum, d) => sum + (d.items || []).length, 0);

            return (
              <div className="rp-summary">
                <div className="rp-kpi">
                  <span className="rp-kpi-label">Days tracked</span>
                  <span className="rp-kpi-value">{days.length}</span>
                </div>
                <div className="rp-kpi">
                  <span className="rp-kpi-label">Avg food score</span>
                  <span className="rp-kpi-value">{avgFood}<span className="rp-kpi-unit"> / 90</span></span>
                </div>
                <div className="rp-kpi">
                  <span className="rp-kpi-label">Meals logged</span>
                  <span className="rp-kpi-value">{meals}</span>
                </div>
                <div className="rp-kpi">
                  <span className="rp-kpi-label">Avg water / day</span>
                  <span className="rp-kpi-value">{avgWater.toLocaleString()}<span className="rp-kpi-unit"> ml</span></span>
                </div>
                <div className="rp-kpi">
                  <span className="rp-kpi-label">Water goal met</span>
                  <span className="rp-kpi-value">{goalDays}<span className="rp-kpi-unit"> / {days.length} days</span></span>
                </div>
              </div>
            );
          })()}

          {allDaysHistory.length === 0 && (
            <div className="history-empty-note">Nothing logged yet.</div>
          )}

          {/* Daily, weekly and monthly progress */}
          {allDaysHistory.length > 0 && <TrendCharts days={allDaysHistory} />}

          <div className="history-days-stack">
            {allDaysHistory.map((dayEntry) => {
              const dm =
                dayEntry.overall_rating && dayEntry.overall_rating !== 'None'
                  ? getRatingMeta(dayEntry.overall_rating)
                  : null;

              const water = dayEntry.water || {};
              const waterTotal = water.total_ml || 0;
              const waterTarget = water.target_ml || 2500;
              const waterPercent = water.percentage || 0;
              const waterEntries = water.entries || [];
              const foodItems = dayEntry.items || [];
              const dateLabel = new Date(dayEntry.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div key={dayEntry.date} className="history-day-card">
                  <div className="history-day-header">
                    <div className="history-day-title-wrap">
                      <span className="history-day-name">{dayEntry.day}</span>
                      <span className="history-date-sub">{dateLabel}</span>
                    </div>
                    <button
                      type="button"
                      className="open-day-btn"
                      onClick={() => {
                        setSelectedDate(dayEntry.date);
                        setViewMode('tracker');
                      }}
                    >
                      Open day
                    </button>
                  </div>

                  {/* Day totals */}
                  <div className="rp-day-stats">
                    <div className="rp-stat-box">
                      <span className="rp-kpi-label">Food score</span>
                      <div className="rp-stat-line">
                        <span className="rp-stat-value" style={{ color: dm ? dm.color : undefined }}>
                          {foodItems.length > 0 ? Math.round(dayEntry.total_score) : 0}
                        </span>
                        <span className="rp-kpi-unit">/ 90</span>
                        {dm && (
                          <span
                            className="food-rating-tag"
                            style={{ color: dm.color, backgroundColor: dm.bg, borderColor: dm.border }}
                          >
                            {dm.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rp-stat-box">
                      <span className="rp-kpi-label">Water</span>
                      <div className="rp-stat-line">
                        <span className="rp-stat-value">{waterTotal.toLocaleString()}</span>
                        <span className="rp-kpi-unit">/ {waterTarget.toLocaleString()} ml</span>
                        <span className="rp-percent">{waterPercent}%</span>
                      </div>
                      <div className="history-water-mini-track">
                        <div
                          className="history-water-mini-fill"
                          style={{
                            width: `${Math.min(100, waterPercent)}%`,
                            backgroundColor: waterPercent >= 100 ? '#10b981' : '#5bb8ea'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Meals and water tables */}
                  <div className="history-day-sections-grid">
                    <div className="history-section-box">
                      <div className="history-section-title">
                        <span>Meals</span>
                        <span className="section-count-badge">{foodItems.length}</span>
                      </div>

                      {foodItems.length > 0 ? (
                        <div className="rp-table">
                          {foodItems.map((food, idx) => {
                            const fm = getRatingMeta(food.rating);
                            return (
                              <div key={food.id || idx} className="rp-row">
                                <span className="chip-bullet" style={{ backgroundColor: fm.color }} title={fm.label} />
                                <span className="rp-cell-name">{food.name}</span>
                                <span className="rp-cell-time">{food.time || ''}</span>
                                <span className="rp-cell-num" style={{ color: fm.color }}>{Math.round(food.score)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="history-empty-note">No meals logged</div>
                      )}
                    </div>

                    <div className="history-section-box">
                      <div className="history-section-title">
                        <span>Water</span>
                        <span className="section-count-badge">{waterEntries.length}</span>
                      </div>

                      {waterEntries.length > 0 ? (
                        <div className="rp-table">
                          {waterEntries.map((entry, idx) => (
                            <div key={entry.id || idx} className="rp-row">
                              <span className="chip-bullet water-bullet" />
                              <span className="rp-cell-name">{entry.type || 'Glass of water'}</span>
                              <span className="rp-cell-time">{entry.time || ''}</span>
                              <span className="rp-cell-num">{entry.amount_ml || 250} ml</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="history-empty-note">No water logged</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCard>
      )}
    </div>
  );
}
