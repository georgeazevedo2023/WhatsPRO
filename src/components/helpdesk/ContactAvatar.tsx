import { useState } from 'react';
import { User } from 'lucide-react';

interface ContactAvatarProps {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  className?: string;
}

export function ContactAvatar({ src, name, size = 32, className = '' }: ContactAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || '?').charAt(0).toUpperCase();
  const px = `${size}px`;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt=""
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: px, height: px }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {size >= 40 ? (
        <span className="text-muted-foreground font-semibold" style={{ fontSize: `${size * 0.4}px` }}>
          {initials}
        </span>
      ) : (
        <User className="text-muted-foreground" style={{ width: `${size * 0.5}px`, height: `${size * 0.5}px` }} />
      )}
    </div>
  );
}
