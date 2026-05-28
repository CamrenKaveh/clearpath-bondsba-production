import { useEffect, useRef, useState } from 'react';

export default function LandingChooser({ onChoose }) {
  const canvasRef = useRef(null);
  const [hovering, setHovering] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => { setTimeout(() => setEntered(true), 80); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 110 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.2,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.45 + 0.08,
      hue: Math.random() > 0.5 ? '100,150,255' : '255,185,70',
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const handleChoose = (side) => {
    setChosen(side);
    setTimeout(() => onChoose(side), 520);
  };

  const SBAIcon = () => (
    <svg width='28' height='28' viewBox='0 0 28 28' fill='none'>
      <rect x='2' y='6' width='24' height='18' rx='2' stroke='#93c5fd' strokeWidth='1.5'/>
      <path d='M2 11h24' stroke='#93c5fd' strokeWidth='1.5'/>
      <rect x='6' y='15' width='4' height='6' rx='0.5' fill='#93c5fd' opacity='0.6'/>
      <rect x='12' y='13' width='4' height='8' rx='0.5' fill='#93c5fd' opacity='0.8'/>
      <rect x='18' y='16' width='4' height='5' rx='0.5' fill='#93c5fd' opacity='0.6'/>
      <path d='M7 4h14' stroke='#93c5fd' strokeWidth='1.5' strokeLinecap='round'/>
    </svg>
  );

  const BondIcon = () => (
    <svg width='28' height='28' viewBox='0 0 28 28' fill='none'>
      <path d='M14 2L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2z' stroke='#fcd34d' strokeWidth='1.5' fill='none'/>
      <path d='M9 14l3.5 3.5L19 11' stroke='#fcd34d' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'/>
    </svg>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 30% 40%, #0a1628 0%, #050d1a 60%, #020810 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      overflow: 'hidden',
      opacity: chosen ? 0 : 1,
      transition: 'opacity 0.5s ease',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '20%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Title */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        marginBottom: 52,
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ perspective: '900px', display: 'inline-block' }}>
          <h1 style={{
            fontSize: 'clamp(56px, 11vw, 128px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            margin: 0,
            animation: 'float3d 5s ease-in-out infinite',
            background: 'linear-gradient(135deg, #e8f0ff 0%, #a5c0ff 35%, #ffd47a 65%, #ffe8b5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 50px rgba(100,150,255,0.35))',
          }}>
            BOND<span style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>á</span>SBA
          </h1>
        </div>
        <p style={{ color: 'rgba(160,185,240,0.55)', fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', marginTop: 16, fontWeight: 600 }}>
          Select your workflow
        </p>
      </div>

      {/* Cards */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14,
        width: '100%', maxWidth: 740, padding: '0 18px',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(32px)',
        transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s',
      }}>

        {/* SBA Card */}
        <button
          onClick={() => handleChoose('sba')}
          onMouseEnter={() => setHovering('sba')}
          onMouseLeave={() => setHovering(null)}
          style={{
            border: `1px solid ${hovering === 'sba' ? 'rgba(96,165,250,0.6)' : 'rgba(96,165,250,0.15)'}`,
            borderRadius: 14,
            background: hovering === 'sba' ? 'linear-gradient(145deg,rgba(29,58,120,0.88),rgba(15,35,85,0.92))' : 'rgba(12,25,60,0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            padding: '32px 26px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
            transform: hovering === 'sba' ? 'translateY(-5px) scale(1.015)' : 'scale(1)',
            boxShadow: hovering === 'sba' ? '0 28px 70px rgba(37,99,235,0.22), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 4px 24px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 11,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(29,78,216,0.3))',
            border: '1px solid rgba(96,165,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
          }}>
            <SBAIcon />
          </div>
          <h2 style={{ color: '#f0f5ff', fontSize: 21, fontWeight: 800, margin: '0 0 9px', letterSpacing: '-0.025em' }}>SBA Loans</h2>
          <p style={{ color: 'rgba(170,195,255,0.7)', fontSize: 13, lineHeight: 1.65, margin: '0 0 20px', fontWeight: 400 }}>
            7(a) guaranty calculator, 504 capital stacks, guarantee fee analysis, program comparison, and term-sheet workflow.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['7(a) Fee', '504 Stack', 'Guarantee', 'Term Sheet'].map(tag => (
              <span key={tag} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.18)', letterSpacing: '0.01em' }}>{tag}</span>
            ))}
          </div>
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 5, color: '#60a5fa', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em' }}>
            ENTER SBA TOOLS <span style={{ fontSize: 15, marginLeft: 2 }}>?</span>
          </div>
        </button>

        {/* Bond Card */}
        <button
          onClick={() => handleChoose('bond')}
          onMouseEnter={() => setHovering('bond')}
          onMouseLeave={() => setHovering(null)}
          style={{
            border: `1px solid ${hovering === 'bond' ? 'rgba(251,191,36,0.55)' : 'rgba(251,191,36,0.15)'}`,
            borderRadius: 14,
            background: hovering === 'bond' ? 'linear-gradient(145deg,rgba(78,50,8,0.88),rgba(55,33,3,0.92))' : 'rgba(32,20,3,0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            padding: '32px 26px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
            transform: hovering === 'bond' ? 'translateY(-5px) scale(1.015)' : 'scale(1)',
            boxShadow: hovering === 'bond' ? '0 28px 70px rgba(180,110,10,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 4px 24px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 11,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(180,83,9,0.28))',
            border: '1px solid rgba(251,191,36,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
          }}>
            <BondIcon />
          </div>
          <h2 style={{ color: '#fffbeb', fontSize: 21, fontWeight: 800, margin: '0 0 9px', letterSpacing: '-0.025em' }}>Surety Bonds</h2>
          <p style={{ color: 'rgba(253,210,130,0.7)', fontSize: 13, lineHeight: 1.65, margin: '0 0 20px', fontWeight: 400 }}>
            Contractor file readiness scoring, WIP risk detection, financial spreading, and structured carrier handoff memos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['Readiness', 'WIP Review', 'Spreading', 'Handoff Memo'].map(tag => (
              <span key={tag} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)', letterSpacing: '0.01em' }}>{tag}</span>
            ))}
          </div>
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 5, color: '#fbbf24', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em' }}>
            ENTER BOND TOOLS <span style={{ fontSize: 15, marginLeft: 2 }}>?</span>
          </div>
        </button>
      </div>

      <p style={{ color: 'rgba(130,155,210,0.35)', fontSize: 11.5, marginTop: 28, position: 'relative', zIndex: 1, letterSpacing: '0.04em' }}>
        Your preference is saved Ñ switch anytime from the header
      </p>

      <style>{`
        @keyframes float3d {
          0%,100% { transform: rotateX(10deg) rotateY(-3deg); }
          25%      { transform: rotateX(6deg) rotateY(4deg); }
          50%      { transform: rotateX(13deg) rotateY(2deg); }
          75%      { transform: rotateX(8deg) rotateY(-4deg); }
        }
      `}</style>
    </div>
  );
}
