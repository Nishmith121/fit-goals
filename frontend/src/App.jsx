import React, { useState, useEffect } from 'react';
import PillNav from './components/PillNav';
import SplashCursor from './components/SplashCursor';
import DottedSurface from './components/DottedSurface';
import VaporText from './components/VaporText';
import FoodTracker from './components/FoodTracker';
import WaterReminder from './components/WaterReminder';
import PlanPage from './components/DayPlan';
import PetPage from './components/PetPage';
import Leaderboard from './components/Leaderboard';
import TodayFitnessScore from './components/TodayFitnessScore';
import AuthModal from './components/AuthModal';
import MagicBento, { GlobalSpotlight } from './components/MagicBento';
import { useAuth } from './context/AuthContext';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { playWaterDropSound } from './utils/sound';
import { apiFetch } from './services/api';
import { Activity, Trophy, LogOut, Lock } from 'lucide-react';
import logo from './assets/logo.svg';

export default function App() {
  const { user, openAuthModal, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getInitialRoute = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (
        path === '/tracker' ||
        path === '/dataset' ||
        path === '/water' ||
        path === '/plan' ||
        path === '/pet' ||
        path === '/leaderboard' ||
        path === '/my-score'
      ) {
        return path;
      }
    }
    return '/';
  };

  const [activeHref, setActiveHref] = useState(getInitialRoute);
  const [globalAlert, setGlobalAlert] = useState(false);

  const handleNavChange = (href) => {
    setActiveHref(href);
    if (typeof window !== 'undefined' && window.location.pathname !== href) {
      window.history.pushState({}, '', href);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setActiveHref(
        path === '/tracker' ||
        path === '/dataset' ||
        path === '/water' ||
        path === '/plan' ||
        path === '/pet' ||
        path === '/leaderboard' ||
        path === '/my-score'
          ? path
          : '/'
      );
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Food Tracker, Water Reminder and Report need a signed-in user
  const PROTECTED_ROUTES = ['/tracker', '/water', '/dataset', '/plan', '/pet'];
  const needsLogin = !user && PROTECTED_ROUTES.includes(activeHref);
  const gatedPageName =
    activeHref === '/water' ? 'Water Reminder' : activeHref === '/dataset' ? 'Report' : activeHref === '/plan' ? 'Plan' : activeHref === '/pet' ? 'Pet' : 'Food Tracker';

  useEffect(() => {
    if (needsLogin) openAuthModal('login');
  }, [needsLogin, activeHref]);

  // Close the profile menu when clicking anywhere outside it, or pressing Escape
  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e) => {
      if (!e.target.closest('.user-profile-badge')) setShowUserMenu(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showUserMenu]);

  const handleQuickDrankFromAlert = async () => {
    try {
      playWaterDropSound();
      await apiFetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: 250, type: 'Glass of water' })
      });
    } catch (e) {
      console.error(e);
    }
    setGlobalAlert(false);
  };

  const introTexts = [
    'Hi There !',
    'i am ZOOF ',
    'ur food tracker '
  ];

  // 1. Primary Navigation Bar (Seen by all visitors)
  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Food Tracker', href: '/tracker' },
    { label: 'Water Reminder', href: '/water' },
    { label: 'Plan', href: '/plan' },
    { label: 'Pet', href: '/pet' },
    { label: 'Report', href: '/dataset' }
  ];

  return (
    <>
      {/* 3D Dotted Surface & Fluid Splash Cursor rendered ONLY on the home page */}
      {activeHref === '/' && <DottedSurface className="is-fixed" />}
      {activeHref === '/' && <SplashCursor />}

      {/* Magic Bento Spotlight & Reactive Border Glow rendered on ALL OTHER pages */}
      {activeHref !== '/' && (
        <GlobalSpotlight
          enabled={true}
          spotlightRadius={360}
          glowColor="56, 189, 248"
          targetSelector=".bento-card, .water-hero-card, .water-control-card, .reminder-card, .glasses-grid-card, .water-timeline-card, .day-score-banner, .eaten-list-card, .food-input-card, .ref-score-card, .leaderboard-card, .leaderboard-podium, .leaderboard-table-card, .food-item-row, .timeline-entry-row"
        />
      )}

      {/* Top Fixed Header with Centered Navigation Bars */}
      <header className="pill-nav-header-wrapper">
        <div className="header-nav-container">
          {/* BAR 1: Feature Navigation Bar */}
          <PillNav
            logo={logo}
            logoAlt="FitGoals ZOOF"
            items={navItems}
            activeHref={activeHref}
            onItemClick={(item) => handleNavChange(item.href)}
            className="custom-nav"
            ease="power2.easeOut"
            baseColor="#000000"
            pillColor="#ffffff"
            hoveredPillTextColor="#000000"
            pillTextColor="#000000"
          />

          {/* Athlete Profile / Auth Trigger Chip (Contains Today's Score & Leaderboard when logged in) */}
          <div className="user-nav-chip-wrapper">
            {user ? (
              <div
                className="user-profile-badge"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Your Profile"
              >
                <div className="user-nav-avatar-circle">
                  {user.photo ? (
                    <img src={user.photo} alt={user.name} className="user-nav-photo-img" />
                  ) : (
                    <span className="user-nav-avatar-initial">
                      {(user.name ? user.name.charAt(0) : 'Y').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="user-nav-text-col">
                  <span className="user-nav-name">{user.name.split(' ')[0]}</span>
                  <span className="user-nav-points">{user.points_display || '0'} pts</span>
                </div>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="user-dropdown-menu animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-user-header">
                      <div className="dropdown-avatar">
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} />
                        ) : (
                          <span>{(user.name ? user.name.charAt(0) : 'Y').toUpperCase()}</span>
                        )}
                      </div>
                      <div className="dropdown-identity">
                        <strong className="dropdown-user-fullname">{user.name}</strong>
                        <span className="dropdown-email" title={user.email}>{user.email}</span>
                      </div>
                    </div>

                    <div className="dropdown-stats">
                      <div className="dropdown-stat">
                        <span className="dropdown-stat-label">Points today</span>
                        <span className="dropdown-stat-value">{user.points_display || '0'}</span>
                      </div>
                      <div className="dropdown-stat">
                        <span className="dropdown-stat-label">BMI</span>
                        <span className="dropdown-stat-value">
                          {user.bmi}
                          {user.bmi_category && <span className="dropdown-stat-note">{user.bmi_category}</span>}
                        </span>
                      </div>
                      <div className="dropdown-stat">
                        <span className="dropdown-stat-label">Height</span>
                        <span className="dropdown-stat-value">{user.height}<span className="dropdown-stat-unit"> cm</span></span>
                      </div>
                      <div className="dropdown-stat">
                        <span className="dropdown-stat-label">Weight</span>
                        <span className="dropdown-stat-value">{user.weight}<span className="dropdown-stat-unit"> kg</span></span>
                      </div>
                    </div>

                    <div className="dropdown-menu-list">
                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={() => {
                          setShowUserMenu(false);
                          handleNavChange('/my-score');
                        }}
                      >
                        <Activity size={16} /> Today's score
                      </button>

                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={() => {
                          setShowUserMenu(false);
                          handleNavChange('/leaderboard');
                        }}
                      >
                        <Trophy size={16} /> Leaderboard
                      </button>

                      <button
                        type="button"
                        className="dropdown-menu-item logout"
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                      >
                        <LogOut size={16} /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="sign-in-nav-btn"
                onClick={() => openAuthModal('register')}
                title="Create Athlete Account or Sign In"
              >
                <span className="sign-in-icon">⚡</span>
                <span className="sign-in-text">Sign In / Join</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Persistent Global Water Alert Toast Banner */}
      {globalAlert && (
        <div className="water-global-alert-toast animate-slide-down">
          <div className="toast-content-box">
            <span className="toast-icon">💧</span>
            <div className="toast-text-col">
              <strong>Time to Hydrate!</strong>
              <span>An hour has passed since your last drink. Stay refreshed!</span>
            </div>
            <button
              type="button"
              className="toast-drink-btn"
              onClick={handleQuickDrankFromAlert}
            >
              + Drank 1 Glass (250 ml)
            </button>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setGlobalAlert(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="app-viewport-wrapper">
        {needsLogin ? (
          /* Sign-in gate for protected pages */
          <div className="page-content-wrapper animate-fade-in">
            <div className="login-gate-card">
              <div className="login-gate-icon"><Lock size={20} /></div>
              <h2 className="login-gate-title">Sign in to use the {gatedPageName}</h2>
              <p className="login-gate-text">
                Your meals, water and scores are saved to your account, so you need to sign in first.
              </p>
              <div className="login-gate-actions">
                <button type="button" className="login-gate-btn primary" onClick={() => openAuthModal('login')}>
                  Sign in
                </button>
                <button type="button" className="login-gate-btn" onClick={() => openAuthModal('register')}>
                  Create account
                </button>
              </div>
            </div>
          </div>
        ) : activeHref === '/' ? (
          /* PAGE 1: Home Landing Page */
          <div className="hero-full-center animate-fade-in">
            <div className="vapor-banner-section">
              <VaporText
                texts={introTexts}
                vaporizeTime={2}
                fadeInTime={1}
                waitTime={1.3}
              />
            </div>

            {/* Call-to-Action Liquid Metal Buttons */}
            <div className="hero-cta-buttons animate-fade-in">
              <LiquidMetalButton
                label="🥗 Track Today's Food"
                width={200}
                onClick={() => handleNavChange('/tracker')}
              />

              <LiquidMetalButton
                label="💧 Drink Water Tracker"
                width={195}
                onClick={() => handleNavChange('/water')}
              />
            </div>
          </div>
        ) : activeHref === '/water' ? (
          /* PAGE 2: Water Reminder & Hourly Hydration Tracker */
          <div className="page-content-wrapper animate-fade-in">
            <WaterReminder
              onReminderTrigger={() => setGlobalAlert(true)}
              onDrankWater={() => setGlobalAlert(false)}
            />
          </div>
        ) : activeHref === '/plan' ? (
          /* Day plan: free-text notes for today and tomorrow */
          <div className="page-content-wrapper animate-fade-in">
            <PlanPage />
          </div>
        ) : activeHref === '/pet' ? (
          /* Pet, daily tasks and badges */
          <div className="page-content-wrapper animate-fade-in">
            <PetPage onNavigate={handleNavChange} />
          </div>
        ) : activeHref === '/leaderboard' ? (
          /* PAGE 3: Community Leaderboard (Public - Seen by everyone) */
          <div className="page-content-wrapper animate-fade-in">
            <Leaderboard onNavigate={setActiveHref} />
          </div>
        ) : activeHref === '/my-score' ? (
          /* PAGE 4: Today's Fitness Score (Private - Seen by user) */
          <div className="page-content-wrapper animate-fade-in">
            <TodayFitnessScore onNavigate={setActiveHref} />
          </div>
        ) : (
          /* PAGE 6: Food Tracker & Daily Dataset */
          <div className="page-content-wrapper animate-fade-in">
            <FoodTracker
              initialDate={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
              defaultView={activeHref === '/dataset' ? 'history' : 'tracker'}
            />
          </div>
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal />
    </>
  );
}
