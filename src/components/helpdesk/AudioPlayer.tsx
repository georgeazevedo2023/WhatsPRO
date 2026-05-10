import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  direction: string;
}

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const SPEEDS = [1, 1.5, 2];
const WAVEFORM_BARS = 32;

// Pseudo-random heights per src — estável (memo) pra cada áudio render igual
const buildHeights = (seed: string): number[] => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const heights: number[] = [];
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    heights.push(0.35 + (h / 0x7fffffff) * 0.65);
  }
  return heights;
};

export const AudioPlayer = ({ src, direction }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const isOutgoing = direction === 'outgoing';
  const heights = useMemo(() => buildHeights(src), [src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('[AudioPlayer] Play error:', err);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => { setIsPlaying(false); setCurrentTime(0); };
    const onError = () => setLoadError(true);

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  if (loadError) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Erro ao carregar áudio
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const filledBars = Math.round((progress / 100) * WAVEFORM_BARS);
  const timeLabel = isPlaying || currentTime > 0
    ? formatTime(currentTime)
    : formatTime(duration);

  return (
    <div
      className={cn(
        'group/audio flex items-center gap-2.5 min-w-[240px] w-full max-w-[320px] py-1',
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/pause + mic decorativo */}
      <div className="relative flex-shrink-0">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-all',
            'shadow-sm hover:shadow active:scale-95',
            isOutgoing
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-400 dark:hover:bg-sky-500 dark:text-slate-900',
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
            isOutgoing
              ? 'bg-emerald-100 border-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:border-emerald-950 dark:text-emerald-300'
              : 'bg-sky-100 border-sky-50 text-sky-600 dark:bg-sky-900 dark:border-sky-950 dark:text-sky-300',
          )}
          aria-hidden
        >
          <Mic className="h-2 w-2" />
        </span>
      </div>

      {/* Waveform + tempo */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="relative h-7 flex items-center">
          <div className="flex items-center gap-[2px] w-full h-full">
            {heights.map((h, i) => {
              const filled = i < filledBars;
              return (
                <span
                  key={i}
                  className={cn(
                    'flex-1 rounded-full transition-colors duration-100',
                    filled
                      ? (isOutgoing ? 'bg-emerald-500' : 'bg-sky-500 dark:bg-sky-400')
                      : (isOutgoing ? 'bg-emerald-500/25' : 'bg-foreground/30 dark:bg-foreground/40'),
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Posição do áudio"
          />
        </div>
        <span
          className={cn(
            'text-[10px] tabular-nums leading-none font-medium',
            isOutgoing ? 'text-emerald-50/90' : 'text-foreground/70',
          )}
        >
          {timeLabel}
        </span>
      </div>

      {/* Speed pill */}
      <button
        onClick={cycleSpeed}
        aria-label={`Velocidade ${playbackRate}x`}
        className={cn(
          'flex-shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 transition-all tabular-nums',
          isPlaying
            ? (isOutgoing ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white dark:bg-sky-400 dark:text-slate-900')
            : (isOutgoing ? 'bg-emerald-500/20 text-emerald-50' : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/15'),
        )}
      >
        {playbackRate}x
      </button>
    </div>
  );
};
