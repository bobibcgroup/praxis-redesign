/**
 * The home film: about thirteen seconds, rendered from video/hero-film (three.js, the app's real screens
 * and photographs), so the page only plays a file. A phone on a travertine table in window light shows
 * the occasions and a light tap on Dinner, the looks being put together, then the three dinner looks,
 * which leave the screen as prints and settle above the table; the sharper one comes forward, and all
 * three go back into the screen. Then Style DNA: a fit and two tastes are chosen, and the saved
 * profile's colours lift off the screen as swatches and settle back, before the occasions return so
 * the loop has no cut.
 *
 * Two cuts: 6:5 from tablet up, 4:5 on a phone. MP4 first, WebM for browsers without H.264. Muted,
 * loops, plays inline. It plays only while at least a quarter of it is on screen, holds while the
 * visitor is on the occasion cards (`hold`), and never restarts on its own once the visitor paused it.
 * With reduced motion the poster shows and it plays only when Play is chosen. The round control always
 * shows the real state of the film.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const CUTS = {
  wide: { src: "/media/praxis-hero-film", width: 1200, height: 1000 },
  phone: { src: "/media/praxis-hero-film-mobile", width: 800, height: 1000 },
} as const;
const PHONE = "(max-width: 639px)";

function usePhoneCut() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const sync = () => setPhone(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

export function HomeDemo({ reduced, hold = false }: { reduced: boolean; hold?: boolean }) {
  const cut = usePhoneCut() ? CUTS.phone : CUTS.wide;
  const poster = `${cut.src}-poster.webp`;
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  /* Paused by the visitor. With reduced motion the film starts paused, on its poster. */
  const [paused, setPaused] = useState(reduced);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const run = !failed && !paused && visible && !hold;

  useEffect(() => {
    setPaused(reduced);
  }, [reduced]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [cut.src, failed]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    if (run) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [run, cut.src]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (playing) {
      setPaused(true);
      v.pause();
    } else {
      setPaused(false);
      v.muted = true;
      void v.play().catch(() => setPlaying(false));
    }
  };

  if (failed) {
    return (
      <figure className="a-demo" aria-label="Choose Dinner, and I put together three looks for it">
        <img className="a-demo-film" src={poster} alt="" width={cut.width} height={cut.height} decoding="async" />
      </figure>
    );
  }

  return (
    <figure className="a-demo" aria-label="Choose Dinner, and I put together three looks for it">
      <video
        key={cut.src}
        ref={video}
        className="a-demo-film"
        poster={poster}
        width={cut.width}
        height={cut.height}
        muted
        loop
        playsInline
        disablePictureInPicture
        preload={reduced ? "none" : "auto"}
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={`${cut.src}.mp4`} type="video/mp4" />
        {/* The last source failing means nothing here can play it: show the poster. */}
        <source src={`${cut.src}.webm`} type="video/webm" onError={() => setFailed(true)} />
      </video>
      <button type="button" onClick={toggle} className="a-demo-toggle a-transition" aria-label={playing ? "Pause the film" : "Play the film"}>
        {playing ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : <Play size={16} strokeWidth={1.5} aria-hidden="true" className="translate-x-px" />}
      </button>
    </figure>
  );
}
