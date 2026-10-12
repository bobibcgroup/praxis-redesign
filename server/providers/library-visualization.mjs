/**
 * A free stand-in for the outfit_visualization provider on the server: it answers with the look's
 * library photograph (public/images/<outfit>.jpg), marked representative and not generated. It makes
 * nothing and costs nothing; it exists so the server path (cache, ceiling, ledger) can be exercised
 * before a real image model is approved. Switch on with AI_PROVIDER_OUTFIT_VISUALIZATION=library-visualization.
 */
export const id = "library-visualization";
export const version = "1.0.0";
export const billable = false;
export const costPerImageUsd = 0;
export const SERVICES = ["outfit_visualization"];

export async function run(request) {
  const outfitId = String(request?.payload?.outfitId ?? "");
  if (!/^[a-z]+_(safest|sharper|relaxed)_\d+$/.test(outfitId)) return { status: "empty" };
  return { status: "succeeded", result: { outfitId, imageUrl: `/images/${outfitId}.jpg`, fidelity: "representative", generated: false } };
}
