import { useRef, useCallback } from 'react';

export function useTilt3D(maxTilt = 8) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * maxTilt}deg) rotateX(${-y * maxTilt}deg) scale3d(1.02, 1.02, 1.02)`;
  }, [maxTilt]);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)';
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}
