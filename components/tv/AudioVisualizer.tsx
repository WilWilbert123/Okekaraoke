'use client';

// ============================================================
// OKEKARAOKE — Audio Frequency Spectrum Visualizer
// Real-time animated equalizer spectrum bars at bottom of TV & Solo TV
// ============================================================

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number; // max height in px (e.g. 24px for TV, 16px for Solo TV)
  className?: string;
}

export function AudioVisualizer({
  isPlaying,
  barCount = 36,
  height = 24,
  className = '',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize per-bar frequency band parameters
    const phases = Array.from({ length: barCount }, () => Math.random() * Math.PI * 2);
    const freqMultipliers = Array.from({ length: barCount }, (_, i) => {
      // Alternating band weights to create distinct staggered equalizer bars
      return 0.6 + Math.sin(i * 1.7) * 0.35 + ((i * 13) % 7) * 0.08;
    });
    const currentHeights = Array.from({ length: barCount }, () => 3);
    const peakHeights = Array.from({ length: barCount }, () => 3);
    const peakHoldTimes = Array.from({ length: barCount }, () => 0);

    const render = (time: number) => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.clientWidth;
      const h = height;

      if (width <= 0) return;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, h);

      const totalGapRatio = 0.32;
      const barWidth = (width / barCount) * (1 - totalGapRatio);
      const gap = (width / barCount) * totalGapRatio;

      for (let i = 0; i < barCount; i++) {
        let targetH = 3;

        if (isPlaying) {
          const normIdx = i / barCount;
          const mult = freqMultipliers[i];

          if (normIdx < 0.28) {
            // BASS BANDS (Left 28%): Heavy, tall punchy kicks
            const bassKick = Math.pow(Math.sin(time * 0.012 + (i % 3) * 0.7), 6);
            const subWave = Math.sin(time * 0.018 + phases[i]) * 0.5 + 0.5;
            targetH = 4 + (bassKick * 0.65 + subWave * 0.35) * mult * (h - 5);
          } else if (normIdx < 0.72) {
            // MID BANDS (Center 44%): High variance vocal & instrument EQ bars
            const midWave1 = Math.sin(time * (0.016 + mult * 0.012) + phases[i]) * 0.5 + 0.5;
            const midWave2 = Math.cos(time * (0.024 + mult * 0.018) + i * 0.9) * 0.5 + 0.5;
            const pulse = Math.pow(Math.sin(time * 0.02 + i * 1.3), 4) * 0.4;
            const raw = Math.min(1.0, (midWave1 * 0.45 + midWave2 * 0.35 + pulse) * mult);
            targetH = 3.5 + raw * (h - 4.5);
          } else {
            // TREBLE BANDS (Right 28%): Fast flickering hi-hats & cymbals
            const flutter1 = Math.sin(time * (0.035 + (i % 4) * 0.015) + phases[i]) * 0.5 + 0.5;
            const flutter2 = Math.cos(time * 0.05 + i * 1.1) * 0.5 + 0.5;
            const raw = (flutter1 * 0.6 + flutter2 * 0.4) * (0.55 + mult * 0.45);
            targetH = 3 + raw * (h - 5);
          }
        }

        // Snappy rise (0.55) & smooth fall decay (0.22)
        const diff = targetH - currentHeights[i];
        const lerpFactor = diff > 0 ? 0.55 : 0.22;
        currentHeights[i] += diff * lerpFactor;
        const barH = Math.max(3, currentHeights[i]);

        // Floating Peak Cap (Hardware EQ Peak Hold)
        if (barH >= peakHeights[i]) {
          peakHeights[i] = barH;
          peakHoldTimes[i] = 10; // Hold peak for 10 frames
        } else if (peakHoldTimes[i] > 0) {
          peakHoldTimes[i]--;
        } else {
          peakHeights[i] = Math.max(3, peakHeights[i] - 0.65); // Smooth gravity drop
        }

        const x = i * (barWidth + gap) + gap / 2;
        const y = h - barH;

        // Glowing neon gradient per bar
        const grad = ctx.createLinearGradient(0, h, 0, 0);
        const hueProgress = i / barCount;
        if (hueProgress < 0.35) {
          grad.addColorStop(0, '#2dd4bf'); // Teal
          grad.addColorStop(1, '#38bdf8'); // Sky Blue
        } else if (hueProgress < 0.7) {
          grad.addColorStop(0, '#818cf8'); // Indigo
          grad.addColorStop(1, '#c084fc'); // Purple
        } else {
          grad.addColorStop(0, '#f43f5e'); // Rose
          grad.addColorStop(1, '#fbbf24'); // Amber
        }

        // Draw main equalizer bar
        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, 2);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        // Draw Floating Peak Hold Dot / Cap
        if (isPlaying && peakHeights[i] > 4) {
          const capY = Math.max(0, h - peakHeights[i] - 2.5);
          ctx.fillStyle = hueProgress < 0.4 ? '#67e8f9' : hueProgress < 0.75 ? '#e879f9' : '#fde047';
          ctx.fillRect(x, capY, barWidth, 1.8);
        }
      }

      ctx.restore();

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(render);
    } else {
      render(0);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, barCount, height]);

  return (
    <div className={`w-full flex items-end pointer-events-none select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full opacity-90 filter drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]"
        style={{ height: `${height}px`, display: 'block' }}
      />
    </div>
  );
}
