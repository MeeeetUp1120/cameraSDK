import { useId } from "react";

interface CircleProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

export function CircleProgress({ progress, size = 280, strokeWidth = 8, color: customColor, className }: CircleProgressProps) {
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  const instanceId = useId();
  const gradientId = `progress-gradient-${instanceId}`;
  const glowFilterId = `glow-filter-${instanceId}`;

  const progressColor = customColor ?? (
    progress < 0.3 ? "#ef4444" :
    progress < 0.7 ? "#f59e0b" :
    progress < 0.95 ? "#10b981" :
    "#06d6a0"
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={progressColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor={progressColor} stopOpacity="1" />
            <stop offset="100%" stopColor={progressColor} stopOpacity="0.9" />
          </linearGradient>
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth * 0.8} fill="transparent" />
        <circle cx={center} cy={center} r={radius + 2} stroke={progressColor} strokeWidth={strokeWidth * 0.3} fill="transparent" opacity="0.2" className="animate-pulse" style={{ filter: "blur(2px)" }} />
        <circle cx={center} cy={center} r={radius} stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" filter={`url(#${glowFilterId})`} className="transition-all duration-200 ease-out" />
        {progress > 0.8 && (
          <circle
            cx={center + radius * Math.cos(progress * 2 * Math.PI - Math.PI / 2)}
            cy={center + radius * Math.sin(progress * 2 * Math.PI - Math.PI / 2)}
            r={strokeWidth * 0.6}
            fill={progressColor}
            className="animate-pulse"
            style={{ filter: `drop-shadow(0 0 4px ${progressColor})` }}
          />
        )}
      </svg>
      {progress > 0.9 && (
        <div className="absolute inset-0 rounded-full animate-ping" style={{ border: `2px solid ${progressColor}`, opacity: 0.3 }} />
      )}
    </div>
  );
}
