/**
 * Photo capture: camera behind a button, upload, or (for Style DNA) a sample. Before the camera or a
 * file, the customer reads what happens to the photo and agrees (PhotoConsent); a sample needs
 * nothing. A photo that is too small, too dark or too bright is refused with the reason and a way on.
 * The live preview is drawn into the print by the screen that owns the video ref. Used for the face
 * photo of Style DNA and the full photo of See it on me; each kind keeps its own policy and consent.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { consentFor, type ImageCategory } from "../../core/images";
import { STAND_IN_PORTRAIT } from "../../shared/catalog";
import { captureFrame, fileToDataUrl, shrinkImage } from "../lib/image";
import { Caption, ChoiceList, QuietButton, TextButton } from "./controls";
import { PhotoConsent, problemText, rejectFile, rejectImage } from "./PhotoConsent";

export interface CaptureResult {
  image: string;
  source: "own" | "sample";
  /** How an own photo was given. */
  via?: "camera" | "upload";
}

interface CaptureProps {
  videoRef: RefObject<HTMLVideoElement>;
  onStream: (stream: MediaStream | null) => void;
  onCapture: (result: CaptureResult) => void;
  /** Which kind of photo, for its checks and its consent. Style DNA's face photo by default. */
  category?: ImageCategory;
  /** Whether a sample can stand in. Never for try-on: a sample is not you. */
  allowSample?: boolean;
  /** Said while the camera is open. */
  cameraTip?: string;
  /** Asked for consent when consent was already given on an earlier step. */
  consented?: boolean;
}

const WAYS = [
  { id: "camera", label: "Take a photo", hint: "Best near a window" },
  { id: "upload", label: "Upload a photo" },
  { id: "sample", label: "Use a sample" },
] as const;

/** Why the camera did not open, in words the customer can act on. */
function cameraProblem(e: unknown, allowSample: boolean): string {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  const other = allowSample ? "Upload a photo or use a sample instead." : "Upload a photo instead.";
  if (name === "NotAllowedError" || name === "SecurityError") return `Camera access is turned off for Praxis. Allow it in your browser settings, or ${other.charAt(0).toLowerCase()}${other.slice(1)}`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `I couldn’t find a camera on this device. ${other}`;
  if (name === "NotReadableError") return `Another app is using the camera. Close it and try again, or ${other.charAt(0).toLowerCase()}${other.slice(1)}`;
  return `The camera is not available here. ${other}`;
}

export function Capture({ videoRef, onStream, onCapture, category = "face_colour", allowSample = true, cameraTip = "Face natural light and look straight at the camera.", consented = false }: CaptureProps) {
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
      setError(cameraProblem(null, allowSample));
      return;
    }
    try {
      setBusy(true);
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }));
    } catch (e) {
      setError(cameraProblem(e, allowSample));
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
    void accept(image, "camera");
  };

  /** A photo is used only if it passes the checks; otherwise the customer reads why. */
  const accept = async (image: string, via: "camera" | "upload") => {
    const problem = await rejectImage(image, category);
    if (problem) {
      setError(problemText(problem, category));
      return;
    }
    onCapture({ image, source: "own", via });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const refused = rejectFile(file, category);
    if (refused) {
      setError(problemText(refused, category));
      return;
    }
    try {
      setBusy(true);
      const original = await fileToDataUrl(file);
      // The size check reads the original; the copy kept in the tab is made smaller.
      const problem = await rejectImage(original, category);
      if (problem) {
        setError(problemText(problem, category));
        return;
      }
      onCapture({ image: await shrinkImage(original, category === "try_on" ? 1280 : undefined), source: "own", via: "upload" });
    } catch {
      setError("I couldn’t read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: (typeof WAYS)[number]["id"]) => {
    if (busy) return;
    setError(null);
    if ((id === "camera" || id === "upload") && !consented && !consentFor(category)) {
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
        <Caption>{cameraTip}</Caption>
        <div className="flex gap-2">
          <QuietButton onClick={takePhoto}>Take photo</QuietButton>
          <TextButton onClick={stop}>Cancel</TextButton>
        </div>
        {error && (
          <p role="alert" className="text-[15px] text-[var(--error)]">
            {error}
          </p>
        )}
      </div>
      </>
    );
  }

  if (asking) {
    return (
      <>
      {input}
      <PhotoConsent
        category={category}
        declineLabel={allowSample ? "Use a sample instead" : "Not now"}
        onAgree={() => {
          const way = asking;
          setAsking(null);
          if (way === "camera") void openCamera();
          else fileRef.current?.click();
        }}
        onDecline={() => {
          setAsking(null);
          if (allowSample) onCapture({ image: STAND_IN_PORTRAIT, source: "sample" });
        }}
      />
      </>
    );
  }

  return (
    <>
    {input}
    <div className="flex flex-col gap-4">
      <ChoiceList label="How to add your photo" options={allowSample ? WAYS : WAYS.filter((w) => w.id !== "sample")} value={null} onChange={choose} />
      {error && (
        <p role="alert" className="text-[15px] leading-snug text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
    </>
  );
}
