import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BG_LOCATION_TASK = 'fitlog-bg-location';

export interface TrackPoint {
  ts: number;
  lat: number;
  lon: number;
}

interface Store {
  buffer: TrackPoint[];
  running: boolean;
  hasBackground: boolean;
  paused: boolean;
}

const store: Store = {
  buffer: [],
  running: false,
  hasBackground: false,
  paused: false,
};

if (!TaskManager.isTaskDefined(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, ({ data, error }) => {
    if (error) return;
    if (!data) return;
    if (store.paused) return;
    const locations = (data as { locations?: Location.LocationObject[] })
      .locations;
    if (!locations) return;
    for (const loc of locations) {
      store.buffer.push({
        ts: loc.timestamp ?? Date.now(),
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
      });
    }
  });
}

export function setTrackingPaused(paused: boolean): void {
  store.paused = paused;
}

export function isTrackingPaused(): boolean {
  return store.paused;
}

export interface StartTrackingResult {
  granted: boolean;
  background: boolean;
}

export async function startLiveTracking(): Promise<StartTrackingResult> {
  store.buffer = [];
  store.running = false;
  store.hasBackground = false;
  store.paused = false;

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { granted: false, background: false };
  }

  let background = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    background = bg.status === 'granted';
  } catch {
    background = false;
  }

  try {
    const isReg = await TaskManager.isTaskRegisteredAsync(BG_LOCATION_TASK);
    if (isReg) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {});
    }
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 1000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: background
        ? {
            notificationTitle: '레디핏 러닝 중',
            notificationBody: 'GPS로 거리와 페이스를 측정하고 있어요',
          }
        : undefined,
    });
    store.running = true;
    store.hasBackground = background;
  } catch {
    return { granted: false, background: false };
  }

  return { granted: true, background };
}

export function drainPoints(): TrackPoint[] {
  if (store.buffer.length === 0) return [];
  const out = store.buffer;
  store.buffer = [];
  return out;
}

export async function stopLiveTracking(): Promise<void> {
  store.running = false;
  store.hasBackground = false;
  try {
    const isReg = await TaskManager.isTaskRegisteredAsync(BG_LOCATION_TASK);
    if (isReg) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    }
  } catch {}
  store.buffer = [];
}

export function isTracking(): boolean {
  return store.running;
}

export function hasBackgroundPermission(): boolean {
  return store.hasBackground;
}
