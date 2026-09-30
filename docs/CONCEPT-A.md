# Concept A: Stage

## 1. Name
Stage.

## 2. Philosophy
One question, one frame, and a look that assembles beside you as you answer, so by the time the last question is asked the outfit is already almost there.

## 3. Core interaction model
The whole product is a single full-viewport stage split in two. The left half asks exactly one thing at a time in large type with tappable answers that auto-advance. The right half is a living canvas: it starts as a quiet field, gains the occasion's mood image when the occasion is chosen, shifts its light with day or night, previews the tier silhouette when the vibe is chosen, and gains the user's face when he adds a photo. The guided build then happens on the canvas itself (the three looks resolve in place, one after another). Results are the canvas at full size with a filmstrip of the two alternates; tapping an alternate crossfades it into the frame. Try-on is a wipe across the same frame that reveals the user. Nothing ever leaves the stage; the stage changes.

On mobile the split becomes a stack: the canvas is a fixed 3:4 frame in the top 55% of the viewport and the question sits below it; the question area never exceeds the remaining 45%, so each step fits one screen with no scroll.

## 4. Navigation model
Contextual only. No persistent nav. A one-line progress spine at the top names the steps in small caps ("Occasion · Room · Feel · You · Looks") and lets the user tap back to any completed step. A monogram in the top corner opens a quiet overlay with three lines: New moment, Looks, Your DNA. Browser Back works because every step is a route.

## 5. Primary journey
ENTRY: home is the empty stage with one sentence and one action ("Dress for a moment") and a secondary line ("Or build your Style DNA once, and skip the questions next time"). A returning user with DNA sees his own portrait in the frame and the sentence changes to "Where are you going?", with the occasion chips already showing.
→ INTENT: taps Dinner. Canvas fades to the dinner image.
→ ACTION: venue, time, feel, spend, each one tap. Optional "You" step: add your face, add one item, or skip both with one tap ("Not now").
→ RESPONSE: the build plays on the canvas: five named stages, a thin progress line under the frame, and the three looks resolve into the filmstrip one by one.
→ RESULT: hero look fills the canvas; on the left, the title, the one-line why, the pieces with vendor and price, the total, and one primary action ("See it on you") with two quiet secondaries (Save, Share). Alternates in the filmstrip.
→ NEXT ACTION: try-on wipe, then Save or Buy the pieces (a sheet listing the pieces by vendor).

## 6. Screen architecture
- Stage (root layout): left column 40% (questions or details), right column 60% canvas. Progress spine across the top. Monogram menu.
- Home state, question states (occasion, room, time, feel, spend, you), building state, result state, try-on state.
- Sheets: Buy (pieces by vendor), Share, Menu.
- Looks: the stage becomes a horizontal gallery of saved looks in the same 3:4 frames, scrolling sideways; tap to open in the frame.
- Your DNA: the stage shows the portrait on the right and the DNA result on the left, with "Redo".
- DNA journey reuses the same one-question stage: face, fit, lifestyle, inspiration, guided build, result.

## 7. Visual language
- Typography: display "Cormorant Garamond" 300 and 400 (justified: the brand's serif DNA continues, but lighter and larger; this is the editorial luxury register), body and UI "Geist" 400 and 500. Questions at 40 px desktop / 30 px mobile, tracking -0.01em, line-height 1.1. Labels 13 px, sentence case, never all caps except the progress spine at 11 px with 0.14em tracking.
- Type scale: 11, 13, 15, 17, 22, 30, 40, 56.
- Spacing: 8 px base; column padding 48 px desktop, 20 px mobile; rhythm 24 / 40 / 64.
- Radii: 0 on frames and sheets, 2 px on buttons and chips. Sharp is the rule.
- Color: bone `#F4F1EA` background, ink `#15181C` text, secondary text `#5D6168`, hairline `#DCD7CC`, one accent: the brand's deep green `#2E4A3D` for the primary action and the progress spine, and its tint `#E4EBE5` for selected states. Canvas field when empty: `#E9E5DC`. No other hues.
- Surfaces: no cards. Groups are separated by space or a single hairline. The canvas is the only bordered object and its border is the image edge.
- Photography: full-bleed 3:4 in the canvas, `object-cover`, always with a 4 px inset of bone so the image reads as a print.
- Icons: none except a 1.5 px arrow for back and an X for close. Everything else is words.
- Density: 2. Air is the material.
- Color behavior: dark mode is defined (bone becomes `#111316`, ink becomes `#ECE8DF`, canvas field `#1A1D21`, accent `#8FB59F`) but the prototype locks light.

## 8. Motion language
Motion exists to show that the canvas is listening. Answers crossfade the canvas (400 ms, ease-out) and slide the next question up 12 px with a 240 ms fade. The build stages advance a hairline progress under the frame and each resolved look slides into the filmstrip from the right (spring, stiffness 220, damping 28). The try-on is a clip-path wipe from left to right over 900 ms. Chips scale to 0.98 on press. Nothing loops. Reduced motion: crossfades become cuts, the wipe becomes a fade.

## 9. Luxury mechanism
Scale and silence. One large photograph, one large question, one action, a lot of bone. The serif at 40 px with light weight. No borders, no shadows, no icons.

## 10. Immersion mechanism
The canvas reacts to every answer before results exist, so the user feels the look forming rather than filling a form. Try-on lands on the same frame he has been watching, so the payoff arrives where his eyes already are.

## 11. Scroll strategy
No vertical scroll anywhere in the journey. Results details are limited to the left column height; pieces are a short list; overflow becomes a sheet. Saved looks scroll horizontally.

## 12. Strengths
Fastest to understand, calmest, most photographic. The living canvas is a real differentiator and makes the wait feel like progress. Mobile stacking is natural.

## 13. Risks
Desktop leaves the canvas doing little at the first step. Serif can drift into "editorial template" if weights are wrong. The one-question rhythm adds one tap per question versus grouping; the concept bets that auto-advance makes each tap feel free.

## Design system summary
| Token | Value |
|---|---|
| Fonts | Cormorant Garamond 300/400 display; Geist 400/500 body |
| Scale | 11 / 13 / 15 / 17 / 22 / 30 / 40 / 56 |
| Spacing | 8 base, 20 mobile gutter, 48 desktop gutter |
| Radii | 0 frames, 2 controls |
| Color | bone #F4F1EA, ink #15181C, muted #5D6168, hairline #DCD7CC, accent #2E4A3D, accent tint #E4EBE5, field #E9E5DC |
| Controls | text buttons with 1 px hairline, primary is filled accent, chips are hairline rectangles that fill with tint when selected |
| Navigation | progress spine, monogram overlay, routes per step |
| Motion | 240 ms question, 400 ms canvas, 900 ms wipe, springs for filmstrip |
| Imagery | 3:4 prints with 4 px bone inset |
| Responsive | 60/40 split above 1024, 55/45 stack below |
