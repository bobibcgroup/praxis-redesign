/** Attaches a MediaStream to a video element and releases it on change. */
import { useEffect, type RefObject } from "react";

export function useAttachStream(ref: RefObject<HTMLVideoElement>, stream: MediaStream | null): void {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [ref, stream]);
}
