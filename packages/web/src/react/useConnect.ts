import { useState } from "react";
import { ApiClient, sessionFromToken, type CameraSession } from "@meeeetup-cam/core";

/**
 * Hook to connect a camera client via OTP.
 *
 * ```tsx
 * const { connect, session, connecting, error } = useConnect({ apiBaseUrl });
 * await connect("ABC123");
 * ```
 */
export function useConnect(options: { apiBaseUrl: string }) {
  const [session,    setSession]    = useState<CameraSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function connect(otp: string): Promise<CameraSession> {
    setConnecting(true);
    setError(null);
    try {
      const client  = new ApiClient(options.apiBaseUrl, "");
      const session = await client.connect(otp);
      setSession(session);
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      throw err;
    } finally {
      setConnecting(false);
    }
  }

  return { connect, session, connecting, error };
}
