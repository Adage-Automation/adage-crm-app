import { useEffect, useRef, useState } from "react";
import { T } from "../constants/theme";

export const HEALTH_POSITIONS = {
  Poor: 0,
  "Between Poor and Average": 16.67,
  Average: 33.33,
  "Between Average and Good": 50,
  Good: 66.67,
  "Very Good": 83.33,
  Excellent: 100,
};

export const HEALTH_COLORS = {
  Poor: { bg: "#FEE2E2", text: "#DC2626" },
  "Between Poor and Average": { bg: "#FFEDD5", text: "#F97316" },
  Average: { bg: "#FEF9C3", text: "#CA8A04" },
  "Between Average and Good": { bg: "#FEF9C3", text: "#CA8A04" },
  Good: { bg: "#DCFCE7", text: "#16A34A" },
  "Very Good": { bg: "#DCFCE7", text: "#15803D" },
  Excellent: { bg: "#DCFCE7", text: "#166534" },
  Regret: { bg: "#F3F4F6", text: "#6B7280" },
};

export const ROOT_LABELS = {
  Poor: { text: "Missed Opportunity without any action", splits: false },
  "Between Poor and Average": { text: "Missed Opportunity", splits: true },
  Average: { text: "Missed Opportunity / Pending Sales Action", splits: true },
  "Between Average and Good": { text: "Close to Due Date / Pending Sales Action", splits: true },
  Good: { text: "Prospect On Track", splits: false },
  "Very Good": { text: "Prospect On Track", splits: false },
  Excellent: { text: "Prospect Resulted in RFQ", splits: false },
  Regret: { text: "Missed Opportunity", splits: true },
};

export const AGGREGATE_TOOLTIP_TEXT = `Each filtered lead first gets a per-record score based on:
- expected closing timing: overdue / this week / this month / beyond
- engagement activity: no activity / planned activity / completed activity
- manual lost status can mark the lead as Regret

That per-record outcome is then mapped to a score out of 100:
- Poor = 0
- Between Poor and Average = 16.67
- Average = 33.33
- Between Average and Good = 50
- Good = 66.67
- Very Good = 83.33
- Excellent = 100

Regretted leads are excluded from the average.

The Overall Prospect Health card then averages the scored leads in the current filtered view and shows the closest matching tier.`;

function normalizeHealth(value) {
  if (value == null) return "";
  return String(value).trim();
}

