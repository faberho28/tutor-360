// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./badge";

afterEach(cleanup);

describe("Badge status variants", () => {
  it.each([
    ["anomaly", "Anomalía", "bg-anomaly-soft", "text-anomaly-text"],
    ["warning", "Revisar", "bg-warning-soft", "text-warning-text"],
    ["ok", "OK", "bg-ok-soft", "text-ok-text"],
  ] as const)(
    "%s renders its text, an icon and its soft/text classes",
    (variant, label, soft, text) => {
      render(<Badge variant={variant}>{label}</Badge>);
      const badge = screen.getByText(label).closest("[data-slot='badge']");
      expect(badge).not.toBeNull();
      expect(badge?.className).toContain(soft);
      expect(badge?.className).toContain(text);
      // The state never depends on color alone: there is always an icon.
      expect(badge?.querySelector("svg")).not.toBeNull();
    },
  );

  it("hides the status icon from assistive technology", () => {
    render(<Badge variant="anomaly">Anomalía</Badge>);
    const icon = screen
      .getByText("Anomalía")
      .closest("[data-slot='badge']")
      ?.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the inverse variant without a status icon", () => {
    render(<Badge variant="inverse">Analizando</Badge>);
    const badge = screen.getByText("Analizando").closest("[data-slot='badge']");
    expect(badge?.className).toContain("bg-inverse");
    expect(badge?.className).toContain("text-inverse-foreground");
    expect(badge?.querySelector("svg")).toBeNull();
  });
});
