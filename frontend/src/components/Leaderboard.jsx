import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRight, X, Award } from 'lucide-react';
import Dog, { MOOD_LABEL } from './Dog';
import { useAuth } from '../context/AuthContext';
import './Leaderboard.css';

const API = '/api';

const MEDALS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function formatWater(ml) {
  const n = Number(ml) || 0;
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(2))} L`;
  return `${n} ml`;
}

// User photo, or initial as fallback
function AthletePhoto({ photo, initial, name = 'User', size = 40, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const style = { width: `${size}px`, height: `${size}px` };

  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setImgError(true)}
        className={`lb-avatar ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`lb-avatar lb-avatar-initial ${className}`}
      style={{ ...style, fontSize: `${Math.round(size * 0.4)}px` }}
      aria-label={name}
    >
      {(initial || name?.charAt(0) || 'U').toUpperCase()}
    </div>
  );
}

// Public card for one athlete: today's food, water, pet and earned badges
function ProfileModal({ athleteId, rank, onClose }) {
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setFailed(false);
    (async () => {
      try {
        const res = await fetch(`${API}/profile/${encodeURIComponent(athleteId)}`);
        if (!res.ok) throw new Error('bad status');
        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    })();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [athleteId, onClose]);

  return (
    <div className="lb-modal-overlay" onClick={onClose}>
      <div className="lb-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="lb-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {failed ? (
          <div className="lb-state">Couldn't load this profile.</div>
        ) : !profile ? (
          <div className="lb-state">Loading…</div>
        ) : (
          <>
            <div className="lb-modal-head">
              <AthletePhoto photo={profile.photo} name={profile.name} size={52} />
              <div className="lb-modal-identity">
                <span className="lb-modal-name">{profile.name}</span>
                <span className="lb-modal-sub">
                  {rank ? `Rank #${rank} · ` : ''}{profile.points_formatted} pts today
                </span>
              </div>
            </div>

            <div className="lb-modal-stats">
              <div className="lb-stat">
                <span className="lb-stat-label">Food score</span>
                <span className="lb-stat-value">{Math.round(profile.today_food_score || 0)}<span className="lb-unit">/100</span></span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-label">Water</span>
                <span className="lb-stat-value">{formatWater(profile.water.total_ml)}<span className="lb-unit"> · {profile.water.percentage}%</span></span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-label">Tasks</span>
                <span className="lb-stat-value">{profile.tasks_done}<span className="lb-unit">/{profile.tasks_total}</span></span>
              </div>
            </div>

            <div className="lb-modal-pet">
              <div className="lb-modal-dog">
                <Dog mood={profile.pet.mood} stageIndex={profile.pet.stage_index} showBowl={false} />
              </div>
              <div className="lb-modal-pet-text">
                <span className="lb-modal-section">Pet</span>
                <span className="lb-modal-pet-name">{profile.pet.name} · {profile.pet.stage}</span>
                <span className="lb-modal-sub">
                  {MOOD_LABEL[profile.pet.mood]}
                  {profile.pet.health !== null ? ` · health ${profile.pet.health}/100` : ''}
                </span>
                <span className="lb-modal-sub">Clean streak: {profile.pet.clean_streak} {profile.pet.clean_streak === 1 ? 'day' : 'days'}</span>
              </div>
            </div>

            <div className="lb-modal-block">
              <span className="lb-modal-section">Ate today ({profile.ate_today.length})</span>
              {profile.ate_today.length === 0 ? (
                <span className="lb-modal-sub">Nothing logged yet.</span>
              ) : (
                <div className="lb-modal-food">
                  {profile.ate_today.map((f, i) => (
                    <div key={i} className="lb-modal-food-row">
                      <span className={`lb-food-dot ${f.bad ? 'bad' : ''}`} />
                      <span className="lb-modal-food-name">{f.name}</span>
                      <span className="lb-modal-food-time">{f.time || ''}</span>
                      <span className="lb-modal-food-score">{Math.round(f.score)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lb-modal-block">
              <span className="lb-modal-section">Badges ({profile.badges.length} of {profile.badges_total})</span>
              {profile.badges.length === 0 ? (
                <span className="lb-modal-sub">No badges earned yet.</span>
              ) : (
                <div className="lb-modal-badges">
                  {profile.badges.map((b) => (
                    <span key={b.id} className={`lb-badge-chip tier-${b.tier}`} title={b.description}>
                      <Award size={13} /> {b.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PodiumSpot({ athlete, place, isCurrentUser, onOpen }) {
  const medal = MEDALS[place];
  return (
    <div className={`lb-podium-col lb-place-${place}`}>
      {athlete ? (
        <button type="button" className="lb-podium-person lb-clickable" onClick={() => onOpen(athlete)} title="View profile">
          <AthletePhoto
            photo={athlete.photo}
            initial={athlete.initial}
            name={athlete.name}
            size={place === 1 ? 72 : 60}
            className={`lb-ring-${medal}`}
          />
          <span className="lb-podium-name" title={athlete.name}>
            {athlete.name}
            {isCurrentUser && <span className="lb-you-tag">You</span>}
          </span>
          <span className="lb-podium-points">
            {athlete.points_formatted}
            <span className="lb-unit"> pts</span>
          </span>
        </button>
      ) : (
        <div className="lb-podium-person lb-podium-open">
          <div className="lb-open-circle" style={{ width: place === 1 ? 72 : 60, height: place === 1 ? 72 : 60 }} />
          <span className="lb-podium-name lb-muted">Open</span>
          <span className="lb-podium-points lb-muted">—</span>
        </div>
      )}
      <div className={`lb-step lb-step-${medal}`}>
        <span className="lb-step-num">{place}</span>
      </div>
    </div>
  );
}

export default function Leaderboard({ onNavigate }) {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openAthlete, setOpenAthlete] = useState(null);
  const closeProfile = useCallback(() => setOpenAthlete(null), []);

  const fetchLeaderboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const emailParam = user?.email ? `?email=${encodeURIComponent(user.email)}` : '';
      const res = await fetch(`${API}/leaderboard${emailParam}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const rankings = leaderboardData?.rankings || [];
  const currentUserStats = leaderboardData?.currentUserStats || rankings.find((r) => r.is_current_user) || null;
  const todayFormatted = leaderboardData?.today_date_formatted || 'Today';

  const isMe = (a) => Boolean(a && (a.is_current_user || (user && a.email === user.email)));

  return (
    <div className="lb-root animate-fade-in">
      <div className="lb-wrap">

        {/* Header */}
        <header className="lb-header">
          <div>
            <h2 className="lb-title">Leaderboard</h2>
            <p className="lb-subtitle">{todayFormatted}</p>
          </div>
          <button
            type="button"
            className="lb-icon-btn"
            onClick={() => fetchLeaderboard(true)}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw size={16} className={refreshing ? 'lb-spin' : ''} />
          </button>
        </header>

        {/* Your standing */}
        {user && currentUserStats && (
          <section className="lb-summary">
            <div className="lb-summary-stats">
              <div className="lb-stat">
                <span className="lb-stat-label">Your rank</span>
                <span className="lb-stat-value">#{currentUserStats.rank}</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-label">Points</span>
                <span className="lb-stat-value">{currentUserStats.points_formatted}</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-label">Food score</span>
                <span className="lb-stat-value">
                  {Math.round(currentUserStats.today_food_score || 0)}
                  <span className="lb-unit">/100</span>
                </span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-label">Water</span>
                <span className="lb-stat-value">{formatWater(currentUserStats.today_water_ml)}</span>
              </div>
            </div>
            {onNavigate && (
              <button type="button" className="lb-summary-link" onClick={() => onNavigate('/my-score')}>
                View score card <ArrowRight size={14} />
              </button>
            )}
          </section>
        )}

        {/* Podium */}
        <section className="lb-podium" aria-label="Top three">
          <PodiumSpot athlete={rankings[1]} place={2} isCurrentUser={isMe(rankings[1])} onOpen={setOpenAthlete} />
          <PodiumSpot athlete={rankings[0]} place={1} isCurrentUser={isMe(rankings[0])} onOpen={setOpenAthlete} />
          <PodiumSpot athlete={rankings[2]} place={3} isCurrentUser={isMe(rankings[2])} onOpen={setOpenAthlete} />
        </section>

        {/* Rankings table */}
        <section className="lb-table">
          <div className="lb-row lb-row-head">
            <span className="lb-c-rank">#</span>
            <span className="lb-c-athlete">Athlete</span>
            <span className="lb-c-num lb-c-food">Food</span>
            <span className="lb-c-num lb-c-water">Water</span>
            <span className="lb-c-num lb-c-points">Points</span>
          </div>

          {loading ? (
            <div className="lb-state">Loading rankings…</div>
          ) : rankings.length === 0 ? (
            <div className="lb-state">
              <p className="lb-state-title">No scores yet today</p>
              <p>Log a meal or some water to appear here.</p>
            </div>
          ) : (
            rankings.map((athlete) => {
              const me = isMe(athlete);
              const medal = MEDALS[athlete.rank];
              return (
                <div
                  key={athlete.id || athlete.email || athlete.rank}
                  className={`lb-row lb-row-click ${me ? 'lb-row-me' : ''}`}
                  role="button"
                  tabIndex={0}
                  title="View profile"
                  onClick={() => setOpenAthlete(athlete)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenAthlete(athlete); } }}
                >
                  <span className={`lb-c-rank ${medal ? `lb-rank-${medal}` : ''}`}>{athlete.rank}</span>
                  <span className="lb-c-athlete">
                    <AthletePhoto
                      photo={athlete.photo}
                      initial={athlete.initial}
                      name={athlete.name}
                      size={34}
                    />
                    <span className="lb-athlete-name">{athlete.name}</span>
                    {me && <span className="lb-you-tag">You</span>}
                  </span>
                  <span className="lb-c-num lb-c-food">{Math.round(athlete.today_food_score || 0)}</span>
                  <span className="lb-c-num lb-c-water">{formatWater(athlete.today_water_ml)}</span>
                  <span className="lb-c-num lb-c-points">{athlete.points_formatted}</span>
                </div>
              );
            })
          )}
        </section>

        <p className="lb-hint">Select a name to see what they ate today, their water and their badges.</p>

      </div>

      {openAthlete && openAthlete.id && (
        <ProfileModal athleteId={openAthlete.id} rank={openAthlete.rank} onClose={closeProfile} />
      )}
    </div>
  );
}
