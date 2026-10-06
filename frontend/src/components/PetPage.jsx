import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Lock, Award, RefreshCw, RotateCcw } from 'lucide-react';
import { apiFetch } from '../services/api';
import Dog, { MOOD_LABEL } from './Dog';
import './PetPage.css';

const API = '/api';

function localToday() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export default function PetPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  // lets you watch any mood's animation without changing today's real mood
  const [previewMood, setPreviewMood] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/pet?date=${encodeURIComponent(localToday())}`);
      if (!res.ok) throw new Error('bad status');
      setData(await res.json());
      setFailed(false);
    } catch (e) {
      console.error('Failed to load pet:', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="pet-page"><div className="pet-state">Loading…</div></div>;
  if (failed || !data) {
    return (
      <div className="pet-page">
        <div className="pet-state">
          Couldn't load your pet.
          <button type="button" className="pet-link-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  const { pet, tasks, badges } = data;
  const shownMood = previewMood || pet.mood;
  const healthColor =
    pet.health === null ? '#6b7180' : pet.health >= 70 ? '#10b981' : pet.health >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="pet-page">
      <header className="pet-head-row">
        <div>
          <h2 className="pet-title">Pet</h2>
          <p className="pet-sub">{pet.name} eats what you eat. Feed it well and it grows.</p>
        </div>
        <button type="button" className="pet-icon-btn" onClick={load} title="Refresh" aria-label="Refresh">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="pet-top-grid">
        {/* Pet card */}
        <section className="pet-card">
          <div className={`pet-stage pet-stage-${shownMood}`}>
            <Dog key={`${replayKey}-${shownMood}`} mood={shownMood} stageIndex={pet.stage_index} fed={pet.fed.length > 0} />
            <div className="pet-preview-row" role="group" aria-label="Preview a mood">
              {Object.keys(MOOD_LABEL).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`pet-preview-chip${shownMood === m ? ' is-on' : ''}`}
                  onClick={() => setPreviewMood(m === pet.mood ? null : m)}
                  aria-pressed={shownMood === m}
                  title={m === pet.mood ? "Today's mood" : `Preview: ${MOOD_LABEL[m]}`}
                >
                  {MOOD_LABEL[m]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pet-replay-btn"
              onClick={() => setReplayKey((k) => k + 1)}
              title="Replay animation"
              aria-label="Replay animation"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="pet-info">
            <div className="pet-name-row">
              <span className="pet-name">{pet.name}</span>
              <span className="pet-tag">{pet.stage}</span>
              <span className={`pet-tag pet-mood-tag mood-${pet.mood}`}>{MOOD_LABEL[pet.mood]}</span>
            </div>
            <p className="pet-message">{pet.message}</p>

            <div className="pet-meter">
              <div className="pet-meter-head">
                <span className="pet-label">Health today</span>
                <span className="pet-meter-value">{pet.health === null ? '—' : `${pet.health} / 100`}</span>
              </div>
              <div className="pet-meter-track">
                <div className="pet-meter-fill" style={{ width: `${pet.health || 0}%`, backgroundColor: healthColor }} />
              </div>
            </div>

            <div className="pet-facts">
              <div className="pet-fact">
                <span className="pet-label">Good days</span>
                <span className="pet-fact-value">{pet.good_days}</span>
              </div>
              <div className="pet-fact">
                <span className="pet-label">Clean streak</span>
                <span className="pet-fact-value">{pet.clean_streak}<span className="pet-unit"> {pet.clean_streak === 1 ? 'day' : 'days'}</span></span>
              </div>
              <div className="pet-fact">
                <span className="pet-label">Next stage</span>
                <span className="pet-fact-value pet-fact-small">
                  {pet.next_stage ? `${pet.next_stage} at ${pet.next_stage_at} good days` : 'Fully grown'}
                </span>
              </div>
            </div>
          </div>

          <div className="pet-fed">
            <span className="pet-label">Fed today</span>
            {pet.fed.length === 0 ? (
              <span className="pet-fed-empty">
                Nothing yet.
                {onNavigate && (
                  <button type="button" className="pet-link-btn" onClick={() => onNavigate('/tracker')}>Log a meal</button>
                )}
              </span>
            ) : (
              <div className="pet-fed-list">
                {pet.fed.map((f, i) => (
                  <span key={i} className={`pet-fed-chip ${f.bad ? 'bad' : ''}`}>
                    <span className="pet-fed-dot" />
                    {f.name}
                    <span className="pet-fed-score">{Math.round(f.score)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Daily tasks */}
        <section className="pet-card pet-tasks">
          <div className="pet-card-head">
            <h3 className="pet-card-title">Daily tasks</h3>
            <span className="pet-count">{data.tasks_done} of {tasks.length} done</span>
          </div>
          <div className="pet-xp-row">
            <span className="pet-xp-value">{data.xp_earned}<span className="pet-unit"> / {data.xp_total} XP</span></span>
            <div className="pet-meter-track">
              <div className="pet-meter-fill" style={{ width: `${data.xp_total ? (data.xp_earned / data.xp_total) * 100 : 0}%`, backgroundColor: '#d9b45b' }} />
            </div>
          </div>
          <ul className="pet-task-list">
            {tasks.map((t) => (
              <li key={t.id} className={`pet-task ${t.done ? 'done' : ''} ${t.failed ? 'failed' : ''}`}>
                <span className="pet-task-check">
                  {t.done ? <Check size={14} /> : t.failed ? <X size={14} /> : null}
                </span>
                <span className="pet-task-main">
                  <span className="pet-task-title">{t.title}</span>
                  <span className="pet-task-progress">
                    {t.failed ? 'Missed today' : t.done ? 'Done' : t.status}
                  </span>
                </span>
                <span className="pet-task-xp">+{t.xp} XP</span>
              </li>
            ))}
          </ul>
          <p className="pet-note">Four of the six tasks change every day. They reset at midnight.</p>
        </section>
      </div>

      {/* Badges */}
      <section className="pet-card">
        <div className="pet-card-head">
          <h3 className="pet-card-title">Badges</h3>
          <span className="pet-count">{data.badges_earned} of {badges.length} earned</span>
        </div>
        {[...new Set(badges.map((b) => b.group))].map((group) => (
          <div key={group} className="pet-badge-group">
            <span className="pet-label">{group}</span>
            <div className="pet-badge-grid">
              {badges.filter((b) => b.group === group).map((b) => (
                <div key={b.id} className={`pet-badge ${b.earned ? 'earned' : 'locked'} tier-${b.tier}`}>
                  <div className="pet-badge-icon">{b.earned ? <Award size={20} /> : <Lock size={16} />}</div>
                  <div className="pet-badge-text">
                    <span className="pet-badge-title">{b.title}</span>
                    <span className="pet-badge-desc">{b.description}</span>
                    {!b.earned && (
                      <div className="pet-badge-progress">
                        <div className="pet-meter-track">
                          <div className="pet-meter-fill" style={{ width: `${(b.progress / b.target) * 100}%`, backgroundColor: '#a1a6b0' }} />
                        </div>
                        <span>{b.progress} / {b.target}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
