import { useRef, useEffect, useCallback, useState } from "react";
import { Camera, AlertCircle, RefreshCw, Loader2, SwitchCamera, FlipHorizontal2 } from "lucide-react";
import { useInteractiveCamera } from "./useInteractiveCamera";
import { CircleProgress } from "./CircleProgress";

export interface InteractiveCameraViewProps {
  /** Called with the face-crop base64 JPEG after a successful capture. */
  onCapture: (dataUrl: string) => void;
  /** How long the face must stay aligned before auto-capture fires (ms). Default: 2000 */
  alignmentCaptureDelayMs?: number;
  /** Show dev face thumbnails for quick testing in development. */
  devFaces?: string[];
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function InteractiveCameraView({ onCapture, alignmentCaptureDelayMs = 2000, devFaces = [] }: InteractiveCameraViewProps) {
  const [devLoading, setDevLoading] = useState<number | null>(null);
  const handleCapture = useCallback((faceImage: string) => {
    if (faceImage) onCapture(faceImage);
  }, [onCapture]);

  const {
    videoRef, canvasRef, videoStream, error, isLoading, isCapturing, isSwitchingCamera,
    currentFacingMode, isFlipped, captureImage, toggleCamera, toggleFlip,
    isFaceAligned, captureProgress, alignmentCountdown, faceBoundingBox,
  } = useInteractiveCamera({
    alignmentBoxSizeRatio: 1,
    onCapture: handleCapture,
    autoCapture: true,
    alignmentCaptureDelayMs,
  });

  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoStream && backgroundVideoRef.current) {
      backgroundVideoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const getDisplayFaceRect = useCallback(() => {
    if (!faceBoundingBox || !videoRef.current || !viewportContainerRef.current) return null;
    const video = videoRef.current;
    const container = viewportContainerRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) return null;
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;
    let scale: number, offsetX = 0, offsetY = 0;
    if (videoAspect > containerAspect) { scale = containerHeight / videoHeight; offsetX = (containerWidth - videoWidth * scale) / 2; }
    else { scale = containerWidth / videoWidth; offsetY = (containerHeight - videoHeight * scale) / 2; }
    const faceCenterX = faceBoundingBox.originX + faceBoundingBox.width / 2;
    const faceCenterY = faceBoundingBox.originY + faceBoundingBox.height * 0.35;
    const paddedWidth = faceBoundingBox.width * 1.1;
    const paddedHeight = faceBoundingBox.height * 1.3;
    const rectX = faceCenterX - paddedWidth / 2;
    const rectY = faceCenterY - paddedHeight / 2;
    let displayX = rectX * scale + offsetX;
    const displayY = rectY * scale + offsetY;
    const displayWidth = paddedWidth * scale;
    const displayHeight = paddedHeight * scale;
    if (isFlipped) { displayX = containerWidth - displayX - displayWidth; }
    return { x: displayX, y: displayY, width: displayWidth, height: displayHeight };
  }, [faceBoundingBox, isFlipped, videoRef]);

  const displayFaceRect = getDisplayFaceRect();

