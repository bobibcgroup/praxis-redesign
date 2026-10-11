/** Small image helpers for capture and upload. Keeps data URLs small enough for session storage. */

const MAX_EDGE = 900;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

export function shrinkImage(dataUrl: string, maxEdge = MAX_EDGE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("The image could not be processed."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("The image could not be read."));
    img.src = dataUrl;
  });
}

/** Grabs the current video frame as a 3:4 portrait, mirrored to match the preview. */
export function captureFrame(video: HTMLVideoElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const targetRatio = 3 / 4;
  let cw = vw;
  let ch = vh;
  if (vw / vh > targetRatio) cw = Math.round(vh * targetRatio);
  else ch = Math.round(vw / targetRatio);
  const sx = Math.round((vw - cw) / 2);
  const sy = Math.round((vh - ch) / 2);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, MAX_EDGE / ch);
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Size and mean brightness (0 to 255), for the quality checks in src/core/images.ts. */
export function imageStats(dataUrl: string): Promise<{ width: number; height: number; meanLuma: number | null }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ width, height, meanLuma: null });
        ctx.drawImage(img, 0, 0, 48, 48);
        const data = ctx.getImageData(0, 0, 48, 48).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        resolve({ width, height, meanLuma: sum / (data.length / 4) });
      } catch {
        resolve({ width, height, meanLuma: null });
      }
    };
    img.onerror = () => resolve({ width: 0, height: 0, meanLuma: null });
    img.src = dataUrl;
  });
}
