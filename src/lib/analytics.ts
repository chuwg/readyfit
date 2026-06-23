import type { BasketballSession, RunningSession } from '../types';
import {
  basketballCalories as basketballCaloriesFromLib,
  runningCalories as runningCaloriesFromLib,
} from './calories';

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function runningCalories(
  s: RunningSession,
  weightKg: number | null = null,
): number {
  return runningCaloriesFromLib(s, weightKg);
}

export function basketballCalories(
  s: BasketballSession,
  weightKg: number | null = null,
): number {
  return basketballCaloriesFromLib(s, weightKg);
}

export interface DayActivity {
  weekday: number;
  runningMinutes: number;
  basketballMinutes: number;
  runningKm: number;
  totalCalories: number;
}

export function buildWeekDays(
  weekStart: Date,
  running: RunningSession[],
  basketball: BasketballSession[],
  weightKg: number | null = null,
): DayActivity[] {
  const out: DayActivity[] = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = addDays(weekStart, i).getTime();
    const dayEnd = addDays(weekStart, i + 1).getTime();
    let runMin = 0;
    let runKm = 0;
    let runKcal = 0;
    for (const r of running) {
      if (r.startedAt >= dayStart && r.startedAt < dayEnd) {
        runMin += r.durationS / 60;
        runKm += r.distanceM / 1000;
        runKcal += runningCalories(r, weightKg);
      }
    }
    let bbMin = 0;
    let bbKcal = 0;
    for (const b of basketball) {
      if (b.startedAt >= dayStart && b.startedAt < dayEnd) {
        bbMin += b.durationS / 60;
        bbKcal += basketballCalories(b, weightKg);
      }
    }
    out.push({
      weekday: i,
      runningMinutes: Math.round(runMin),
      basketballMinutes: Math.round(bbMin),
      runningKm: runKm,
      totalCalories: runKcal + bbKcal,
    });
  }
  return out;
}

export interface LoadIndex {
  atl: number;
  ctl: number;
  balance: number;
  /** Acute:chronic workload ratio (ATL/CTL). ~0.8–1.3 is the "sweet spot". */
  acwr: number;
  warning: boolean;
}

export interface LoadOptions {
  /** Max heart rate (bpm). Falls back to 190 when unknown. */
  maxHr?: number | null;
  /** Resting heart rate (bpm). Falls back to 60 when unknown. */
  restingHr?: number | null;
}

const DEFAULT_MAX_HR = 190;
const DEFAULT_RESTING_HR = 60;

/** Banister TRIMP for one session (male coefficient). HR-aware load unit. */
function trimp(minutes: number, hrReserveRatio: number): number {
  if (minutes <= 0) return 0;
  return minutes * hrReserveRatio * 0.64 * Math.exp(1.92 * hrReserveRatio);
}

function hrReserveRatio(
  avgHr: number | null,
  maxHr: number,
  restingHr: number,
): number {
  // No HR data → assume a moderate session (60% of reserve).
  if (!avgHr || maxHr <= restingHr) return 0.6;
  const r = (avgHr - restingHr) / (maxHr - restingHr);
  return Math.max(0.3, Math.min(1, r));
}

/**
 * HR-based training load for a session (TRIMP units). Uses heart rate when
 * available; otherwise estimates from a moderate-intensity assumption so the
 * unit stays consistent across sessions with and without HR.
 */
export function sessionLoad(
  durationS: number,
  avgHr: number | null,
  opts: LoadOptions = {},
): number {
  const maxHr = opts.maxHr && opts.maxHr > 0 ? opts.maxHr : DEFAULT_MAX_HR;
  const restingHr =
    opts.restingHr && opts.restingHr > 0 ? opts.restingHr : DEFAULT_RESTING_HR;
  return trimp(durationS / 60, hrReserveRatio(avgHr, maxHr, restingHr));
}

export function computeLoadIndex(
  now: Date,
  running: RunningSession[],
  basketball: BasketballSession[],
  opts: LoadOptions = {},
): LoadIndex {
  const today = startOfDay(now).getTime();
  const day = 86_400_000;
  const sumIn = (days: number): number => {
    const cutoff = today - day * days;
    let total = 0;
    for (const r of running)
      if (r.startedAt >= cutoff) total += sessionLoad(r.durationS, r.avgHr, opts);
    for (const b of basketball)
      if (b.startedAt >= cutoff) total += sessionLoad(b.durationS, b.avgHr, opts);
    return total;
  };
  const atl = Math.round(sumIn(7) / 7);
  const ctl = Math.round(sumIn(28) / 28);
  const balance = atl - ctl;
  // Relative acute:chronic ratio — scale-independent, unlike a fixed kcal gap.
  const acwr = ctl > 0 ? atl / ctl : atl > 0 ? 2 : 0;
  return { atl, ctl, balance, acwr, warning: acwr >= 1.3 };
}

