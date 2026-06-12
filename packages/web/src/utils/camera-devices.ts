/**
 * Labels matching known virtual / software cameras.
 * These should be excluded when the caller wants a physical camera.
 */
const VIRTUAL_CAM_RE =
  /obs|virtual\s*cam|manycam|snap\s*cam|ecamm|droidcam|ivcam\b|camo\b|mmhmm|veeer|xsplit/i;

export function isVirtualCamera(label: string): boolean {
  return VIRTUAL_CAM_RE.test(label);
}

/**
 * Enumerate video-input devices and return the deviceId of the best physical
 * camera for the requested facing mode.
 *
 * Strategy:
 *  1. Filter out known virtual/software cameras by label.
 *  2. For "environment": prefer a device whose label contains back/rear hints.
 *  3. For "user": return the first physical device.
 *
 * Returns `undefined` if no suitable physical device is found (caller should
 * fall back to a raw `facingMode` constraint).
 */
export async function findPhysicalCameraId(
  facingMode: "user" | "environment",
): Promise<string | undefined> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const physical = all.filter(
      (d) => d.kind === "videoinput" && !isVirtualCamera(d.label),
    );

    if (facingMode === "environment") {
      // On mobile the label often contains "back", "rear", "environment" etc.
      const back = physical.find((d) =>
        /back|rear|environment|wide|ultra/i.test(d.label),
      );
      return back?.deviceId;
    }

    // "user" — just take the first physical camera
    return physical[0]?.deviceId;
  } catch {
    return undefined;
  }
}
