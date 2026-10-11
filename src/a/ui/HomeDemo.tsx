/**
 * The home demo: an 8.5 second film of the real journey (choose Dinner, the looks come together,
 * three looks for dinner, open one to its note and pieces, back to the three), rendered from
 * video/hero-demo with the app's own photos, type and copy, so the page only plays a file.
 *
 * It plays on a phone, as the customer would hold Praxis, layered over two photographs: the cloth of a
 * tailored jacket behind, the dinner table beside. The phone's bar and Save look button are part of the
 * picture, not controls. MP4 first, WebM for browsers without H.264. Muted, no controls, loops, plays
 * only while on screen. The poster shows while the file loads, if it cannot play, and instead of the
 * film when motion is reduced. A pause control appears for keyboard users only.
 */
import { useEffect, useRef, useState } from "react";
import { Bookmark, Pause, Play } from "lucide-react";
import { photoSet } from "./OccasionCards";

/** The phone cut of the film (4:5), shown under the phone's bar. */
const CUT = { src: "/media/praxis-hero-demo-mobile", poster: "/media/praxis-hero-demo-mobile-poster.webp", width: 720, height: 900 };

export function HomeDemo({ reduced }: { reduced: boolean }) {
  const cut = CUT;
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [held, setHeld] = useState(false);
  const still = reduced || failed;

  // Play only while at least a quarter of it is on screen; a blocked autoplay leaves the poster.
  useEffect(() => {
    const v = video.current;
    if (!v || still) return;
    v.muted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !held) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [still, held, cut.src]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (held) {
      setHeld(false);
      void v.play().catch(() => undefined);
    } else {
      setHeld(true);
      v.pause();
    }
  };

  const film = still ? (
    <img src={cut.poster} alt="" width={cut.width} height={cut.height} decoding="async" />
  ) : (
    <video
      key={cut.src}
      ref={video}
      poster={cut.poster}
      width={cut.width}
      height={cut.height}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={`${cut.src}.mp4`} type="video/mp4" />
      {/* The last source failing means nothing here can play it: show the poster. */}
      <source src={`${cut.src}.webm`} type="video/webm" onError={() => setFailed(true)} />
    </video>
  );

  return (
    <figure className="a-demo" aria-label="How Praxis works: choose Dinner, and I put together three looks for it">
      <span className="a-demo-print a-demo-print-back" aria-hidden="true">
        <img {...photoSet("/images/home/dna")} sizes="(min-width: 1024px) 34vw, 70vw" alt="" decoding="async" />
      </span>
      <span className="a-demo-print a-demo-print-side" aria-hidden="true">
        <img {...photoSet("/images/home/dinner")} sizes="(min-width: 1024px) 20vw, 40vw" alt="" decoding="async" />
      </span>
      <span className="a-phone-device">
        <span className="a-phone-screen">
          <span className="a-phone-bar" aria-hidden="true">
            <span className="a-phone-mark">PRAXIS</span>
            <span className="a-phone-menu" />
          </span>
          <span className="a-phone-film">{film}</span>
          <span className="a-phone-save" aria-hidden="true">
            <Bookmark size={13} strokeWidth={1.5} />
            Save look
          </span>
        </span>
      </span>
      {still ? null : (
        <button type="button" onClick={toggle} className="a-demo-toggle" aria-label={held ? "Play the demo" : "Pause the demo"}>
          {held ? <Play size={14} strokeWidth={1.5} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      )}
    </figure>
  );
}
