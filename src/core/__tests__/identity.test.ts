/** Account ids: stable per address on this browser, and nothing about the address can be read from them. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "./helpers";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
});

describe("account ids", () => {
  it("gives the same address the same id, and different addresses different ids", async () => {
    const { userIdFor } = await import("../identity");
    const a = userIdFor("bob@praxis.app");
    expect(userIdFor(" Bob@Praxis.app ")).toBe(a);
    expect(userIdFor("ann@praxis.app")).not.toBe(a);
    expect(a).toMatch(/^user_[0-9a-f]{16,}$/);
  });

  it("does not derive the id from the address", async () => {
    const first = (await import("../identity")).userIdFor("bob@praxis.app");
    vi.resetModules();
    vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() });
    const elsewhere = (await import("../identity")).userIdFor("bob@praxis.app");
    expect(elsewhere).not.toBe(first);
  });
});
