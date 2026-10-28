// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("offers System, Light and Dark options", () => {
    stubMatchMedia(false);
    renderToggle();
    expect(screen.getByRole("button", { name: "Sistema" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Claro" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Oscuro" })).toBeDefined();
  });

  it("starts dark when the system prefers dark", () => {
    stubMatchMedia(true);
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("forces dark and remembers the choice", () => {
    stubMatchMedia(false);
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("forces light even when the system prefers dark", () => {
    stubMatchMedia(true);
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Claro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("marks the active option as pressed", () => {
    stubMatchMedia(false);
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
    expect(
      screen
        .getByRole("button", { name: "Oscuro" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Claro" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
