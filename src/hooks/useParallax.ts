import { useEffect, useRef, useState } from 'react';

export function useParallax(speed = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let scheduled = false;
    const handleScroll = () => {
      if (!ref.current || scheduled) return;
      scheduled = true;
      rafId = requestAnimationFrame(() => {
        scheduled = false;
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const viewH = window.innerHeight;
        // Only compute when element is near viewport
        if (rect.bottom < -200 || rect.top > viewH + 200) return;
        const center = rect.top + rect.height / 2 - viewH / 2;
        setOffset(center * speed);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [speed]);

  return { ref, offset };
}
