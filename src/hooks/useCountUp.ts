
import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  start?: number;
  delay?: number;
  enabled?: boolean;
}

export const useCountUp = ({
  end,
  duration = 2000,
  start = 0,
  delay = 0,
  enabled = true,
}: UseCountUpOptions) => {
  const [count, setCount] = useState(start);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCount(start);
      return;
    }

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
        const easeOutQuad = 1 - (1 - progress) * (1 - progress);
        const currentCount = Math.floor(start + (end - start) * easeOutQuad);

        setCount(currentCount);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      startTimeRef.current = null;
    };
  }, [end, duration, start, delay, enabled]);

  return count;
};

export default useCountUp;
