import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { listingsAround } from '../lib/listings';
import { decide } from '../lib/matcher';
import { notifyListing, notifyParkedSummary } from '../lib/notify';
import { appendDriveLog, getAlertMode, getDriveState, setDriveState } from '../lib/storage';
import type { Fix } from '../lib/types';

export const DRIVE_TASK = 'curbside-drive';

/** Handles one location fix. Exported separately so it can run from the foreground too. */
export async function handleFix(loc: Location.LocationObject) {
  const fix: Fix = {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    heading: loc.coords.heading,
    speed: loc.coords.speed,
    timestamp: loc.timestamp,
  };
  const listings = await listingsAround(fix.lat, fix.lng, fix.timestamp);
  const { alert, logged, parkedSummary, state } = decide(fix, listings, getDriveState(), getAlertMode());
  setDriveState(state);
  appendDriveLog(logged, fix.timestamp);
  if (alert) await notifyListing(alert);
  if (parkedSummary) await notifyParkedSummary(parkedSummary);
}

// Must be defined at module top level so it exists when the OS wakes the app in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(DRIVE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn(error.message);
    return;
  }
  for (const loc of data?.locations ?? []) {
    await handleFix(loc);
  }
});

export type StartResult = 'started' | 'no-foreground-permission' | 'no-background-permission';

export async function startDriveMode(): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'no-foreground-permission';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return 'no-background-permission';

  await Location.startLocationUpdatesAsync(DRIVE_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 15,
    timeInterval: 3000,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Curbside Homes: Drive mode on',
      notificationBody: 'Watching for homes for sale on your route.',
      killServiceOnDestroy: false,
    },
  });
  return 'started';
}

export async function stopDriveMode() {
  if (await Location.hasStartedLocationUpdatesAsync(DRIVE_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVE_TASK);
  }
}

export const isDriveModeOn = () => Location.hasStartedLocationUpdatesAsync(DRIVE_TASK);