export interface MonthSummary {
  totalRunningKm: number;
  totalBasketballSessions: number;
  totalMinutes: number;
  best5kSeconds: number | null;
  best10kSeconds: number | null;
  totalCalories: number;
}

function bestPaceForDistance(
  sessions: RunningSession[],
  targetM: number,
  tolerance = 0.1,
): number | null {
  const min = targetM * (1 - tolerance);
  const max = targetM * (1 + tolerance);
  let best: number | null = null;
  for (const s of sessions) {
    if (s.distanceM < min || s.distanceM > max) continue;
    if (best === null || s.durationS < best) best = s.durationS;
  }
  return best;
}

export function buildMonthSummary(
  running: RunningSession[],
  basketball: BasketballSession[],
  weightKg: number | null = null,
): MonthSummary {
  const totalRunningKm = running.reduce((a, r) => a + r.distanceM / 1000, 0);
  const totalRunningMin = running.reduce((a, r) => a + r.durationS / 60, 0);
  const totalBasketMin = basketball.reduce((a, b) => a + b.durationS / 60, 0);
  const totalKcal =
    running.reduce((a, r) => a + runningCalories(r, weightKg), 0) +
    basketball.reduce((a, b) => a + basketballCalories(b, weightKg), 0);
  return {
    totalRunningKm,
    totalBasketballSessions: basketball.length,
    totalMinutes: Math.round(totalRunningMin + totalBasketMin),
    best5kSeconds: bestPaceForDistance(running, 5000),
    best10kSeconds: bestPaceForDistance(running, 10000),
    totalCalories: Math.round(totalKcal),
  };
}

export interface MonthHighlight {
  text: string;
  positive: boolean;
}

export function buildHighlights(
  current: MonthSummary,
  previous: MonthSummary,
  prevBest5k: number | null,
  prevBest10k: number | null,
): MonthHighlight[] {
  const out: MonthHighlight[] = [];
  const distDiff = current.totalRunningKm - previous.totalRunningKm;
  if (Math.abs(distDiff) >= 1) {
    out.push({
      text: `지난달 대비 러닝 거리 ${distDiff > 0 ? '+' : '−'}${Math.abs(distDiff).toFixed(1)}km`,
      positive: distDiff > 0,
    });
  }
  if (
    current.best5kSeconds !== null &&
    prevBest5k !== null &&
    current.best5kSeconds < prevBest5k
  ) {
    out.push({
      text: `5km 베스트 ${prevBest5k - current.best5kSeconds}초 단축`,
      positive: true,
    });
  }
  if (
    current.best10kSeconds !== null &&
    prevBest10k !== null &&
    current.best10kSeconds < prevBest10k
  ) {
    out.push({
      text: `10km 베스트 ${prevBest10k - current.best10kSeconds}초 단축`,
      positive: true,
    });
  }
  if (current.totalBasketballSessions > previous.totalBasketballSessions) {
    out.push({
      text: `농구 세션 ${current.totalBasketballSessions - previous.totalBasketballSessions}회 증가`,
      positive: true,
    });
  }
  return out;
}

export interface TrendPoint {
  ts: number;
  value: number;
}

export function trendPace(running: RunningSession[]): TrendPoint[] {
  return running
    .filter((r) => r.avgPaceSPerKm > 0)
    .map((r) => ({ ts: r.startedAt, value: r.avgPaceSPerKm }));
}

export function trendHr(
  running: RunningSession[],
  basketball: BasketballSession[],
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const r of running) {
    if (r.avgHr) points.push({ ts: r.startedAt, value: r.avgHr });
  }
  for (const b of basketball) {
    if (b.avgHr) points.push({ ts: b.startedAt, value: b.avgHr });
  }
  return points.sort((a, b) => a.ts - b.ts);
}

export function trendGct(running: RunningSession[]): TrendPoint[] {
  return running
    .filter((r) => r.gct !== null)
    .map((r) => ({ ts: r.startedAt, value: r.gct as number }));
}
