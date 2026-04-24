"use client";

/**
 * OmniVoice cost + idle-timer widget.
 *
 * The private HF Space runs on an Nvidia T4 small at $0.40/hr. It is
 * configured to sleep after 1 hour of inactivity. Every successful
 * generation pushes the sleep deadline out by 60 minutes.
 *
 * This widget tracks:
 *   - Active uptime since the first generation of the session
 *   - Approximate running cost = uptime × ($0.40 / 60min)
 *   - Countdown until the Space auto-sleeps (reset on every generation)
 *
 * All state is held in localStorage so it survives reloads, but is scoped
 * per-origin so concurrent users don't share a cost window.
 */

import { useEffect, useState } from "react";
import { Clock, DollarSign, Moon, Zap } from "lucide-react";

const STORAGE_KEY = "omnivoice:cost-session:v1";
/** Hard-coded from the Vercel env docs — T4 small per-hour rate on HF. */
export const HOURLY_RATE_USD = 0.4;
/** Space is configured to sleep after 1 hour idle. */
export const SLEEP_AFTER_MS = 60 * 60 * 1000;

interface Session {
  /** ms epoch — first generation that started this active window */
  firstGenAt: number;
  /** ms epoch — most recent successful generation */
  lastGenAt: number;
  /** cumulative cost USD from previous active windows closed out by sleep */
  accumulatedCost: number;
  /** total generations in this session */
  generations: number;
}

function loadSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(s: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage disabled — fine */
  }
}

/**
 * Record a successful generation. Call this from the /omnivoice page after
 * every audio response. Returns the updated session so callers can display
 * the new cost/time without waiting for the next poll tick.
 */
export function recordGeneration(): Session {
  const now = Date.now();
  const prev = loadSession();
  let session: Session;
  if (!prev) {
    session = { firstGenAt: now, lastGenAt: now, accumulatedCost: 0, generations: 1 };
  } else {
    // If the Space slept between generations, fold the previous window's
    // cost into accumulatedCost and open a new active window.
    const sleptBetween = now - prev.lastGenAt > SLEEP_AFTER_MS;
    if (sleptBetween) {
      const closedWindowMs = Math.min(
        prev.lastGenAt - prev.firstGenAt + SLEEP_AFTER_MS,
        prev.lastGenAt - prev.firstGenAt + SLEEP_AFTER_MS
      );
      const closedCost =
        (closedWindowMs / 3_600_000) * HOURLY_RATE_USD + prev.accumulatedCost;
      session = {
        firstGenAt: now,
        lastGenAt: now,
        accumulatedCost: closedCost,
        generations: prev.generations + 1,
      };
    } else {
      session = { ...prev, lastGenAt: now, generations: prev.generations + 1 };
    }
  }
  saveSession(session);
  return session;
}

export function clearCostSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function OmniVoiceCostMeter({
  compact = false,
  onReset,
}: {
  compact?: boolean;
  onReset?: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Load the session once on mount, then tick once a second for live updates
  useEffect(() => {
    setSession(loadSession());
    const interval = setInterval(() => {
      setSession(loadSession());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!session) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 text-muted-foreground ${
          compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
        }`}
      >
        <Zap className="h-3 w-3" />
        <span>No generations yet this session</span>
        <span className="ml-auto opacity-70">$0.40/hr · T4 small</span>
      </div>
    );
  }

  const idleMs = now - session.lastGenAt;
  const asleep = idleMs >= SLEEP_AFTER_MS;
  const sleepIn = Math.max(0, SLEEP_AFTER_MS - idleMs);
  const activeMs = asleep
    ? 0
    : Math.max(0, session.lastGenAt - session.firstGenAt + idleMs);

  // Current window's approximate cost (including the still-open minutes since
  // the last generation).
  const currentWindowCost = (activeMs / 3_600_000) * HOURLY_RATE_USD;
  const totalCost = session.accumulatedCost + currentWindowCost;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border ${
        asleep
          ? "border-muted bg-muted/20 text-muted-foreground"
          : "border-emerald-500/30 bg-emerald-500/5 text-foreground"
      } ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"}`}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {!asleep && (
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            asleep ? "bg-muted-foreground" : "bg-emerald-500"
          }`}
        />
      </span>

      <span className="font-medium">
        {asleep ? "Space asleep" : "Space active"}
      </span>

      <span className="flex items-center gap-1 tabular-nums">
        <DollarSign className="h-3 w-3" />
        {totalCost.toFixed(4)}
      </span>

      <span className="flex items-center gap-1 tabular-nums">
        <Clock className="h-3 w-3" />
        {formatDuration(activeMs)}
      </span>

      {!asleep && (
        <span className="flex items-center gap-1 tabular-nums" title="Time until auto-sleep">
          <Moon className="h-3 w-3" />
          {formatDuration(sleepIn)}
        </span>
      )}

      <span className="text-muted-foreground ml-auto">
        {session.generations} gen
        {session.generations === 1 ? "" : "s"}
      </span>

      {onReset && (
        <button
          type="button"
          onClick={() => {
            clearCostSession();
            setSession(null);
            onReset();
          }}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
          title="Reset this cost session"
        >
          reset
        </button>
      )}
    </div>
  );
}

/** Format a millisecond duration as HH:MM:SS (or MM:SS if < 1 hour). */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
