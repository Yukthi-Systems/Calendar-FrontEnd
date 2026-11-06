import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { keptOnSignOut } from './deviceKeys';

// iOS/Android: AsyncStorage for the persisted session; per-launch flags and the
// post-logout marker live in memory (there's no URL or tab session to hang them on).
// Web counterpart: runtime.web.ts.

export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

// After a successful sign-out: everything in AsyncStorage (except what
// deviceKeys.ts lists), and all cookies.
export const clearDeviceData = async (): Promise<void> => {
  await Promise.allSettled([
    AsyncStorage.getAllKeys().then(keys =>
      Promise.all(
        keys
          .filter(key => !keptOnSignOut(key))
          .map(key => AsyncStorage.removeItem(key)),
      ),
    ),
    Platform.OS === 'ios'
      ? CookieManager.clearAllStores()
      : CookieManager.clearAll(),
  ]);
};

const flags = new Set<string>();

export const sessionFlag = {
  get: (key: string): boolean => flags.has(key),
  set: (key: string): void => {
    flags.add(key);
  },
  clear: (key: string): void => {
    flags.delete(key);
  },
};

let loggedOut = false;
let sessionEnded = false;

export const isAfterLogout = (): boolean => loggedOut;

export const markLoggedOut = (): void => {
  loggedOut = true;
};

// Signed out because the SSO session ended (hourly check) — not by the user.
export const markSessionEnded = (): void => {
  loggedOut = true;
  sessionEnded = true;
};

export const isSessionEnded = (): boolean => sessionEnded;

export const clearAuthReturnState = (): void => {
  loggedOut = false;
  sessionEnded = false;
};
