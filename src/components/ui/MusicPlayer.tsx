'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Background music player that auto-plays on first user interaction.
 * Uses a global click listener to bypass autoplay restrictions.
 */
export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio('/pixelmusic.mp3');
    audio.loop = true;
    audio.volume = 0.25;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Start playback on first user interaction anywhere on the page
  const handleFirstInteraction = useCallback(() => {
    if (started) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.play().then(() => {
      setStarted(true);
    }).catch(() => {
      // Browser still blocked — will retry on next click
    });
  }, [started]);

  useEffect(() => {
    if (started) return;
    document.addEventListener('click', handleFirstInteraction, { once: false });
    document.addEventListener('keydown', handleFirstInteraction, { once: false });
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [started, handleFirstInteraction]);

  // Handle mute toggle
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = muted;
  }, [muted]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!started) {
          handleFirstInteraction();
        }
        setMuted(m => !m);
      }}
      title={muted ? 'Unmute music' : 'Mute music'}
      className="flex items-center gap-1 text-[9px] text-[#7a6b55] hover:text-[#c4a46c] transition px-1.5 py-1 rounded hover:bg-[#1a1408]"
    >
      {/* Speaker icon using simple CSS shapes */}
      <span className="relative w-3.5 h-3.5 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-80">
          <path d="M2 5h2l3-3v10l-3-3H2V5z" fill="currentColor" />
          {!muted && (
            <>
              <path d="M9 4.5c.8.8.8 2.2 0 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M10.5 3c1.4 1.4 1.4 3.6 0 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}
          {muted && (
            <path d="M9 5l3 3M12 5l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          )}
        </svg>
      </span>
    </button>
  );
}
