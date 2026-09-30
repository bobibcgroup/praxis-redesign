/**
 * Face capture: camera behind a button, upload, or a sample. The live preview
 * is drawn into the print by the screen that owns the video ref.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { STAND_IN_PORTRAIT } from "../../shared/catalog";
import { captureFrame, fileToDataUrl, shrinkImage } from "../lib/image";
import { Caption, ChoiceList, QuietButton, TextButton } from "./controls";

export interface CaptureResult {
  image: string;
  source: "own" | "sample";
}

interface CaptureProps {
  videoRef: RefObject<HTMLVideoElement>;
  onStream: (stream: MediaStream | null) => void;
  onCapture: (result: CaptureResult) => void;
}

const CAMERA_ERROR = "The camera is not available here. Upload a photo or use a sample instead.";
const WAYS = [
  { id: "camera", label: "Use the camera", hint: "Face the light" },
  { id: "upload", label: "Upload a photo" },
  { id: "sample", label: "Use a sample" },
] as const;

export function Capture({ videoRef, onStream, onCapture }: CaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  useEffect(() => {
    onStream(stream);
  }, [stream, onStream]);

  useEffect(() => stop, [stop]);

  const openCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(CAMERA_ERROR);
      return;
    }
    try {
      setBusy(true);
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 960 }, audio: false }));
    } catch {
      setError(CAMERA_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = () => {
    const image = videoRef.current ? captureFrame(videoRef.current) : null;
    if (!image) {
      setError("The camera has not started yet. Give it a second and try again.");
      return;
    }
    stop();
    onCapture({ image, source: "own" });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image. Choose a photo.");
      return;
    }
    try {
      setBusy(true);
      onCapture({ image: await shrinkImage(await fileToDataUrl(file)), source: "own" });
    } catch {
      setError("The photo could not be read. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: (typeof WAYS)[number]["id"]) => {
    if (busy) return;
    if (id === "camera") void openCamera();
    if (id === "upload") fileRef.current?.click();
    if (id === "sample") onCapture({ image: STAND_IN_PORTRAIT, source: "sample" });
  };

  if (stream) {
    return (
      <div className="flex flex-col gap-4">
        <Caption>Face the light. The preview is in the frame.</Caption>
        <div className="flex gap-2">
          <QuietButton onClick={takePhoto}>Take the photo</QuietButton>
          <TextButton onClick={stop}>Cancel</TextButton>
        </div>
        {error && <p className="text-[15px] text-[var(--error)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ChoiceList label="How to add your face" options={WAYS} value={null} onChange={choose} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload a photo"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-[15px] leading-snug text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
