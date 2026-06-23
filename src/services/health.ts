import { Platform } from 'react-native';
import type { HealthSnapshot, WorkoutIntensity, WorkoutRecord } from '../types';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function classifyIntensity(durationMin: number, calories: number): WorkoutIntensity {
  if (durationMin <= 0) return 'rest';
  const kcalPerMin = calories / Math.max(durationMin, 1);
  if (durationMin < 20 || kcalPerMin < 5) return 'light';
  if (kcalPerMin >= 10 || durationMin >= 60) return 'hard';
  return 'moderate';
}

function mockSnapshot(): HealthSnapshot {
  const today = startOfDay(new Date());
  const mk = (daysAgo: number, durationMin: number, calories: number, type: string): WorkoutRecord => {
    const date = addDays(today, -daysAgo).toISOString().slice(0, 10);
    return {
      date,
      durationMin,
      calories,
      intensity: classifyIntensity(durationMin, calories),
      type,
    };
  };
  return {
    sleepMinutes: 6 * 60 + 42,
    deepSleepRatio: 0.18,
    remSleepRatio: 0.22,
    lightSleepRatio: 0.6,
    awakeMinutes: 18,
    hrvMs: 48,
    hrvAverageMs: 46,
    restingHrBpm: 58,
    restingHrAverageBpm: 60,
    respiratoryRateBrpm: 14.2,
    respiratoryRateAverageBrpm: 14.0,
    oxygenSaturationPct: 97,
    oxygenSaturationAveragePct: 97,
    recentWorkouts: [
      mk(1, 35, 280, '러닝'),
      mk(3, 60, 520, '농구'),
      mk(5, 25, 180, '조깅'),
      mk(6, 45, 380, '러닝'),
    ],
    isMock: true,
  };
}

