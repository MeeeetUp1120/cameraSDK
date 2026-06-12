import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface DevicePickerProps {
  className?: string;
}

/** Camera device dropdown. Renders nothing if only one device is available. */
export function DevicePicker({ className }: DevicePickerProps) {
  const cam = useMeeeetUpCam();

  if (cam.devices.length === 0) return null;

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600 }}>Camera source</span>
      <select
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc" }}
        value={cam.currentDeviceId ?? ""}
        onChange={(e) => cam.setDeviceId(e.target.value || undefined)}
      >
        <option value="">Default camera</option>
        {cam.devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
