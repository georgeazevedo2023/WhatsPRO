import { memo, useRef, useState, useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazySectionProps {
  children: ReactNode;
  height?: string;
  className?: string;
}

const LazySection = ({ children, height = '280px', className }: LazySectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: force render after 2s if observer doesn't trigger
    const fallback = setTimeout(() => setVisible(true), 2000);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          clearTimeout(fallback);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  if (!visible) {
    return (
      <div ref={ref} className={className}>
        <Skeleton style={{ height }} className="w-full rounded-xl" />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};

export default memo(LazySection);
