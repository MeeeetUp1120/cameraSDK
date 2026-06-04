import { sessionFromToken } from "./session";
import type { CameraSession, CaptureResponse } from "./types";

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private token: string,
  ) {}

  /** Exchange an OTP for a JWT session. */
  async connect(otp: string): Promise<CameraSession> {
    const res = await fetch(`${this.baseUrl}/camera/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp: otp.toUpperCase() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? `Connect failed: ${res.status}`);
    }
    const { token } = await res.json() as { token: string };
    this.token = token;
    return sessionFromToken(token);
  }

  /** Send a batch of face images. Returns matched persons. */
  async capture(images: string[]): Promise<CaptureResponse> {
    const res = await fetch(`${this.baseUrl}/camera/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) throw new Error(`Capture failed: ${res.status}`);
    return res.json() as Promise<CaptureResponse>;
  }

  /** Heartbeat — validate the camera session is still active. */
  async heartbeat(): Promise<{ id: string; name: string; type: string }> {
    const res = await fetch(`${this.baseUrl}/camera/me`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw Object.assign(new Error("Heartbeat failed"), { status: res.status });
    return res.json() as Promise<{ id: string; name: string; type: string }>;
  }
}