async function loadHealthKit(): Promise<HealthSnapshot | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const mod = await import('@kingstinct/react-native-healthkit');
    const HealthKit: any = (mod as any).default ?? mod;

    const isAvailable = await HealthKit.isHealthDataAvailable?.();
    if (!isAvailable) return null;

    const readTypes = [
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'HKQuantityTypeIdentifierRestingHeartRate',
      'HKQuantityTypeIdentifierRespiratoryRate',
      'HKQuantityTypeIdentifierOxygenSaturation',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKWorkoutTypeIdentifier',
    ];
    const granted = await HealthKit.requestAuthorization?.(readTypes, []);
    if (!granted) return null;

    const now = new Date();
    const nightStart = addDays(startOfDay(now), -1);
    nightStart.setHours(20, 0, 0, 0);

    // HKCategoryValueSleepAnalysis: 0=inBed, 1=asleepUnspecified, 2=awake,
    // 3=asleepCore(light), 4=asleepDeep, 5=asleepREM
    let sleepMinutes = 0;
    let deepMinutes = 0;
    let remMinutes = 0;
    let lightMinutes = 0;
    let awakeMinutes = 0;
    try {
      const samples: any[] = (await HealthKit.queryCategorySamples?.(
        'HKCategoryTypeIdentifierSleepAnalysis',
        { from: nightStart, to: now },
      )) ?? [];
      for (const s of samples) {
        const durMin = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
        const v = s.value;
        if (v === 2) {
          awakeMinutes += durMin;
          continue;
        }
        // Count anything that isn't "awake"/"inBed" as asleep time.
        if (v === 1 || v === 3 || v === 4 || v === 5) sleepMinutes += durMin;
        if (v === 4) deepMinutes += durMin;
        else if (v === 5) remMinutes += durMin;
        else if (v === 3 || v === 1) lightMinutes += durMin;
      }
    } catch {}

    let hrvMs = 0;
    let hrvAverageMs = 0;
    try {
      const hrvSamples: any[] = (await HealthKit.queryQuantitySamples?.(
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        { from: addDays(now, -30), to: now, unit: 'ms' },
      )) ?? [];
      if (hrvSamples.length > 0) {
        const sorted = [...hrvSamples].sort(
          (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
        );
        hrvMs = sorted[0]?.quantity ?? 0;
        const sum = hrvSamples.reduce((acc, x) => acc + (x.quantity ?? 0), 0);
        hrvAverageMs = sum / hrvSamples.length;
      }
    } catch {}

    let restingHrBpm = 0;
    let restingHrAverageBpm = 0;
    try {
      const rhrSamples: any[] = (await HealthKit.queryQuantitySamples?.(
        'HKQuantityTypeIdentifierRestingHeartRate',
        { from: addDays(now, -30), to: now, unit: 'count/min' },
      )) ?? [];
      if (rhrSamples.length > 0) {
        const sorted = [...rhrSamples].sort(
          (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
        );
        restingHrBpm = sorted[0]?.quantity ?? 0;
        const sum = rhrSamples.reduce((acc, x) => acc + (x.quantity ?? 0), 0);
        restingHrAverageBpm = sum / rhrSamples.length;
      }
    } catch {}

    let respiratoryRateBrpm = 0;
    let respiratoryRateAverageBrpm = 0;
    try {
      // Overnight respiratory rate: prefer samples within the sleep window for
      // the "latest" value, fall back to most recent sample.
      const respSamples: any[] = (await HealthKit.queryQuantitySamples?.(
        'HKQuantityTypeIdentifierRespiratoryRate',
        { from: addDays(now, -30), to: now, unit: 'count/min' },
      )) ?? [];
      if (respSamples.length > 0) {
        const nightSamples = respSamples.filter(
          (x) => new Date(x.endDate).getTime() >= nightStart.getTime(),
        );
        const latestPool = nightSamples.length > 0 ? nightSamples : respSamples;
        const avgOf = (arr: any[]) =>
          arr.reduce((acc, x) => acc + (x.quantity ?? 0), 0) / arr.length;
        respiratoryRateBrpm = avgOf(latestPool);
        respiratoryRateAverageBrpm = avgOf(respSamples);
      }
    } catch {}

    let oxygenSaturationPct = 0;
    let oxygenSaturationAveragePct = 0;
    try {
      const o2Samples: any[] = (await HealthKit.queryQuantitySamples?.(
        'HKQuantityTypeIdentifierOxygenSaturation',
        { from: addDays(now, -30), to: now, unit: '%' },
      )) ?? [];
      if (o2Samples.length > 0) {
        // HealthKit stores SpO2 as a 0–1 fraction; normalize to percent.
        const toPct = (q: number) => (q <= 1 ? q * 100 : q);
        const sorted = [...o2Samples].sort(
          (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
        );
        oxygenSaturationPct = toPct(sorted[0]?.quantity ?? 0);
        const sum = o2Samples.reduce((acc, x) => acc + toPct(x.quantity ?? 0), 0);
        oxygenSaturationAveragePct = sum / o2Samples.length;
      }
    } catch {}

    let recentWorkouts: WorkoutRecord[] = [];
    try {
      const workouts: any[] = (await HealthKit.queryWorkouts?.({
        from: addDays(now, -7),
        to: now,
      })) ?? [];
      recentWorkouts = workouts.map((w) => {
        const durationMin = (w.duration ?? 0) / 60;
        const calories = w.totalEnergyBurned?.quantity ?? 0;
        return {
          date: new Date(w.startDate).toISOString().slice(0, 10),
          durationMin,
          calories,
          intensity: classifyIntensity(durationMin, calories),
          type: w.workoutActivityType ?? '운동',
        };
      });
    } catch {}

    if (sleepMinutes === 0 && hrvMs === 0 && restingHrBpm === 0) {
      return null;
    }

    return {
      sleepMinutes,
      deepSleepRatio: sleepMinutes > 0 ? deepMinutes / sleepMinutes : 0,
      remSleepRatio: sleepMinutes > 0 ? remMinutes / sleepMinutes : 0,
      lightSleepRatio: sleepMinutes > 0 ? lightMinutes / sleepMinutes : 0,
      awakeMinutes,
      hrvMs,
      hrvAverageMs: hrvAverageMs || hrvMs,
      restingHrBpm,
      restingHrAverageBpm: restingHrAverageBpm || restingHrBpm,
      respiratoryRateBrpm,
      respiratoryRateAverageBrpm: respiratoryRateAverageBrpm || respiratoryRateBrpm,
      oxygenSaturationPct,
      oxygenSaturationAveragePct: oxygenSaturationAveragePct || oxygenSaturationPct,
      recentWorkouts,
      isMock: false,
    };
  } catch {
    return null;
  }
}

export async function fetchHealthSnapshot(): Promise<HealthSnapshot> {
  const real = await loadHealthKit();
  return real ?? mockSnapshot();
}
