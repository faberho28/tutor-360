// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPONENT_CLASSES } from "@/lib/component-status";
import { LABELS_ES } from "@/lib/overlay-theme";
import DesignPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("/design", () => {
  it("renders every overlay class with its Spanish label in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<DesignPage />);
    for (const cls of COMPONENT_CLASSES) {
      expect(screen.getAllByText(LABELS_ES[cls]).length).toBeGreaterThan(0);
    }
  });

  it("shows the three status badges", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<DesignPage />);
    expect(screen.getAllByText("Anomalía").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revisar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OK").length).toBeGreaterThan(0);
  });

  it("responds with not-found in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => DesignPage()).toThrow();
  });
});
