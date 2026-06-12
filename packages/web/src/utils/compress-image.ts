const MAX_ITERATIONS = 8;
const QUALITY_STEP = 0.05;
const MIN_QUALITY = 0.4;

export async function compressImage(
  source: HTMLVideoElement | HTMLCanvasElement,
  opts: {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    targetSize: number;
    maxBytes: number;
    initialQuality?: number;
    isFlipped?: boolean;
  }
): Promise<Blob> {
  const { sx, sy, sw, sh, targetSize, maxBytes, initialQuality = 0.75, isFlipped = false } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, targetSize, targetSize);
  if (isFlipped) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-targetSize, 0);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
    ctx.restore();
  } else {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
  }
  let quality = initialQuality;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
    );
    if (blob.size <= maxBytes || quality <= MIN_QUALITY) return blob;
    quality -= QUALITY_STEP;
  }
  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", MIN_QUALITY));
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
