import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import BentoCard from './BentoCard';
import './TodayFitnessScore.css';

const API = '/api';

export default function TodayFitnessScore({ onNavigate }) {
  const { user, openAuthModal } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const email = user?.email || '';
      const emailParam = email ? `?email=${encodeURIComponent(email)}` : '';
      const res = await fetch(`${API}/leaderboard${emailParam}`);
      if (res.ok) {
        const data = await res.json();
        const myStats = data.currentUserStats || (data.rankings && data.rankings[0]) || null;
        setStats(myStats);
      }
    } catch (err) {
      console.error('Failed to fetch today fitness score:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // If user is not logged in, prompt to log in
  if (!user && !loading) {
    return (
      <div className="fitness-score-page animate-fade-in">
        <div className="login-required-card">
          <div className="lock-icon-circle">🔒</div>
          <h2 className="login-prompt-title">Personal Fitness Score</h2>
          <p className="login-prompt-sub">
            Today's fitness score is private and only visible to you. Sign in to your account to view your daily score, track meals, and earn points!
          </p>
          <div className="login-prompt-actions">
            <button
              type="button"
              className="login-cta-btn"
              onClick={() => openAuthModal('login')}
            >
              Sign In to Your Account
            </button>
            <button
              type="button"
              className="register-cta-btn"
              onClick={() => openAuthModal('register')}
            >
              Create Free Account
            </button>
          </div>
          {onNavigate && (
            <button
              type="button"
              className="view-leaderboard-link-btn"
              onClick={() => onNavigate('/leaderboard')}
            >
              🏆 View Public Community Leaderboard instead
            </button>
          )}
        </div>
      </div>
    );
  }

  const displayName = user?.name || stats?.name || 'You';
  const photoUrl = user?.photo || stats?.photo || null;
  const initialLetter = (displayName?.charAt(0) || 'U').toUpperCase();
  const rankNumber = stats?.rank || 1;
  const pointsFormatted = stats?.points_formatted || '0';

  // Calculate composite Score Percentage
  const foodScore = stats?.today_food_score || 0;
  const foodMeals = stats?.today_food_meals || 0;
  const waterPct = Math.min(stats?.today_water_pct || 0, 100);

  let scorePercent = 0;
  if (foodMeals > 0 && waterPct > 0) {
    scorePercent = Math.round((foodScore * 0.5) + (waterPct * 0.5));
  } else if (foodMeals > 0) {
    scorePercent = Math.round(foodScore);
  } else if (waterPct > 0) {
    scorePercent = Math.round(waterPct);
  } else {
    scorePercent = 0;
  }

  return (
    <div className="fitness-score-page animate-fade-in">
      <div className="fitness-score-content-wrapper">

        {/* Top Header Row with Refresh */}
        <div className="fitness-page-header">
          <div className="fitness-header-badge">
            <span className="badge-dot"></span>
            <span>Private Daily Score</span>
          </div>
          <button
            type="button"
            className={`fitness-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchStats(true)}
            title="Refresh score"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ========================================================
            CARD: EXACT STYLING FROM USER'S REFERENCE IMAGE
            - Light blue card container
            - Avatar with bright yellow ring
            - Circular yellow rank badge at bottom right of avatar
            - User's name in bold deep blue font (#1e3a8a)
            - Blue pill button displaying points ($7,040 in ref -> pts here)
            - Score label row ("Score" on left, "80%" on right)
            - Blue progress bar
            - NO LEVEL, NO GOLD/SILVER TEXT
           ======================================================== */}
        <div className="ref-score-card">
          {/* Circular Avatar with Yellow Ring & Rank Badge */}
          <div className="ref-avatar-wrapper">
            <div className="ref-avatar-yellow-ring">
              {photoUrl && !imgError ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  onError={() => setImgError(true)}
                  className="ref-avatar-photo"
                />
              ) : (
                <div className="ref-avatar-initial">
                  {initialLetter}
                </div>
              )}
            </div>

            {/* Circular Rank Badge overlapping bottom-right of avatar */}
            <div className="ref-rank-badge">
              {rankNumber}
            </div>
          </div>

          {/* Athlete / User Name in deep navy blue */}
          <h3 className="ref-athlete-name">
            {displayName}
          </h3>

          {/* Blue Pill Button with Points */}
          <div className="ref-points-pill">
            {pointsFormatted} pts
          </div>

          {/* Score & Progress Bar */}
          <div className="ref-score-bar-section">
            <div className="ref-score-label-row">
              <span className="ref-score-title">Score</span>
              <span className="ref-score-percent">{scorePercent}%</span>
            </div>
            <div className="ref-progress-track">
              <div
                className="ref-progress-fill"
                style={{ width: `${Math.min(Math.max(scorePercent, 4), 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* ========================================================
            TODAY'S HABIT BREAKDOWN DETAILS
            Transparent breakdown of Food & Water intake
           ======================================================== */}
        {stats && (
          <div className="fitness-breakdown-container">
            <div className="breakdown-grid">
              {/* Food Tracker Box */}
              <BentoCard
                className="breakdown-box diet-box"
                enableTilt={true}
                enableStars={true}
                glowColor="16, 185, 129"
                tiltMax={6}
              >
                <div className="breakdown-head">
                  <span className="breakdown-title">Food Tracker</span>
                  <span className="breakdown-pts">+{stats.food_points} pts</span>
                </div>
                <div className="breakdown-val">
                  <span className="breakdown-num">
                    {stats.today_food_score > 0 ? Math.round(stats.today_food_score) : '0'}
                  </span>
                  <span className="breakdown-unit">/100 avg</span>
                </div>
                <p className="breakdown-desc">
                  {stats.today_food_meals > 0 ? (
                    <><strong>{stats.today_food_meals}</strong> meal{stats.today_food_meals > 1 ? 's' : ''} logged • {stats.clean_meals_count} clean</>
                  ) : (
                    <span className="empty-hint">No meals logged today</span>
                  )}
                </p>
              </BentoCard>

              {/* Water Reminder Box */}
              <BentoCard
                className="breakdown-box water-box"
                enableTilt={true}
                enableStars={true}
                glowColor="56, 189, 248"
                tiltMax={6}
              >
                <div className="breakdown-head">
                  <span className="breakdown-title">Water Tracker</span>
                  <span className="breakdown-pts">+{stats.water_points} pts</span>
                </div>
                <div className="breakdown-val">
                  <span className="breakdown-num">{stats.today_water_ml}</span>
                  <span className="breakdown-unit">/ {stats.today_water_target} ml</span>
                </div>
                <p className="breakdown-desc">
                  <strong>{stats.glass_count}</strong> glasses ({stats.today_water_pct}%) drank
                </p>
              </BentoCard>
            </div>

            {/* Synergy Bonus Banner */}
            <BentoCard
              className={`fitness-synergy-banner ${stats.synergy_bonus > 0 ? 'achieved' : 'pending'}`}
              enableTilt={false}
              enableStars={true}
              glowColor="56, 189, 248"
            >
              <span className="synergy-desc">
                {stats.synergy_bonus > 0 ? (
                  <><strong>Synergy Bonus Unlocked (+500 pts)!</strong> Wholesome diet & 100% hydration achieved today!</>
                ) : (
                  <><strong>Synergy Bonus (+500 pts):</strong> Eat healthy (score ≥ 70) and reach 100% hydration ({stats.today_water_target} ml) to unlock!</>
                )}
              </span>
            </BentoCard>

            {/* Quick Action Navigation */}
            {onNavigate && (
              <div className="fitness-actions-row">
                <button
                  type="button"
                  className="fitness-act-btn food-btn"
                  onClick={() => onNavigate('/tracker')}
                >
                  Log Food
                </button>
                <button
                  type="button"
                  className="fitness-act-btn water-btn"
                  onClick={() => onNavigate('/water')}
                >
                  Log Water
                </button>
                <button
                  type="button"
                  className="fitness-act-btn leaderboard-btn"
                  onClick={() => onNavigate('/leaderboard')}
                >
                  View Leaderboard
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
