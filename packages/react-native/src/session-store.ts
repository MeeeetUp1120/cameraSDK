/**
 * AsyncStorage-backed session persistence for React Native.
 * Mirrors the web SDK's localStorage session helpers.
 */
import { isTokenExpired, sessionFromToken } from "@meeeetup-cam/core";
import type { CameraSession } from "@meeeetup-cam/core";

const KEY = "@meeeetup_cam/session";

// Lazily require AsyncStorage so the package builds without it being installed
// (it's a peerDependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storage(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-async-storage/async-storage").default;
}

export async function loadSession(): Promise<CameraSession | null> {
  try {
    const raw = await storage().getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CameraSession;
    if (isTokenExpired(session.token)) { await clearSession(); return null; }
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(session: CameraSession): Promise<void> {
  await storage().setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await storage().removeItem(KEY);
}
