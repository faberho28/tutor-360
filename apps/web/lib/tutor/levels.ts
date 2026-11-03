/**
 * How much the person in front of the camera already knows. The user picks it in
 * the Lab; the tutor's prompts (guide, voice, final check, diagnosis)
 * are written for that reader. The prompt text lives in `level-profiles.ts`
 * (server only); this module is what the browser needs.
 *
 * Titles and descriptions are UI text (en).
 */

export const TUTOR_LEVELS = [
  "junior",
  "middle",
  "senior",
  "technician",
] as const;

export type TutorLevel = (typeof TUTOR_LEVELS)[number];

/** What the tutor assumed before there were levels. */
export const DEFAULT_TUTOR_LEVEL: TutorLevel = "technician";

export const TUTOR_LEVEL_INFO: Record<
  TutorLevel,
  { title: string; description: string }
> = {
  junior: {
    title: "Junior apprentice",
    description:
      "I am starting out: explain what each thing is and why, step by step.",
  },
  middle: {
    title: "Middle apprentice",
    description:
      "I know the basics: give me the method and the reason for each step.",
  },
  senior: {
    title: "Senior apprentice",
    description:
      "I already diagnose: give me hypotheses and tests that tell them apart.",
  },
  technician: {
    title: "Technician",
    description:
      "I master the basics: only the procedure, the values and the why.",
  },
};

/** The level named by the address (`?level=`), or the default when it is missing or invalid. */
export function parseTutorLevel(value: string | undefined): TutorLevel {
  return TUTOR_LEVELS.find((level) => level === value) ?? DEFAULT_TUTOR_LEVEL;
}
