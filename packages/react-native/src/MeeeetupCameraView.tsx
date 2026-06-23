import React, { useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePassiveCamera, type UsePassiveCameraRNOptions } from "./usePassiveCamera";
import type { SelectedFace } from "@meeeetup1120/core";

// Vision Camera imports — peerDependency, typed loosely so this file compiles
// without it being installed in the SDK workspace itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Camera = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CameraDevice = any;

interface MeeeetupCameraViewProps extends UsePassiveCameraRNOptions {
  /** Vision Camera device object from `useCameraDevice()`. */
  device: CameraDevice;
  /** Show a live face-count badge. Default: true */
  showCounter?: boolean;
  /** Render extra UI on top of the camera preview. */
  overlay?: (faces: SelectedFace[], trackedCount: number) => React.ReactNode;
  style?: import("react-native").ViewStyle;
}

/**
 * All-in-one React Native camera component.
 *
 * ```tsx
 * import { useCameraDevice } from "react-native-vision-camera";
 * import { MeeeetupCameraView } from "@meeeetup-cam/react-native";
 *
 * function PassiveCamera({ session }) {
 *   const device = useCameraDevice("back");
 *   return (
 *     <MeeeetupCameraView
 *       device={device}
 *       apiBaseUrl="https://api.example.com"
 *       token={session.token}
 *       sessionType="passive"
 *       onSessionExpired={() => navigate("/connect")}
 *     />
 *   );
 * }
 * ```
 */
export function MeeeetupCameraView({
  device,
  showCounter = true,
  overlay,
  style,
  ...hookOpts
}: MeeeetupCameraViewProps) {
  const cameraRef = useRef<Camera>(null);

  const { ready, error, trackedCount, selectedFaces, onSnapshot } =
    usePassiveCamera(hookOpts);

  if (!device) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.message}>No camera device found</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  // Lazily resolve Vision Camera so this file compiles without it installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { Camera } = require("react-native-vision-camera") as any;

  return (
    <View style={[styles.container, style]}>
      <Camera
        ref={cameraRef}
        device={device}
        isActive={ready}
        photo
        style={StyleSheet.absoluteFill}
        onCapture={(file: { path: string; width: number; height: number }) => {
          void onSnapshot(file);
        }}
      />

      {!ready && (
        <View style={styles.loading}>
          <Text style={styles.message}>Connecting…</Text>
        </View>
      )}

      {ready && showCounter && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {trackedCount} {trackedCount === 1 ? "face" : "faces"}
          </Text>
        </View>
      )}

      {overlay?.(selectedFaces, trackedCount)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  message: { color: "#aaa", fontSize: 14 },
  error:   { color: "red",  fontSize: 14 },
  badge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 13 },
});
