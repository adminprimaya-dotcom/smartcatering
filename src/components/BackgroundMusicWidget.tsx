import React, { useEffect, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
import { MusicTrack, SiteContentSettings } from '../types/erp';
import { resolveThemePreset } from '../utils/themePresets';

interface BackgroundMusicWidgetProps {
  track: MusicTrack | null;
  shouldLoopSingle: boolean;
  accentTheme?: SiteContentSettings['accentTheme'];
  onTrackEnded: () => void;
}

export const BackgroundMusicWidget: React.FC<BackgroundMusicWidgetProps> = ({
  track,
  shouldLoopSingle,
  accentTheme,
  onTrackEnded,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const userPausedRef = useRef(false);
  const theme = resolveThemePreset(accentTheme);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !track?.audioUrl) {
      setIsPlaying(false);
      return;
    }

    let cancelled = false;
    let gestureAttached = false;

    const detachGestureFallback = () => {
      if (!gestureAttached) return;
      gestureAttached = false;
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    const attemptAutoPlay = async () => {
      if (cancelled || userPausedRef.current) return;
      const el = audioRef.current;
      if (!el) return;
      try {
        el.volume = 0.7;
        await el.play();
        if (!cancelled) {
          setIsPlaying(true);
          detachGestureFallback();
        }
      } catch {
        // Browser autoplay policy blocked unmuted autoplay before user interaction.
        // Attach a clean one-time gesture listener so the very next interaction starts audio smoothly.
        if (!cancelled && !gestureAttached) {
          gestureAttached = true;
          window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
          window.addEventListener('keydown', handleFirstGesture, { passive: true });
          window.addEventListener('touchstart', handleFirstGesture, { passive: true });
        }
      }
    };

    function handleFirstGesture() {
      detachGestureFallback();
      void attemptAutoPlay();
    }

    userPausedRef.current = false;
    void attemptAutoPlay();

    return () => {
      cancelled = true;
      detachGestureFallback();
    };
  }, [track?.id, track?.audioUrl]);

  const handleTogglePlayback = async () => {
    const audioEl = audioRef.current;
    if (!audioEl || !track?.audioUrl) return;

    if (audioEl.paused) {
      userPausedRef.current = false;
      try {
        audioEl.volume = 0.7;
        await audioEl.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      userPausedRef.current = true;
      audioEl.pause();
      setIsPlaying(false);
    }
  };

  if (!track) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 no-print">
      <audio
        ref={audioRef}
        src={track.audioUrl}
        autoPlay
        loop={shouldLoopSingle}
        playsInline
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (!shouldLoopSingle) {
            onTrackEnded();
          }
        }}
      />

      {/* Minimalist display: ONLY music logo and music title */}
      <button
        type="button"
        onClick={handleTogglePlayback}
        aria-label={`Musik latar: ${track.title}`}
        title={isPlaying ? `${track.title} (Klik untuk jeda)` : `${track.title} (Klik untuk putar)`}
        className={`flex items-center gap-2.5 rounded-xl border ${theme.cardBorderClass} bg-white/95 backdrop-blur-xs px-3 py-2 shadow-lg hover:bg-slate-50 transition-colors max-w-[260px]`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${
            isPlaying ? theme.primaryBtnClass : 'bg-slate-900 text-amber-300'
          }`}
        >
          <Music2 className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold text-slate-900 truncate whitespace-nowrap">
          {track.title}
        </span>
      </button>
    </div>
  );
};
