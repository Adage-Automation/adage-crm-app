import { useId } from "react";
import { HEALTH_POSITIONS } from "./HealthTag";

function normalizeValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function getProspectHealthReason(value) {
  const normalized = normalizeValue(value);
  if (!normalized) return "Not yet scored";
  return normalized;
}

export function getProspectHealthLabelForPosition(position) {
  if (typeof position !== "number" || Number.isNaN(position)) return "Not yet scored";
  if (position <= 8.33) return "Poor";
  if (position <= 25) return "Between Poor and Average";
  if (position <= 41.67) return "Average";
  if (position <= 58.33) return "Between Average and Good";
  if (position <= 75) return "Good";
  if (position <= 91.67) return "Very Good";
  return "Excellent";
}

export default function HealthSpeedometer({ value, size = 44, position = null, fallbackLabel = null }) {
  const id = useId().replace(/:/g, "");
  const normalized = normalizeValue(value);
  const hasExplicitPosition = typeof position === "number" && !Number.isNaN(position);
  const activePosition = hasExplicitPosition
    ? Math.max(0, Math.min(100, position))
    : (Object.prototype.hasOwnProperty.call(HEALTH_POSITIONS, normalized) ? HEALTH_POSITIONS[normalized] : null);
  const isRegret = !hasExplicitPosition && normalized === "Regret";
  const isFallback = !hasExplicitPosition && (!normalized || normalized === "ERROR: No Expected Closing Date" || activePosition == null);

  const viewBox = 68;
  const center = 34;
  const radius = 24;
  const arcPath = "M 10 34 A 24 24 0 0 1 58 34";
  const needleAngle = activePosition == null ? 0 : -90 + (activePosition / 100) * 180;
  const gradientId = `health-gradient-${id}`;

  return (
    <svg
      width={size}
      height={Math.round(size * 0.58)}
      viewBox={`0 0 ${viewBox} 40`}
      role="img"
      aria-label={`Prospect health ${fallbackLabel || getProspectHealthReason(value)}`}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
          {isRegret ? (
            <>
              <stop offset="0%" stopColor="#D1D5DB" />
              <stop offset="100%" stopColor="#D1D5DB" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="33.33%" stopColor="#FACC15" />
              <stop offset="66.67%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#15803D" />
            </>
          )}
        </linearGradient>
      </defs>

      <path
        d={arcPath}
        fill="none"
        stroke={isFallback ? "#D1D5DB" : `url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={isFallback ? "3 3" : undefined}
        opacity={isFallback ? 0.95 : 1}
      />

      {activePosition != null && !isRegret && !isFallback && (
        <g transform={`rotate(${needleAngle} ${center} ${center})`}>
          <line x1={center} y1={center} x2={center} y2="14" stroke="#374151" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx={center} cy={center} r="3.1" fill="#374151" />
        </g>
      )}

      {isRegret && (
        <>
          <circle cx={center} cy={center - 2} r="8" fill="#F3F4F6" />
          <path d="M 29 21 L 39 11 M 39 21 L 29 11" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {isFallback && !isRegret && (
        <circle cx={center} cy={center - 1} r="2.2" fill="#D1D5DB" />
      )}
    </svg>
  );
}
