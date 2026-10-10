/**
 * The home demo: a short recording of the real journey on a phone (choose Dinner, the looks
 * come together, browse the three). Muted, looping, no text over it. The poster is the final
 * frame, shown while it loads and instead of the video when motion is reduced.
 */
export function HomeDemo({ reduced }: { reduced: boolean }) {
  return (
    <figure className="a-demo" aria-label="How Praxis works: choose an occasion and get three looks">
      <div className="a-demo-device">
        {reduced ? (
          <img src="/media/demo-poster.jpg" alt="" />
        ) : (
          <video autoPlay muted loop playsInline preload="metadata" poster="/media/demo-poster.jpg" aria-hidden="true">
            <source src="/media/demo.mp4" type="video/mp4" />
            <source src="/media/demo.webm" type="video/webm" />
          </video>
        )}
      </div>
    </figure>
  );
}
