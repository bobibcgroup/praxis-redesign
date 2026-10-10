/**
 * The home demo: an 8.5 second film of the real journey (choose Dinner, the looks come together,
 * three looks for dinner, open one to its note and pieces, back to the three). It is rendered
 * from video/hero-demo, using the app's own photos, type and copy, so the page only plays a file.
 *
 * Phones get their own cut (larger type, 4:5). MP4 first, WebM for browsers without H.264. Muted, no controls, loops, plays only while on
 * screen. The poster is the three looks; it shows while the file loads, if it cannot play, and
 * instead of the video when motion is reduced. A pause control appears for keyboard users only.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const PHONE = "(max-width: 639px)";
const CUTS = {
  wide: { src: "/media/praxis-hero-demo", poster: "/media/praxis-hero-demo-poster.webp", ratio: "1080 / 1170" },
  phone: { src: "/media/praxis-hero-demo-mobile", poster: "/media/praxis-hero-demo-mobile-poster.webp", ratio: "4 / 5" },
};

function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export function HomeDemo({ reduced }: { reduced: boolean }) {
  const cut = usePhone() ? CUTS.phone : CUTS.wide;
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

  return (
    <figure className="a-demo" style={{ aspectRatio: cut.ratio }} aria-label="How Praxis works: choose Dinner, and I put together three looks for it">
      {still ? (
        <img src={cut.poster} alt="" width={1080} height={1170} decoding="async" />
      ) : (
        <>
          <video
            key={cut.src}
            ref={video}
            poster={cut.poster}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src={`${cut.src}.mp4`} type="video/mp4" />
            {/* The last source failing means nothing here can play it: show the poster. */}
            <source src={`${cut.src}.webm`} type="video/webm" onError={() => setFailed(true)} />
          </video>
          <button type="button" onClick={toggle} className="a-demo-toggle" aria-label={held ? "Play the demo" : "Pause the demo"}>
            {held ? <Play size={14} strokeWidth={1.5} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </>
      )}
    </figure>
  );
}
