import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { computeReadiness, recommendWorkout } from '../lib/readiness';
import {
  loadMorningReportConfig,
  loadShiftConfig,
  loadUserProfile,
  saveDailyScore,
  upsertSleepRecord,
} from './db';
import { fetchHealthSnapshot } from './health';
import {
  rescheduleMorningReports,
  type MorningReportSnapshot,
} from './notifications';
import { defaultShiftConfig, shiftDayForDate } from './shift';
import { fetchWeather } from './weather';

export const MORNING_REFRESH_TASK = 'fitlog-morning-refresh';

/**
 * Background refresh: re-pulls health data, recomputes readiness, persists the
 * daily score, and reschedules upcoming morning-report pushes with fresh
 * numbers. Without this, the push body reuses whatever snapshot existed when
 * the app was last opened, so the score could be a day stale.
 */
async function runMorningRefresh(): Promise<BackgroundFetch.BackgroundFetchResult> {
  try {
    const now = new Date();
    const [snap, cfg, profile, report] = await Promise.all([
      fetchHealthSnapshot(),
      loadShiftConfig(),
      loadUserProfile(),
      loadMorningReportConfig(),
    ]);
    const effectiveCfg = cfg ?? defaultShiftConfig();
    const shiftDay = shiftDayForDate(effectiveCfg, now);
    const readiness = computeReadiness(snap, shiftDay);

    await saveDailyScore(readiness).catch(() => {});
    if (snap.sleepMinutes > 0) {
      await upsertSleepRecord({
        sleepMinutes: snap.sleepMinutes,
        deepSleepRatio: snap.deepSleepRatio || null,
      }).catch(() => {});
    }

    let weatherSummary: string | null = null;
    try {
      const w = await fetchWeather();
      if (w) weatherSummary = `${w.tempC}°C ${w.description}`;
    } catch {}

    const snapshot: MorningReportSnapshot = {
      score: readiness.total,
      recommendationTitle: recommendWorkout(
        readiness,
        profile.runningGoal5kSeconds,
      ).title,
      weatherSummary,
    };

    await rescheduleMorningReports(report, effectiveCfg, snapshot);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

if (!TaskManager.isTaskDefined(MORNING_REFRESH_TASK)) {
  TaskManager.defineTask(MORNING_REFRESH_TASK, runMorningRefresh);
}

/** Register the periodic background refresh (idempotent, best-effort). */
export async function registerMorningRefresh(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    const already = await TaskManager.isTaskRegisteredAsync(MORNING_REFRESH_TASK);
    if (already) return;
    await BackgroundFetch.registerTaskAsync(MORNING_REFRESH_TASK, {
      minimumInterval: 3 * 60 * 60, // 3h — iOS treats this as a hint
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Background fetch unsupported (e.g., simulator/web) — ignore.
  }
}
