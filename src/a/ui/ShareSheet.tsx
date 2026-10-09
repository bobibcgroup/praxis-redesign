/**
 * Share a look. The story card is the hero: a branded image sized for Instagram stories that carries
 * the address, so every share brings someone back. Then: ask a friend to choose (a link to the same
 * three looks), save the image, copy the link.
 */
import { useEffect, useState } from "react";
import type { Look } from "../../shared/catalog";
import { renderLookCard } from "../lib/card";
import { askFriend, copyLink, download, shareImage, sharedUrl } from "../lib/share";
import { PrimaryButton, QuietButton, TextButton } from "./controls";
import { Sheet } from "./Sheet";

interface Props {
  look: Look;
  eyebrow: string;
  occasion: string;
  open: boolean;
  onClose: () => void;
}

function fileName(look: Look): string {
  return `praxis-${look.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
}

export function ShareSheet({ look, eyebrow, occasion, open, onClose }: Props) {
  const [card, setCard] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const address = typeof window !== "undefined" ? window.location.host.replace(/^www\./, "") : "";

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setNote(null);
    setCard(null);
    renderLookCard(look, eyebrow, address)
      .then((blob) => {
        if (!alive) return;
        setCard(blob);
        setPreview(URL.createObjectURL(blob));
      })
      .catch(() => alive && setNote("I couldn’t make the image. The link still works."));
    return () => {
      alive = false;
    };
  }, [open, look, eyebrow, address]);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const story = async () => {
    if (!card) return;
    const outcome = await shareImage(card, fileName(look), `My ${occasion} look, styled by Praxis.`, sharedUrl("story"));
    if (outcome === "saved") setNote("Saved. Post it to your story from your photos.");
  };

  const ask = async () => {
    await askFriend(`Which one should I wear for ${occasion}? Help me choose.`, sharedUrl("friend"));
  };

  const save = () => {
    if (!card) return;
    download(card, fileName(look));
    setNote("Saved to your downloads.");
  };

  const copy = async () => {
    const outcome = await copyLink(sharedUrl("link"));
    setNote(outcome === "copied" ? "Link copied." : "I couldn’t copy the link.");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Share this look"
      footer={
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={story} disabled={!card} className="w-full justify-center">
            {card ? "Share to your story" : "Preparing the image"}
          </PrimaryButton>
          <QuietButton onClick={ask} className="w-full justify-center">
            Ask a friend to choose
          </QuietButton>
          <div className="flex items-center justify-center gap-2">
            <TextButton onClick={save} disabled={!card}>
              Save the image
            </TextButton>
            <TextButton onClick={copy}>Copy link</TextButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div className="a-card-preview">{preview ? <img src={preview} alt={`${look.title}, the image you will share`} /> : null}</div>
        <p className="max-w-[34ch] text-center text-[13px] leading-5 text-[var(--muted)]" aria-live="polite">
          {note ?? "Made for Instagram stories. Your friends see all three looks and can get their own."}
        </p>
      </div>
    </Sheet>
  );
}
