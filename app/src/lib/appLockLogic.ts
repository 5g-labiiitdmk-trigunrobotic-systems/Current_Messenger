/**
 * Pure rules for the biometric app lock (see components/AppLockGate.tsx),
 * kept separate so they can be tested without a device.
 */

/** Whether the app may show its content right now, before any prompt:
 * never before the saved settings have loaded (the old code treated "not
 * loaded yet" as "lock is off" and started unlocked), and otherwise only if
 * the lock is switched off. */
export function startsUnlocked(settingsLoaded: boolean, lockEnabled: boolean): boolean {
  return settingsLoaded && !lockEnabled;
}

/** Re-lock whenever the app goes to the background (switching apps, home
 * screen), but not for the background/inactive blip that the system
 * biometric prompt itself can cause while we are authenticating. */
export function shouldLockOnAppState(next: string, lockEnabled: boolean, authenticating: boolean): boolean {
  return lockEnabled && !authenticating && next === 'background';
}
