import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

function blockVariables(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector ${selector} not found`);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(
    /--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g,
  )) {
    vars[match[1]!] = match[2]!.toUpperCase();
  }
  return vars;
}

const light = blockVariables(":root");
const dark = { ...light, ...blockVariables(".dark") };

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [foreground token, background token] — text pairs that must reach 4.5:1.
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["destructive", "background"],
  ["inverse-foreground", "inverse"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["anomaly-text", "anomaly-soft"],
  ["warning-text", "warning-soft"],
  ["ok-text", "ok-soft"],
  ["anomaly-text", "card"],
  ["warning-text", "card"],
  ["ok-text", "card"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("globals.css contrast (%s)", (_theme, vars) => {
  it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
    const fgValue = vars[fg];
    const bgValue = vars[bg];
    expect(fgValue, `missing token --${fg}`).toBeDefined();
    expect(bgValue, `missing token --${bg}`).toBeDefined();
    expect(contrast(fgValue!, bgValue!)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the primary ring visible against the card (3:1)", () => {
    expect(contrast(vars["ring"]!, vars["card"]!)).toBeGreaterThanOrEqual(3);
  });
});

function blend(fg: string, bg: string, alpha: number): string {
  const parse = (hex: string) =>
    [0, 2, 4].map((i) => parseInt(hex.slice(1).slice(i, i + 2), 16));
  const [f, b] = [parse(fg), parse(bg)];
  const mixed = f.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

describe("destructive button (soft tint)", () => {
  // The shadcn destructive variant is text-destructive on bg-destructive/10
  // in light and bg-destructive/20 in dark, over the card or the background.
  it.each([
    ["light", light, 0.1],
    ["dark", dark, 0.2],
  ] as const)("%s text reaches 4.5:1 on its tint", (_theme, vars, alpha) => {
    for (const surface of ["card", "background"]) {
      const tint = blend(vars["destructive"]!, vars[surface]!, alpha);
      expect(contrast(vars["destructive"]!, tint)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("overlay colors against the video background", () => {
  const OVERLAY_COLORS = [
    "#007AFF",
    "#5856D6",
    "#8E8E93",
    "#32ADE6",
    "#30B0C7",
    "#A2845E",
    "#FF3B30",
    "#FF9F0A",
  ];
  it.each(OVERLAY_COLORS)("%s reaches 3:1 against black", (color) => {
    expect(contrast(color, "#000000")).toBeGreaterThanOrEqual(3);
  });
});
