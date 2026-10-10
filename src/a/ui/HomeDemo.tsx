/**
 * The home demo, composed like a shoot: a dim restaurant photograph behind, two of the looks as
 * prints leaning in from the right, and in front the phone playing a recording of the real
 * journey (choose Dinner, the looks come together, browse the three). Muted and looping, with a
 * small pause control. The poster is the final frame, shown while it loads and instead of the
 * video when motion is reduced.
 */
import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { photoSet } from "./OccasionCards";

const PRINTS = ["/images/dinner_sharper_01.jpg", "/images/dinner_safest_01.jpg"];

export function HomeDemo({ reduced }: { reduced: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <figure className="a-demo" aria-label="How Praxis works: choose an occasion and get three looks">
      <img {...photoSet("/images/home/backdrop")} sizes="(min-width: 1024px) 45vw, 100vw" alt="" className="a-demo-backdrop" loading="lazy" decoding="async" />
      <div className="a-demo-prints" aria-hidden="true">
        {PRINTS.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="a-demo-device">
        {reduced ? (
          <img src="/media/demo-poster.jpg" alt="" />
        ) : (
          <video
            ref={video}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/media/demo-poster.jpg"
            aria-hidden="true"
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          >
            <source src="/media/demo.mp4" type="video/mp4" />
            <source src="/media/demo.webm" type="video/webm" />
          </video>
        )}
      </div>
      {reduced ? null : (
        <button type="button" onClick={toggle} className="a-demo-toggle a-transition" aria-label={paused ? "Play the demo" : "Pause the demo"}>
          {paused ? <Play size={14} strokeWidth={1.5} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      )}
    </figure>
  );
}
