import React, { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import './BentoCard.css';

const DEFAULT_GLOW_COLOR = '56, 189, 248';

const createParticleElement = (x, y, color = DEFAULT_GLOW_COLOR) => {
  const el = document.createElement('div');
  el.className = 'bento-particle';
  el.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    background: rgba(${color}, 0.9);
    box-shadow: 0 0 6px rgba(${color}, 0.75);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 4;
  `;
  return el;
};

export default function BentoCard({
  children,
  className = '',
  enableTilt = true,
  enableStars = true,
  enableBorderGlow = true,
  particleCount = 8,
  glowColor = DEFAULT_GLOW_COLOR,
  tiltMax = 6,
  allowOverflow = false,
  style = {},
  onClick
}) {
  const cardRef = useRef(null);
  const particlesRef = useRef([]);
  const timeoutsRef = useRef([]);
  const isHoveredRef = useRef(false);

  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    particlesRef.current.forEach((p) => {
      gsap.to(p, {
        scale: 0,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => {
          if (p.parentNode) p.parentNode.removeChild(p);
        }
      });
    });
    particlesRef.current = [];
  }, []);

  const spawnParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current || !enableStars) return;
    const { width, height } = cardRef.current.getBoundingClientRect();

    for (let i = 0; i < particleCount; i++) {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const p = createParticleElement(
          Math.random() * width,
          Math.random() * height,
          glowColor
        );
        cardRef.current.appendChild(p);
        particlesRef.current.push(p);

        gsap.fromTo(
          p,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 0.9, duration: 0.35, ease: 'back.out(1.7)' }
        );

        gsap.to(p, {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          duration: 2 + Math.random() * 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });

        gsap.to(p, {
          opacity: 0.25,
          duration: 1.2 + Math.random(),
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut'
        });
      }, i * 90);

      timeoutsRef.current.push(timeoutId);
    }
  }, [enableStars, particleCount, glowColor]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    el.style.setProperty('--glow-color', glowColor);

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      spawnParticles();
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      clearParticles();

      if (enableTilt) {
        gsap.to(el, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.35,
          ease: 'power2.out'
        });
      }
    };

    const handleMouseMove = (e) => {
      if (!enableTilt) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -tiltMax;
      const rotateY = ((x - centerX) / centerX) * tiltMax;

      gsap.to(el, {
        rotateX,
        rotateY,
        duration: 0.15,
        ease: 'power2.out',
        transformPerspective: 1000
      });
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mousemove', handleMouseMove);

    return () => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mousemove', handleMouseMove);
      clearParticles();
    };
  }, [enableTilt, enableStars, spawnParticles, clearParticles, tiltMax, glowColor]);

  return (
    <div
      ref={cardRef}
      className={`bento-card ${enableBorderGlow ? 'bento-card--border-glow' : ''} ${
        allowOverflow ? 'allow-overflow' : ''
      } ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
