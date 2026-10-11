/**
 * Face capture: camera behind a button, upload, or a sample. Before the camera or a file, the
 * customer reads what happens to the photo and agrees (PhotoConsent); a sample needs nothing. A photo
 * that is too small, too dark or too bright is refused with the reason and a way on. The live preview
 * is drawn into the print by the screen that owns the video ref.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { consentFor } from "../../core/images";
import { STAND_IN_PORTRAIT } from "../../shared/catalog";
import { captureFrame, fileToDataUrl, shrinkImage } from "../lib/image";
import { Caption, ChoiceList, QuietButton, TextButton } from "./controls";
import { PhotoConsent, problemText, rejectFile, rejectImage } from "./PhotoConsent";

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
  { id: "camera", label: "Take a photo", hint: "Best near a window" },
  { id: "upload", label: "Upload a photo" },
  { id: "sample", label: "Use a sample" },
] as const;

export function Capture({ videoRef, onStream, onCapture }: CaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The way chosen while consent is asked for. */
  const [asking, setAsking] = useState<"camera" | "upload" | null>(null);
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
      setError("The camera isn’t ready yet. Give it a second and try again.");
      return;
    }
    stop();
    void accept(image);
  };

  /** A photo is used only if it passes the checks; otherwise the customer reads why. */
  const accept = async (image: string) => {
    const problem = await rejectImage(image, "face_colour");
    if (problem) {
      setError(problemText(problem));
      return;
    }
    onCapture({ image, source: "own" });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const refused = rejectFile(file, "face_colour");
    if (refused) {
      setError(problemText(refused));
      return;
    }
    try {
      setBusy(true);
      const original = await fileToDataUrl(file);
      // The size check reads the original; the copy kept in the tab is made smaller.
      const problem = await rejectImage(original, "face_colour");
      if (problem) {
        setError(problemText(problem));
        return;
      }
      onCapture({ image: await shrinkImage(original), source: "own" });
    } catch {
      setError("I couldn’t read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: (typeof WAYS)[number]["id"]) => {
    if (busy) return;
    setError(null);
    if ((id === "camera" || id === "upload") && !consentFor("face_colour")) {
      setAsking(id);
      return;
    }
    if (id === "camera") void openCamera();
    if (id === "upload") fileRef.current?.click();
    if (id === "sample") onCapture({ image: STAND_IN_PORTRAIT, source: "sample" });
  };

  /* One file input at the same place in every state, so the picker opened on consent still reports
     back after the notice closes. */
  const input = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      className="sr-only"
      aria-label="Upload a photo"
      tabIndex={-1}
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (stream) {
    return (
      <>
      {input}
      <div className="flex flex-col gap-4">
        <Caption>Face natural light and look straight at the camera.</Caption>
        <div className="flex gap-2">
          <QuietButton onClick={takePhoto}>Take photo</QuietButton>
          <TextButton onClick={stop}>Cancel</TextButton>
        </div>
        {error && <p className="text-[15px] text-[var(--error)]">{error}</p>}
      </div>
      </>
    );
  }

  if (asking) {
    return (
      <>
      {input}
      <PhotoConsent
        category="face_colour"
        declineLabel="Use a sample instead"
        onAgree={() => {
          const way = asking;
          setAsking(null);
          if (way === "camera") void openCamera();
          else fileRef.current?.click();
        }}
        onDecline={() => {
          setAsking(null);
          onCapture({ image: STAND_IN_PORTRAIT, source: "sample" });
        }}
      />
      </>
    );
  }

  return (
    <>
    {input}
    <div className="flex flex-col gap-4">
      <ChoiceList label="How to add your photo" options={WAYS} value={null} onChange={choose} />
      {error && (
        <p role="alert" className="text-[15px] leading-snug text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
    </>
  );
}