  const statusText = error ? "Camera Error"
    : isLoading || isSwitchingCamera ? "Loading..."
    : isFaceAligned ? "Face detected"
    : "Position your face in the circle";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-lg shadow-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-2xl overflow-hidden h-[70dvh] max-h-[600px]">
        {/* Dev face processing overlay */}
        {devLoading !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/20 rounded-full animate-pulse" />
                <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-white p-3" />
              </div>
              <p className="text-white/80 text-sm font-medium">Scanning face...</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {(isLoading || isSwitchingCamera) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/80 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/20 rounded-full animate-pulse" />
                <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-white p-3" />
              </div>
              <p className="text-white/80 text-sm font-medium">{isSwitchingCamera ? "Switching camera..." : "Initializing camera..."}</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="p-8 rounded-3xl bg-red-900/80 backdrop-blur-xl border border-red-500/30">
              <AlertCircle className="w-12 h-12 mb-4 text-red-400 mx-auto" />
              <h3 className="text-lg font-semibold text-red-400 mb-2">Camera Access Required</h3>
              <p className="text-red-300/80 text-sm mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="bg-red-500/50 hover:bg-red-600/70 text-white border border-red-400/50 rounded-xl px-6 py-3 font-medium flex items-center gap-2 mx-auto">
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Background blurred video */}
            <video ref={backgroundVideoRef} autoPlay playsInline muted
              className={`absolute inset-0 w-full h-full object-cover rounded-2xl ${isFlipped ? "scale-x-[-1]" : ""}`}
              controls={false}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-xl" />

            {/* Circular viewport */}
            <div ref={viewportContainerRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full w-[min(320px,75vw)] aspect-square">
              <video ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover rounded-full transition-all duration-500 ${isSwitchingCamera ? "opacity-40 scale-105" : "opacity-100 scale-100"} ${isFlipped ? "scale-x-[-1]" : ""}`}
                controls={false}
              />
              {displayFaceRect && (
                <div style={{ position: "absolute", left: displayFaceRect.x, top: displayFaceRect.y, width: displayFaceRect.width, height: displayFaceRect.height, border: "3px solid white", borderRadius: "8px", pointerEvents: "none", opacity: 0.8 }} />
              )}
            </div>

            {/* Top controls */}
            <div className="absolute top-4 right-4 flex gap-2 z-30">
              <button onClick={toggleFlip} disabled={isLoading || isSwitchingCamera} className="w-10 h-10 rounded-2xl bg-card/20 backdrop-blur-md border border-white/30 hover:bg-card/30 disabled:opacity-50 flex items-center justify-center">
                <FlipHorizontal2 className="w-4 h-4 text-white" />
              </button>
              <button onClick={toggleCamera} disabled={isSwitchingCamera || isLoading} className="w-10 h-10 rounded-2xl bg-card/20 backdrop-blur-md border border-white/30 hover:bg-card/30 disabled:opacity-50 flex items-center justify-center">
                <SwitchCamera className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Camera mode badge */}
            <div className="absolute top-4 left-4 z-30">
              <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/30">
                <span className="text-white/90 font-medium text-xs capitalize">{currentFacingMode === "user" ? "Front" : "Back"} Camera</span>
              </div>
            </div>

            {/* Manual capture button */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
              <button onClick={() => captureImage()} disabled={isCapturing || isLoading || isSwitchingCamera}
                className="w-10 h-10 rounded-full border border-white/15 bg-card/5 hover:bg-card/10 disabled:opacity-50 relative flex items-center justify-center">
                <div className="absolute inset-1.5 rounded-full bg-card/10 flex items-center justify-center">
                  {isCapturing ? <Loader2 className="w-4 h-4 text-white/90 animate-spin" /> : <Camera className="w-4 h-4 text-white/40" />}
                </div>
                {isCapturing && <div className="absolute inset-0 rounded-full bg-card/60 animate-pulse" />}
              </button>
              <p className="mt-1 text-[0.6rem] text-white/30 tracking-wide">Tap to capture</p>
            </div>

            {/* Alignment ring + progress + countdown */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(320px,75vw)] aspect-square">
                <div className={`absolute inset-0 z-[1] rounded-full border-[3px] transition-all duration-300 ${isFaceAligned ? "border-white/80 shadow-[0_0_16px_rgba(255,255,255,0.35)]" : "border-white/55 animate-pulse"}`} />
                {isFaceAligned && (
                  <div className="absolute inset-0 z-10">
                    <CircleProgress progress={captureProgress} size={320} className="w-full h-full" color="rgba(255,255,255,0.75)" strokeWidth={10} />
                  </div>
                )}
                {alignmentCountdown !== null && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <div className="text-white/80 font-bold drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-pulse" style={{ fontSize: "100px", lineHeight: "1" }}>
                      {alignmentCountdown}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status text */}
      <p className={`text-sm font-medium ${isFaceAligned ? "text-success" : "text-muted-foreground"}`}>
        {statusText}
      </p>

      {devFaces.length > 0 && (
        <div className="w-full max-w-lg">
          <p className="text-xs text-muted-foreground mb-2 text-center">Dev — click a face to capture</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {devFaces.map((src, i) => (
              <button
                key={i}
                disabled={devLoading !== null}
                onClick={async () => {
                  setDevLoading(i);
                  try { onCapture(await imageUrlToDataUrl(src)); }
                  finally { setDevLoading(null); }
                }}
                className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors disabled:opacity-60"
              >
                <img src={src} alt={`face ${i + 1}`} className="w-full h-full object-cover" />
                {devLoading === i && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
