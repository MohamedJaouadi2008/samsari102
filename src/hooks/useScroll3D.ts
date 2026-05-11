import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScroll3DOptions {
  threshold?: number;
  triggerOnce?: boolean;
}

export function useScroll3D(options: UseScroll3DOptions = {}) {
  const { threshold = 0.1, triggerOnce = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(el);

    let rafId = 0;
    let scheduled = false;
    const handleScroll = () => {
      if (!el || scheduled) return;
      scheduled = true;
      rafId = requestAnimationFrame(() => {
        scheduled = false;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const viewH = window.innerHeight;
        // progress: 0 = just entering bottom, 1 = at center, 2 = exiting top
        const p = Math.max(0, Math.min(1, 1 - (rect.top / viewH)));
        setProgress(p);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      observer.unobserve(el);
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [threshold, triggerOnce]);

  return { ref, isVisible, progress };
}
