import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { ApiClient, type CameraSession } from "@meeeetup1120/core";
import { saveSession } from "./session-store";

interface ConnectScreenProps {
  apiBaseUrl: string;
  onConnected: (session: CameraSession) => void;
  onError?: (err: Error) => void;
  /** Pre-fill OTP from a deep link / QR code. */
  initialOtp?: string;
}

/**
 * OTP entry screen — mirrors the web app's /connect route.
 *
 * ```tsx
 * <ConnectScreen
 *   apiBaseUrl="https://api.example.com"
 *   onConnected={(session) => setSession(session)}
 * />
 * ```
 */
export function ConnectScreen({
  apiBaseUrl,
  onConnected,
  onError,
  initialOtp = "",
}: ConnectScreenProps) {
  const [otp,        setOtp]        = useState(initialOtp.toUpperCase());
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleConnect() {
    if (otp.length < 6) return;
    setConnecting(true);
    setError("");
    try {
      const client  = new ApiClient(apiBaseUrl, "");
      const session = await client.connect(otp);
      await saveSession(session);
      onConnected(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Connect Camera</Text>
        <Text style={styles.subtitle}>
          Enter the 6-character code shown in the Meeeetup admin panel.
        </Text>

        <TextInput
          style={styles.input}
          value={otp}
          onChangeText={(v) => setOtp(v.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor="#888"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, otp.length < 6 && styles.buttonDisabled]}
          onPress={() => void handleConnect()}
          disabled={otp.length < 6 || connecting}
        >
          {connecting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Connect</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card:           { width: "100%", maxWidth: 360, gap: 16 },
  title:          { fontSize: 22, fontWeight: "700", color: "#fff", textAlign: "center" },
  subtitle:       { fontSize: 14, color: "#aaa",  textAlign: "center" },
  input: {
    borderWidth: 1.5,
    borderColor: "#444",
    borderRadius: 10,
    padding: 14,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#fff",
    backgroundColor: "#111",
  },
  error:          { color: "#ef4444", fontSize: 13, textAlign: "center" },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: "#fff", fontWeight: "600", fontSize: 16 },
});
