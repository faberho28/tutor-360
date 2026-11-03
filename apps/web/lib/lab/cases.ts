/**
 * What the user is about to show to the camera. The case gives the AI its
 * context (HU-35 uses it to decide what to look for); this module only holds
 * the data and resolves a case from the address.
 *
 * Titles and examples are UI text (en). `context` is a prompt for the model,
 * so it is written in English.
 */

import type { TutorLevel } from "../tutor/levels";

export const LAB_CASE_IDS = [
  "computer",
  "phone",
  "keyboard",
  "custom",
] as const;

export type LabCaseId = (typeof LAB_CASE_IDS)[number];

export type LabCase = {
  id: LabCaseId;
  title: string;
  description: string;
  /** Short chips on the card. */
  examples: readonly string[];
  /** Prompt context for the model. `custom` builds it from the user's text. */
  context: string;
};

export const LAB_CASES: readonly LabCase[] = [
  {
    id: "computer",
    title: "Computer",
    description:
      "Motherboard, memory, drives, fans and cables of an open PC or laptop.",
    examples: ["Capacitors", "RAM and SSD", "Dust and cables"],
    context:
      "The user will show the inside of a desktop or laptop computer: motherboard, RAM, storage drives, fans, power supply and cables. " +
      "Identify the components and look for signs of failure: swollen or leaking capacitors, dust build-up, loose or damaged cables, burn marks, corrosion.",
  },
  {
    id: "phone",
    title: "Phone",
    description:
      "A disassembled phone or tablet: battery, board and connectors.",
    examples: ["Battery", "Board", "Flex connectors"],
    context:
      "The user will show a disassembled smartphone or tablet: battery, logic board, cameras, flex cables and connectors, screws and shields. " +
      "Identify the parts and look for signs of failure: a swollen battery, liquid damage or corrosion, burnt components, torn or loose flex cables.",
  },
  {
    id: "keyboard",
    title: "Keyboard",
    description: "Keys, switches, board and cable of a keyboard.",
    examples: ["Keys", "Switches", "Spilled liquid"],
    context:
      "The user will show a keyboard, whole or opened: keycaps, switches, stabilizers, circuit board, cable and connector. " +
      "Identify the parts and look for signs of failure: liquid residue or corrosion, missing or stuck keys, damaged switches, a frayed cable or bent connector pins.",
  },
  {
    id: "custom",
    title: "Custom",
    description:
      "Describe what you are going to show and what you want to look for.",
    examples: ["Any electronic device"],
    context: "",
  },
];

/** Bounds of the free text of the custom case. */
export const CUSTOM_MIN = 10;
export const CUSTOM_MAX = 300;

/** What the session keeps: serializable, without the card text. */
export type LabCaseSnapshot = {
  id: LabCaseId;
  title: string;
  /** One line for the scanner header: the card's text, or the user's own. */
  description: string;
  context: string;
};

/** Trims and collapses whitespace; returns null when the text is unusable. */
export function cleanCustomText(text: string | undefined): string | null {
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, CUSTOM_MAX);
  return clean.length >= CUSTOM_MIN ? clean : null;
}

/**
 * The case named by the address (`?case=` and, for the custom one, `?context=`),
 * or null when it is missing or invalid.
 */
export function resolveLabCase(
  id: string | undefined,
  customText?: string,
): LabCaseSnapshot | null {
  const found = LAB_CASES.find((labCase) => labCase.id === id);
  if (!found) return null;

  if (found.id === "custom") {
    const text = cleanCustomText(customText);
    if (!text) return null;
    return {
      id: found.id,
      title: found.title,
      description: text,
      context: `The user describes what they will show and what they are looking for: "${text}". Identify the visible objects that matter for that request and report their condition when it is relevant.`,
    };
  }

  return {
    id: found.id,
    title: found.title,
    description: found.description,
    context: found.context,
  };
}

/** The address that opens the scanner with a case and the level of the reader. */
export function scanHref(
  id: LabCaseId,
  level: TutorLevel,
  customText?: string,
): string {
  const params = new URLSearchParams({ case: id, level });
  const text = cleanCustomText(customText);
  if (id === "custom" && text) params.set("context", text);
  return `/scan?${params.toString()}`;
}
