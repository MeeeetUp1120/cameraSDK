import type { CameraSession } from "./types";

/** Decode a JWT payload without verification (client-side only). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const payloadB64 = token.split(".")[1] ?? "";
  const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
  const padded  = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    if (typeof payload.exp !== "number") return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export function sessionFromToken(token: string): CameraSession {
  const p = decodeJwtPayload(token) as {
    projectId: string;
    cameraId: string;
    cameraName: string;
    type: "interactive" | "passive";
  };
  return { token, projectId: p.projectId, cameraId: p.cameraId, cameraName: p.cameraName, type: p.type };
}
