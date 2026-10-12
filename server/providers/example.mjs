/**
 * The shape of a try-on provider, for copying. It calls nothing and makes no picture: it answers that
 * no engine is connected. Set TRYON_PROVIDER=example to test the whole path end to end for free.
 */
export const id = "example";
export const version = "0";
export const billable = false;

export async function tryOn(request) {
  return {
    imageId: `img_${request.requestId}`,
    outfitId: request.outfitId,
    sourceGarmentIds: request.garmentIds,
    modelVersion: version,
    status: "disabled",
    error: { code: "example_provider", message: "The example provider makes no pictures.", retryable: false },
    createdAt: new Date().toISOString(),
    retention: { deletable: true },
  };
}
