import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validEnv = {
  MODEL_API_KEY: "test-key",
  MODEL_API_BASE_URL: "https://api.example.test",
  SEGMENTATION_MODEL: "segmentation-model-id",
  DIAGNOSIS_MODEL: "diagnosis-model-id",
};

function stubEnv(values: Record<string, string | undefined>) {
  for (const name of [
    "MODEL_API_KEY",
    "MODEL_API_BASE_URL",
    "SEGMENTATION_MODEL",
    "DIAGNOSIS_MODEL",
    "SEGMENT_SCORE_THRESHOLD",
  ]) {
    vi.stubEnv(name, values[name]);
  }
}

async function loadEnv() {
  vi.resetModules();
  return import("./env");
}

describe("lib/env", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads valid variables", async () => {
    stubEnv({ ...validEnv, SEGMENT_SCORE_THRESHOLD: "0.9" });
    const { env } = await loadEnv();
    expect(env.MODEL_API_KEY).toBe("test-key");
    expect(env.SEGMENT_SCORE_THRESHOLD).toBe(0.9);
  });

  it("fails naming MODEL_API_KEY when it is missing", async () => {
    stubEnv({ ...validEnv, MODEL_API_KEY: undefined });
    await expect(loadEnv()).rejects.toThrow(/MODEL_API_KEY/);
  });

  it("defaults SEGMENT_SCORE_THRESHOLD to 0.85 when absent", async () => {
    stubEnv(validEnv);
    const { env } = await loadEnv();
    expect(env.SEGMENT_SCORE_THRESHOLD).toBe(0.85);
  });

  it.each(["1.5", "-0.1", "abc"])(
    "rejects SEGMENT_SCORE_THRESHOLD=%s (must be a number within 0..1)",
    async (value) => {
      stubEnv({ ...validEnv, SEGMENT_SCORE_THRESHOLD: value });
      await expect(loadEnv()).rejects.toThrow(/SEGMENT_SCORE_THRESHOLD/);
    },
  );
});
