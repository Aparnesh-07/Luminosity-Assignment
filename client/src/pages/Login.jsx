import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('admin@luminavfilms.com');
  const [password, setPassword] = useState('luminav2026');
  const [name, setName] = useState('');
  const [studioName, setStudioName] = useState('Luminav Films');
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [statusText, setStatusText] = useState('SIGN IN TO STUDIO →');

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Ambient Dust Particle Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let animationId;
    let particleMultiplier = 1;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    class DustParticle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 0.5;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.6 + 0.2;
        this.alphaChange = (Math.random() * 0.01 + 0.005) * (Math.random() > 0.5 ? 1 : -1);
      }
      update() {
        this.x += this.vx * particleMultiplier;
        this.y += this.vy * particleMultiplier;
        this.alpha += this.alphaChange;
        if (this.alpha <= 0.1 || this.alpha >= 0.8) this.alphaChange *= -1;
        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 164, 99, ${this.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(217, 164, 99, 0.4)';
        ctx.fill();
      }
    }

    const particles = Array.from({ length: 60 }, () => new DustParticle());

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const triggerCinematicTransition = () => {
    setIsNavigating(true);
    setStatusText('ACCESS GRANTED ✓');

    const shutterTop = document.getElementById('shutterTop');
    const shutterBottom = document.getElementById('shutterBottom');
    const horizonLaser = document.getElementById('horizonLaser');
    const bloomFlash = document.getElementById('bloomFlash');
    const shutterStage = document.getElementById('shutterStage');

    if (shutterStage) shutterStage.classList.add('active');

    // 1. Shutter snap shut (300ms)
    setTimeout(() => {
      if (shutterTop) shutterTop.classList.add('snap-shut');
      if (shutterBottom) shutterBottom.classList.add('snap-shut');
    }, 300);

    // 2. Anamorphic laser flare (700ms)
    setTimeout(() => {
      if (horizonLaser) horizonLaser.classList.add('flare');
      if (bloomFlash) bloomFlash.style.opacity = '0.35';
    }, 700);

    // 3. Shutter snaps wide open revealing portal (900ms)
    setTimeout(() => {
      if (horizonLaser) horizonLaser.classList.remove('flare');
      if (shutterTop) {
        shutterTop.classList.remove('snap-shut');
        shutterTop.classList.add('snap-open');
      }
      if (shutterBottom) {
        shutterBottom.classList.remove('snap-shut');
        shutterBottom.classList.add('snap-open');
      }
      if (bloomFlash) bloomFlash.style.opacity = '1';
    }, 900);

    // 4. Navigate into App (1200ms)
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 1200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNavigating) return;

    setErrorMsg('');
    try {
      if (isRegistering) {
        if (!name.trim()) throw new Error('Please enter your name');
        await register({ email, password, name, studioName });
      } else {
        await login(email, password);
      }
      triggerCinematicTransition();
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0908', overflow: 'hidden' }}>
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      {/* Cinematic Shutter Stage */}
      <div id="shutterStage" className="shutter-stage">
        <div id="shutterTop" className="shutter-blade-top"></div>
        <div id="shutterBottom" className="shutter-blade-bottom"></div>
        <div id="horizonLaser" className="horizon-laser"></div>
        <div id="bloomFlash" className="bloom-flash"></div>
      </div>

      {/* Login Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '430px',
          background: 'rgba(28, 26, 23, 0.88)',
          border: '1px solid rgba(221, 215, 201, 0.14)',
          borderRadius: '20px',
          padding: '40px 36px',
          backdropFilter: 'blur(30px)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(217, 164, 99, 0.08)',
          textAlign: 'center',
          transition: 'all 0.4s var(--ease-out)'
        }}
      >
        {/* Brand Aperture Rings */}
        <div style={{ position: 'relative', width: '88px', height: '88px', margin: '0 auto 20px' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              border: '1px dashed rgba(217, 164, 99, 0.3)',
              animation: 'rotateApertureSlow 28s linear infinite'
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '50%',
              border: '1px dashed rgba(217, 164, 99, 0.45)',
              animation: 'rotateApertureReverse 18s linear infinite'
            }}
          />
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#181614',
              border: '2px solid var(--accent)',
              boxShadow: '0 0 20px var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img
              src="/assets/images/logo-dark.png"
              alt="Logo"
              style={{ width: '60px', height: '60px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '28px',
            fontWeight: '800',
            letterSpacing: '0.14em',
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}
        >
          LUMINOSITY
        </h1>

        <div style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: '14px' }}>
          STUDIO &amp; FINANCIAL SUITE
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            background: 'rgba(104, 187, 118, 0.1)',
            border: '1px solid rgba(104, 187, 118, 0.3)',
            borderRadius: '20px',
            fontSize: '11px',
            color: 'var(--status-completed)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '26px'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-completed)', boxShadow: '0 0 6px var(--status-completed)' }}></span>
          <span>Executive Portal &bull; Encrypted</span>
        </div>

        {errorMsg && (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', marginBottom: '16px', fontSize: '12.5px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Director / Producer Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Studio Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Luminav Films"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Studio Email / Key</label>
            <input
              type="email"
              className="form-control"
              placeholder="admin@luminavfilms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Passcode</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={isNavigating}
          >
            {statusText}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg('');
            }}
          >
            {isRegistering ? '← Back to Login' : '+ Create New Studio Account'}
          </button>

          <span>© 2026 Luminav Films</span>
        </div>
      </div>
    </div>
  );
}
