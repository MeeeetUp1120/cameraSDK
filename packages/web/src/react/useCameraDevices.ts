import { useEffect, useState } from "react";

/**
 * Enumerate available camera devices.
 * Temporarily requests camera permission so Firefox exposes virtual cameras (OBS etc).
 */
export function useCameraDevices(): {
  devices: MediaDeviceInfo[];
  permissionGranted: boolean;
} {
  const [devices,           setDevices]           = useState<MediaDeviceInfo[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const enumerate = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === "videoinput")))
        .catch(() => {});

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setPermissionGranted(true);
        return enumerate();
      })
      .catch(() => enumerate());

    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => navigator.mediaDevices.removeEventListener("devicechange", enumerate);
  }, []);

  return { devices, permissionGranted };
}
