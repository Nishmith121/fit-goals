import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    login,
    register
  } = useAuth();

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');
  const [photo, setPhoto] = useState(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef(null);

  // Live BMI calculation
  const bmiInfo = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const val = (w / ((h / 100) * (h / 100))).toFixed(1);
    let label = 'Normal';
    let color = '#10b981';
    if (val < 18.5) {
      label = 'Lean';
      color = '#38bdf8';
    } else if (val < 25.0) {
      label = 'Athletic';
      color = '#10b981';
    } else if (val < 30.0) {
      label = 'Bulking';
      color = '#f59e0b';
    } else {
      label = 'High BMI';
      color = '#ef4444';
    }
    return { val, label, color };
  }, [height, weight]);

  if (!isAuthModalOpen) return null;

  // Handle Photo File Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhoto(event.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) return setError('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid email address.');
    if (!password || password.length < 3) return setError('Password must be at least 3 characters.');
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || h < 50 || h > 260) return setError('Height must be between 50 cm and 260 cm.');
    if (!w || w < 20 || w > 350) return setError('Weight must be between 20 kg and 350 kg.');

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        height: h,
        weight: w,
        photo
      });
      setSuccessMsg('Account created successfully!');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!loginEmail.trim()) return setError('Please enter your email.');
    if (!loginPassword) return setError('Please enter your password.');

    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      setSuccessMsg('Logged in successfully!');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleFillDemo = (demoEmail) => {
    setLoginEmail(demoEmail);
    setLoginPassword('password123');
  };

  const initialLetter = (name.trim() ? name.trim().charAt(0) : 'Y').toUpperCase();

  return (
    <div className="auth-modal-overlay" onClick={() => setIsAuthModalOpen(false)}>
      <div className="auth-modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="auth-close-btn"
          onClick={() => setIsAuthModalOpen(false)}
          title="Close"
        >
          ×
        </button>

        {/* Header Tabs */}
        <div className="auth-header">
          <div className="auth-brand-pill">FITGOALS PROFILE</div>
          <h2 className="auth-modal-title">
            {authModalTab === 'register' ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="auth-modal-subtitle">
            {authModalTab === 'register'
              ? 'Upload your photo, set your fitness profile, and compete on the leaderboard.'
              : 'Sign in to sync your score and climb the leaderboard rankings.'}
          </p>

          <div className="auth-tabs-bar">
            <button
              type="button"
              className={`auth-tab-btn ${authModalTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthModalTab('register');
                setError('');
              }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${authModalTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthModalTab('login');
                setError('');
              }}
            >
              Sign In
            </button>
          </div>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}
        {successMsg && <div className="auth-alert-success">{successMsg}</div>}

        {authModalTab === 'register' ? (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            {/* Photo Upload Section */}
            <div className="photo-upload-container">
              <div
                className="photo-preview-circle"
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload profile photo"
              >
                {photo ? (
                  <img src={photo} alt="Profile Preview" className="uploaded-photo-img" />
                ) : (
                  <div className="empty-photo-placeholder">
                    <span className="placeholder-letter">{initialLetter}</span>
                    <span className="camera-badge-icon">📷</span>
                  </div>
                )}
              </div>

              <div className="photo-upload-info">
                <span className="photo-upload-title">Profile Photo</span>
                <span className="photo-upload-hint">Upload your photo to appear on the leaderboard</span>
                <div className="photo-actions-row">
                  <button
                    type="button"
                    className="choose-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photo ? 'Change Photo' : 'Upload Image'}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() => setPhoto(null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Basic Info Fields */}
            <div className="auth-fields-row">
              <div className="auth-field-group">
                <label className="auth-field-label">Full Name</label>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="e.g. Leo Harrison"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Email Address</label>
                <input
                  type="email"
                  className="auth-input-field"
                  placeholder="e.g. leo@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label">Password</label>
              <input
                type="password"
                className="auth-input-field"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Height & Weight Inputs with BMI */}
            <div className="auth-fields-row">
              <div className="auth-field-group">
                <label className="auth-field-label">Height (cm)</label>
                <input
                  type="number"
                  min="50"
                  max="250"
                  step="1"
                  className="auth-input-field"
                  placeholder="175"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Weight (kg)</label>
                <input
                  type="number"
                  min="20"
                  max="300"
                  step="0.5"
                  className="auth-input-field"
                  placeholder="70"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Live BMI Preview Card */}
            {bmiInfo && (
              <div className="bmi-preview-card">
                <div className="bmi-badge-pill" style={{ color: bmiInfo.color }}>
                  BMI: <strong>{bmiInfo.val}</strong>
                </div>
                <span className="bmi-label-text" style={{ color: bmiInfo.color }}>
                  {bmiInfo.label}
                </span>
                <span className="bmi-subtext">
                  Calculated from {height} cm & {weight} kg
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Join Leaderboard'}
            </button>
          </form>
        ) : (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="auth-field-group">
              <label className="auth-field-label">Email Address</label>
              <input
                type="email"
                className="auth-input-field"
                placeholder="Enter your email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label">Password</label>
              <input
                type="password"
                className="auth-input-field"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            {/* Demo Logins */}
            <div className="demo-accounts-strip">
              <span className="demo-strip-label">Or test with leaderboard athletes:</span>
              <div className="demo-buttons-row">
                <button
                  type="button"
                  className="demo-athlete-chip"
                  onClick={() => handleFillDemo('ava@fitgoals.io')}
                >
                  Ava Elizabeth
                </button>
                <button
                  type="button"
                  className="demo-athlete-chip"
                  onClick={() => handleFillDemo('leo@fitgoals.io')}
                >
                  Leo Harrison
                </button>
                <button
                  type="button"
                  className="demo-athlete-chip"
                  onClick={() => handleFillDemo('rowan@fitgoals.io')}
                >
                  Rowan Elijah
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