function parseExpectedClosing(iso) {
  if (!iso) return null;
  const parts = String(iso).split("T")[0].split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getDateHorizon(expectedClosingISO) {
  const dt = parseExpectedClosing(expectedClosingISO);
  if (!dt) return "no_date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((dt - today) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 31) return "this_month";
  return "later";
}

function getFallbackText(health) {
  const normalized = normalizeHealth(health);
  return normalized === "ERROR: No Expected Closing Date" ? normalized : "Not yet scored";
}

export function hasCompletedActivity(recordOrLines) {
  const lines = Array.isArray(recordOrLines)
    ? recordOrLines
    : Array.isArray(recordOrLines?.x_studio_engagement_tracker)
      ? recordOrLines.x_studio_engagement_tracker
      : [];

  const activeLines = lines.filter((line) => line?.x_studio_engagement_status !== "Cancelled");
  return activeLines.some((line) => line?.x_studio_engagement_status === "Completed");
}

export function hasAnyActivity(recordOrLines) {
  const lines = Array.isArray(recordOrLines)
    ? recordOrLines
    : Array.isArray(recordOrLines?.x_studio_engagement_tracker)
      ? recordOrLines.x_studio_engagement_tracker
      : [];

  const activeLines = lines.filter((line) => line?.x_studio_engagement_status !== "Cancelled");
  return activeLines.length > 0;
}

export function getHealthLabel(health, hasCompleted, hasAny) {
  const normalized = normalizeHealth(health);
  const anyAction = !!hasAny;
  const labelMatrix = {
    Poor: anyAction ? "Pending Sales Action" : "Missed Opportunity without any action",
    "Between Poor and Average": hasCompleted
      ? "Missed Opportunity despite Sales attempts"
      : anyAction
        ? "Pending Sales Action"
        : "Missed Opportunity without any action",
    Average: hasCompleted
      ? "Missed Opportunity despite Sales attempts"
      : "Pending Sales Action",
    "Between Average and Good": hasCompleted
      ? "Close to Due Date"
      : "Pending Sales Action",
    Good: "Prospect On Track",
    "Very Good": "Prospect On Track",
    Excellent: "Prospect Resulted in RFQ",
    Regret: hasCompleted
      ? "Missed Opportunity"
      : "Missed Opportunity without any action",
  };
  return labelMatrix[normalized] ?? null;
}

export function getClosestHealthTier(position) {
  if (typeof position !== "number" || Number.isNaN(position)) return null;

  return Object.entries(HEALTH_POSITIONS).reduce((closest, entry) => {
    if (!closest) return entry[0];
    const [, currentPosition] = entry;
    const currentDistance = Math.abs(currentPosition - position);
    const closestDistance = Math.abs(HEALTH_POSITIONS[closest] - position);
    return currentDistance < closestDistance ? entry[0] : closest;
  }, null);
}

export function getAggregateHealthReason(bucketTier, completedStates) {
  const bucketConfig = ROOT_LABELS[bucketTier];
  if (!bucketConfig) return "Not yet scored";
  if (!bucketConfig.splits) return bucketConfig.text;

  const attempted = completedStates.filter(Boolean).length;
  const noAction = completedStates.length - attempted;
  return `${bucketConfig.text} (${noAction} no action, ${attempted} attempted)`;
}

export function getHealthTagMeta(health, hasCompleted, hasAnyActivityFlag) {
  const normalized = normalizeHealth(health);
  const fallbackText = getFallbackText(normalized);
  const hasAny = !!hasAnyActivityFlag || !!hasCompleted;

  if (!normalized || normalized === "ERROR: No Expected Closing Date") {
    return {
      text: fallbackText,
      bg: "#FFFFFF",
      textColor: "#6B7280",
      border: "#D1D5DB",
      outlined: true,
    };
  }

  const text = getHealthLabel(normalized, hasCompleted, hasAny);
  const colors = HEALTH_COLORS[normalized];

  if (!text || !colors) {
    return {
      text: fallbackText,
      bg: "#FFFFFF",
      textColor: "#6B7280",
      border: "#D1D5DB",
      outlined: true,
    };
  }

  return {
    text,
    bg: colors.bg,
    textColor: colors.text,
    border: `${colors.text}33`,
    outlined: false,
  };
}

export function getHealthTagTooltipText(health, hasCompleted, hasAnyActivityFlag) {
  const normalized = normalizeHealth(health);
  const hasAny = !!hasAnyActivityFlag || !!hasCompleted;

  if (!normalized) return "Not yet scored";
  if (normalized === "ERROR: No Expected Closing Date") return normalized;

  const label = getHealthLabel(normalized, !!hasCompleted, hasAny);
  const activityState = hasCompleted ? "Completed activity present" : hasAny ? "Planned activity present" : "No activity present";

  if (!label) return `${normalized}\n${activityState}`;
  return `${label}\nProspect Health: ${normalized}\n${activityState}`;
}

function getHealthTagReasonTooltip({ health, expectedClosingISO, hasCompleted, hasAnyActivityFlag }) {
  const normalized = normalizeHealth(health);
  if (!normalized) return "Prospect health is not yet scored. Add an expected closing date to enable scoring.";
  if (normalized === "ERROR: No Expected Closing Date") return "Expected closing date is missing, so the health score cannot be calculated.";

  if (normalized === "Regret") return "This lead is marked as Regret (lost).";

  const hasAny = !!hasAnyActivityFlag || !!hasCompleted;
  const horizon = getDateHorizon(expectedClosingISO);

  const tagText = getHealthLabel(normalized, !!hasCompleted, hasAny) || "";
  const isNoActionTag = tagText === "Missed Opportunity without any action";
  const isPendingActionTag = tagText === "Pending Sales Action";
  const isAttemptedMissedTag = tagText === "Missed Opportunity despite Sales attempts";
  const isCloseToDueTag = tagText === "Close to Due Date";
  const isOnTrackTag = tagText === "Prospect On Track";
  const isRFQTag = tagText === "Prospect Resulted in RFQ";
  const isMissedOpportunityTag = tagText === "Missed Opportunity";

  if (isNoActionTag) {
    if (horizon === "overdue") return "Expected closing date is past due without any sales activity planned or completed.";
    if (horizon === "this_week") return "Expected closing date is this week. Opportunity may be missed if no sales activity is planned or completed.";
    if (horizon === "this_month") return "Expected closing date is this month, but no sales activity is planned or completed yet.";
    if (horizon === "later") return "Expected closing date is upcoming, but no sales activity is planned or completed yet.";
    return "No expected closing date is set, and no sales activity is planned or completed.";
  }

  if (isPendingActionTag) {
    if (!hasAny) {
      if (horizon === "overdue") return "Expected closing date is past due. No sales activity is planned or completed.";
      if (horizon === "this_week") return "Expected closing date is this week. Plan a sales activity to avoid slippage.";
      if (horizon === "this_month") return "Expected closing date is this month. Plan at least one sales activity to keep this on track.";
      return "Plan a sales activity to move this opportunity forward.";
    }
    if (!hasCompleted) {
      if (horizon === "overdue") return "Expected closing date is past due. Sales activity is planned but not yet complete. Follow up urgently.";
      if (horizon === "this_week") return "Expected closing date is this week. Sales activity is planned. Ensure it is completed before the due date.";
      if (horizon === "this_month") return "Expected closing date is this month. Sales activity is planned. Ensure it happens on time.";
      return "Sales activity is planned. Keep the momentum and complete the next step.";
    }
    if (horizon === "overdue") return "Expected closing date is past due even though sales activity has been completed. Review next steps or re-qualify.";
    return "Sales activity has been completed. Continue progressing to the next step.";
  }

  if (isAttemptedMissedTag) {
    if (horizon === "overdue") return "Expected closing date is past due despite completed sales attempts. Consider escalation or closing the loop.";
    if (horizon === "this_week") return "Expected closing date is this week despite completed sales attempts. Confirm next step immediately.";
    return "Sales attempts have been made, but the opportunity is not progressing as expected. Review blockers and next actions.";
  }

  if (isCloseToDueTag) {
    if (horizon === "overdue") return "Expected closing date is past due. Follow up immediately and confirm revised timeline.";
    if (horizon === "this_week") return "Expected closing date is this week. Ensure the next action is completed and timeline is confirmed.";
    if (horizon === "this_month") return "Expected closing date is this month. Keep follow-ups tight to prevent slipping.";
    return "Due date is approaching. Maintain cadence and confirm timeline.";
  }

  if (isOnTrackTag) {
    if (horizon === "overdue") return "Expected closing date is past due. Review and update the closing date or next steps.";
    if (!hasAny) return "Opportunity looks on track, but no activity is logged. Plan a next step to maintain momentum.";
    if (!hasCompleted) return "Opportunity is on track with planned activity. Ensure it is completed as scheduled.";
    return "Opportunity is on track with sales activity completed. Continue progression.";
  }

  if (isRFQTag) {
    return "This opportunity is trending toward RFQ. Ensure RFQ conversion steps are followed up promptly.";
  }

  if (isMissedOpportunityTag) {
    if (hasCompleted) return "Opportunity is marked as missed despite completed activity. Review the loss reason and next steps.";
    return "Opportunity is marked as missed with no completed activity. Review timeline and actions taken.";
  }

  if (horizon === "overdue") return "Expected closing date is past due. Review next steps and update activity.";
  if (horizon === "this_week") return "Expected closing date is this week. Ensure next steps are scheduled and completed.";
  if (horizon === "this_month") return "Expected closing date is this month. Keep activity cadence to avoid slippage.";
  if (horizon === "later") return "Expected closing date is upcoming. Maintain momentum with planned activities.";
  return "Review expected closing date and activity to understand the current health tag.";
}

export default function HealthTag({ health, hasCompleted, hasAnyActivity: hasAnyActivityFlag, expectedClosingISO }) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveringInfo, setHoveringInfo] = useState(false);
  const infoRef = useRef(null);
  const meta = getHealthTagMeta(health, hasCompleted, hasAnyActivityFlag);
  const tooltip = getHealthTagReasonTooltip({ health, expectedClosingISO, hasCompleted, hasAnyActivityFlag });

  useEffect(() => {
    if (!showInfo) return undefined;

    const handlePointerDown = (event) => {
      if (infoRef.current && !infoRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowInfo(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showInfo]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minWidth: 0,
          maxWidth: "100%",
          padding: "3px 9px",
          borderRadius: 999,
          border: `1px solid ${meta.border}`,
          background: meta.bg,
          color: meta.textColor,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.25,
          whiteSpace: "normal",
          overflowWrap: "anywhere",
        }}
      >
        {meta.text}
      </span>
      <span
        ref={infoRef}
        onMouseEnter={() => {
          setHoveringInfo(true);
          setShowInfo(true);
        }}
        onMouseLeave={() => {
          setHoveringInfo(false);
          setShowInfo(false);
        }}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.25,
            fontFamily: "inherit",
            color: hoveringInfo || showInfo ? T.accent : T.textMuted,
            cursor: "pointer",
            transition: "color 0.15s ease",
          }}
        >
          ?
        </button>
        {showInfo && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: 240,
              maxWidth: "min(240px, calc(100vw - 40px))",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
              padding: "10px 12px",
              zIndex: 40,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#374151",
                lineHeight: 1.45,
                whiteSpace: "normal",
              }}
            >
              {tooltip}
            </div>
          </div>
        )}
      </span>
    </span>
  );
}
