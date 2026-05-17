import React, { useEffect, useRef } from 'react';

const COLORS   = ['#c9a84c', '#e2c06a', '#ffffff', '#e05c5c', '#4c9be8'];
const COUNT    = 150;
const DURATION = 3000; // ms

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  opacity: number;
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function initParticles(width: number, height: number): Particle[] {
  return Array.from({ length: COUNT }, () => ({
    x:             randomBetween(0, width),
    y:             randomBetween(-height * 0.2, 0),
    vx:            randomBetween(-2, 2),
    vy:            randomBetween(2, 6),
    rotation:      randomBetween(0, 360),
    rotationSpeed: randomBetween(-5, 5),
    size:          randomBetween(4, 8),
    color:         COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity:       1,
  }));
}

export function Confetti(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx    = canvas.getContext('2d')!;
    const width  = canvas.width  = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    const particles = initParticles(width, height);
    let startTime: number | null = null;
    let rafId: number | null     = null;

    const draw = (timestamp: number): void => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      ctx.clearRect(0, 0, width, height);

      const progress = elapsed / DURATION;

      particles.forEach(p => {
        p.x             += p.vx;
        p.y             += p.vy;
        p.rotation      += p.rotationSpeed;
        p.vy             += 0.1; // gravity
        p.opacity        = Math.max(0, 1 - Math.pow(progress, 2));

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      });

      if (elapsed < DURATION) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 199,
      }}
    />
  );
}
