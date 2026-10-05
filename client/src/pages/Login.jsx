import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  // Mode: 'login' | 'register'
  const [mode, setMode] = useState('login');

  // Sign In fields
  const [username, setUsername] = useState('admin@luminavfilms.com');
  const [passcode, setPasscode] = useState('luminav2026');

  // Register fields
  const [regStudioName, setRegStudioName] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [btnText, setBtnText] = useState('ENTER STUDIO PORTAL');

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Ambient Dust Particles Canvas (Exact implementation from index.html)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let animId;
    let particles = [];
    const PARTICLE_COUNT = 55;

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    class DustParticle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.8 + 0.6;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.3 - 0.15;
        this.alpha = Math.random() * 0.5 + 0.15;
        this.alphaDelta = (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1);
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha += this.alphaDelta;
        if (this.alpha <= 0.08 || this.alpha >= 0.7) {
          this.alphaDelta *= -1;
        }
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
          this.reset();
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 164, 99, ${this.alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(217, 164, 99, 0.45)';
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new DustParticle());
    }

    const loop = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Run Cinematic 6-Stage Shutter Sequence
  const triggerShutterSequence = () => {
    const loginBtn = document.getElementById('loginBtn');
    const loginCard = document.getElementById('loginCard');
    const shutterStage = document.getElementById('shutterStage');
    const shutterTop = document.getElementById('shutterTop');
    const shutterBottom = document.getElementById('shutterBottom');
    const horizonLaser = document.getElementById('horizonLaser');
    const hudOverlay = document.getElementById('hudOverlay');
    const apertureReticle = document.getElementById('apertureReticle');
    const bloomFlash = document.getElementById('bloomFlash');
    const loginBtnArrow = document.getElementById('loginBtnArrow');

    // Phase 1 (0ms): Button turns green & glows
    if (loginBtn) loginBtn.classList.add('authenticating');
    setBtnText('ACCESS GRANTED ✓');
    if (loginBtnArrow) loginBtnArrow.style.display = 'none';

    // Phase 2 (140ms): Card scales down and blurs away
    setTimeout(() => {
      if (loginCard) {
        loginCard.style.transform = 'scale(0.92) translateY(16px)';
        loginCard.style.filter = 'blur(14px)';
        loginCard.style.opacity = '0';
      }
    }, 140);

    // Phase 3 (220ms): Activate shutter stage + HUD overlay + Aperture
    setTimeout(() => {
      if (shutterStage) shutterStage.classList.add('active');
      if (hudOverlay) hudOverlay.style.opacity = '1';
      if (apertureReticle) apertureReticle.classList.add('visible');
    }, 220);

    // Phase 4 (380ms): Precision Shutter Panels snap shut to horizon line
    setTimeout(() => {
      if (shutterTop) shutterTop.classList.add('snap-shut');
      if (shutterBottom) shutterBottom.classList.add('snap-shut');
    }, 380);

    // Phase 5 (780ms): Golden Horizon Laser beam flares across the gap
    setTimeout(() => {
      if (horizonLaser) horizonLaser.classList.add('flare');
    }, 780);

    // Phase 6 (920ms): Anamorphic bloom flash + Shutter snaps wide open
    setTimeout(() => {
      if (bloomFlash) bloomFlash.style.opacity = '0.9';
      if (shutterTop) {
        shutterTop.classList.remove('snap-shut');
        shutterTop.classList.add('snap-open');
      }
      if (shutterBottom) {
        shutterBottom.classList.remove('snap-shut');
        shutterBottom.classList.add('snap-open');
      }
      if (hudOverlay) hudOverlay.style.opacity = '0';
      if (apertureReticle) apertureReticle.classList.remove('visible');
    }, 920);

    // Phase 7 (1280ms): Seamless Navigation to Tracker
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 1280);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (isAuthenticating) return;

    setErrorMsg('');
    setIsAuthenticating(true);

    try {
      if (mode === 'login') {
        if (!username.trim() || !passcode) {
          throw new Error('Please enter both your studio username/email and passcode.');
        }
        await login(username.trim(), passcode);
      } else {
        if (!regStudioName.trim() || !regAdminName.trim() || !regEmail.trim() || !regPassword) {
          throw new Error('Please complete all studio registration fields.');
        }
        await register({
          email: regEmail.trim(),
          password: regPassword,
          name: regAdminName.trim(),
          studioName: regStudioName.trim()
        });
      }

      // Success -> trigger the cinematic transition
      triggerShutterSequence();
    } catch (err) {
      setIsAuthenticating(false);
      setErrorMsg(err.message || 'Access Denied: Authentication Failed');
    }
  };

  return (
    <div className="login-page-root">
      {/* Ambient Glowing Backdrops */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>
      <canvas id="bgCanvas" ref={canvasRef}></canvas>

      {/* Main Login Card Interface */}
      <main className="portal-wrapper">
        <div className="login-card" id="loginCard" style={{ maxWidth: '440px' }}>
          {/* Brand Aperture Badge */}
          <div className="brand-aperture-wrap">
            <div className="aperture-ring-outer"></div>
            <div className="aperture-ring"></div>
            <div className="brand-badge">
              <img src="/assets/images/logo-dark.png" alt="Luminosity Logo" className="brand-logo-img" />
            </div>
          </div>

          <h1 className="portal-title">LUMINOSITY</h1>
          <div className="portal-subtitle">Studio &amp; Financial Suite</div>

          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '3px',
              marginBottom: '20px',
              gap: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setBtnText('ENTER STUDIO PORTAL');
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '7px',
                border: 'none',
                background: mode === 'login' ? 'var(--accent)' : 'transparent',
                color: mode === 'login' ? '#12100e' : 'var(--text-secondary)',
                fontWeight: mode === 'login' ? '700' : '500',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              STUDIO SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setBtnText('CREATE STUDIO PORTAL');
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '7px',
                border: 'none',
                background: mode === 'register' ? 'var(--accent)' : 'transparent',
                color: mode === 'register' ? '#12100e' : 'var(--text-secondary)',
                fontWeight: mode === 'register' ? '700' : '500',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              REGISTER NEW STUDIO
            </button>
          </div>

          <div className="status-pill" style={{ marginBottom: '18px' }}>
            <span className="status-dot"></span>
            <span>
              {mode === 'login' ? 'Multi-Studio Portal • Encrypted' : 'New Studio Space • Dedicated Database'}
            </span>
          </div>

          {errorMsg && (
            <div
              style={{
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                marginBottom: '14px',
                textAlign: 'left'
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}

          <form className="login-form" id="loginForm" onSubmit={handleAuthSubmit}>
            {mode === 'login' ? (
              <>
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="studioUser">
                    Studio Username or Email
                  </label>
                  <input
                    type="text"
                    id="studioUser"
                    className="portal-input"
                    placeholder="admin@luminavfilms.com or username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="input-wrapper">
                  <label className="input-label" htmlFor="passKey">
                    Access Passcode / Key
                  </label>
                  <input
                    type="password"
                    id="passKey"
                    className="portal-input"
                    placeholder="••••••••••••"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="regStudio">
                    Production Studio / Company Name
                  </label>
                  <input
                    type="text"
                    id="regStudio"
                    className="portal-input"
                    placeholder="e.g. Apex Cinema Labs"
                    value={regStudioName}
                    onChange={(e) => setRegStudioName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-wrapper">
                  <label className="input-label" htmlFor="regName">
                    Studio Admin / Director Name
                  </label>
                  <input
                    type="text"
                    id="regName"
                    className="portal-input"
                    placeholder="e.g. John Doe"
                    value={regAdminName}
                    onChange={(e) => setRegAdminName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-wrapper">
                  <label className="input-label" htmlFor="regEmail">
                    Studio Email Address
                  </label>
                  <input
                    type="email"
                    id="regEmail"
                    className="portal-input"
                    placeholder="e.g. studio@apexcinema.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="input-wrapper">
                  <label className="input-label" htmlFor="regPass">
                    Set Studio Passcode / Password
                  </label>
                  <input
                    type="password"
                    id="regPass"
                    className="portal-input"
                    placeholder="Minimum 6 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="portal-btn"
              id="loginBtn"
              title="Launch Luminosity Studio"
              disabled={isAuthenticating}
            >
              <span id="loginBtnText">{btnText}</span>
              <svg
                id="loginBtnArrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </form>

          <div className="portal-copyright" style={{ marginTop: '22px' }}>
            &copy; 2026 Luminav Films. All rights reserved.
          </div>
        </div>
      </main>

      {/* =========================================================================
           PRECISION FILM SHUTTER & ANAMORPHIC HORIZON REVEAL SYSTEM
           ========================================================================= */}
      <div id="shutterStage">
        {/* Viewfinder Focus HUD */}
        <div className="viewfinder-hud" id="hudOverlay">
          <div className="hud-bracket b-tl"></div>
          <div className="hud-bracket b-tr"></div>
          <div className="hud-bracket b-bl"></div>
          <div className="hud-bracket b-br"></div>
          <div className="hud-rec-tag">
            <div className="hud-rec-dot"></div>
            <span>LUMINOSITY &bull; 4K PRO</span>
          </div>
        </div>

        {/* Center Aperture Reticle */}
        <div className="aperture-core" id="apertureReticle">
          <div className="aperture-inner-cross"></div>
        </div>

        {/* Dual Shutter Blades */}
        <div className="shutter-panel shutter-top" id="shutterTop"></div>
        <div className="shutter-panel shutter-bottom" id="shutterBottom"></div>

        {/* Anamorphic Laser Horizon Beam */}
        <div className="horizon-laser" id="horizonLaser"></div>

        {/* Radiant Bloom Flash */}
        <div className="radiant-bloom-flash" id="bloomFlash"></div>
      </div>
    </div>
  );
}
