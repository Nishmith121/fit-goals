import React, { useState, useEffect, useRef } from 'react';
import './PillNav.css';

function mapEase(ease) {
  if (!ease) return 'cubic-bezier(0.16, 1, 0.3, 1)';
  if (ease.includes('power2')) return 'cubic-bezier(0.25, 1, 0.5, 1)';
  if (ease.includes('power3')) return 'cubic-bezier(0.16, 1, 0.3, 1)';
  if (ease.includes('power4') || ease.includes('expo')) return 'cubic-bezier(0.19, 1, 0.22, 1)';
  return ease;
}

export default function PillNav({
  logo,
  logoAlt = 'Company Logo',
  items = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    { label: 'Contact', href: '/contact' }
  ],
  activeHref = '/',
  className = '',
  ease = 'power2.easeOut',
  baseColor = '#000000',
  pillColor = '#ffffff',
  hoveredPillTextColor = '#ffffff',
  pillTextColor = '#000000',
  onItemClick
}) {
  const [currentActive, setCurrentActive] = useState(activeHref);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [indicator, setIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0
  });

  const navRef = useRef(null);
  const itemRefs = useRef([]);

  const transitionTiming = mapEase(ease);

  // Sync state if activeHref prop updates externally
  useEffect(() => {
    setCurrentActive(activeHref);
  }, [activeHref]);

  // Update pill position based on active or hovered item
  const updateIndicator = (targetEl) => {
    if (!targetEl || !navRef.current) return;
    setIndicator({
      left: targetEl.offsetLeft,
      top: targetEl.offsetTop,
      width: targetEl.offsetWidth,
      height: targetEl.offsetHeight,
      opacity: 1
    });
  };

  useEffect(() => {
    const activeIndex = items.findIndex((item) => item.href === currentActive);
    const targetEl =
      hoveredIndex !== null
        ? itemRefs.current[hoveredIndex]
        : activeIndex !== -1
        ? itemRefs.current[activeIndex]
        : null;

    if (targetEl) {
      updateIndicator(targetEl);
    } else {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [currentActive, hoveredIndex, items]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      const activeIndex = items.findIndex((item) => item.href === currentActive);
      const targetEl =
        hoveredIndex !== null
          ? itemRefs.current[hoveredIndex]
          : activeIndex !== -1
          ? itemRefs.current[activeIndex]
          : null;
      if (targetEl) updateIndicator(targetEl);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentActive, hoveredIndex, items]);

  const handleLinkClick = (e, item, index) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCurrentActive(item.href);
    if (onItemClick) {
      onItemClick(item, index);
    }
    if (item.onClick) {
      item.onClick(e);
    }
  };

  return (
    <nav
      className={`pill-nav-container ${className}`}
      style={{
        backgroundColor: baseColor,
        '--pill-color': pillColor,
        '--pill-text-color': pillTextColor || '#000000',
        '--hovered-text-color': hoveredPillTextColor || '#000000'
      }}
    >
      {/* Brand Logo */}
      {logo && (
        <a
          href="/"
          className="pill-nav-logo-wrap"
          onClick={(e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            setCurrentActive('/');
            if (onItemClick) {
              onItemClick({ label: 'Home', href: '/' }, 0);
            }
          }}
        >
          {typeof logo === 'string' ? (
            <img src={logo} alt={logoAlt} className="pill-nav-logo-img" />
          ) : (
            logo
          )}
        </a>
      )}

      {/* Navigation Items with Sliding Pill Indicator */}
      <div
        className="pill-nav-items-track"
        ref={navRef}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Animated Sliding Pill Highlight */}
        <div
          className="pill-indicator-highlight"
          style={{
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
            width: `${indicator.width}px`,
            height: `${indicator.height}px`,
            opacity: indicator.opacity,
            backgroundColor: pillColor,
            transition: `transform 0.35s ${transitionTiming}, width 0.35s ${transitionTiming}, height 0.35s ${transitionTiming}, opacity 0.25s ease`
          }}
        />

        {items.map((item, index) => {
          const isActive = currentActive === item.href;
          const isHovered = hoveredIndex === index;
          const isHighlighted = (hoveredIndex !== null ? isHovered : isActive);

          return (
            <a
              key={index}
              ref={(el) => (itemRefs.current[index] = el)}
              href={item.href}
              className={`pill-nav-link ${isActive ? 'is-active' : ''} ${isHovered ? 'is-hovered' : ''}`}
              style={{
                color: isHighlighted ? '#000000' : undefined
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={(e) => handleLinkClick(e, item, index)}
            >
              <span
                className="pill-nav-label"
                style={{
                  color: isHighlighted ? '#000000' : undefined
                }}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
