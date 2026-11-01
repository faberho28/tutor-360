/**
 * How much the person in front of the camera already knows. The user picks it in
 * the Laboratorio; the tutor's prompts (guide, voice, final check, diagnosis)
 * are written for that reader. The prompt text lives in `level-profiles.ts`
 * (server only); this module is what the browser needs.
 *
 * Titles and descriptions are UI text (es-CO).
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
    title: "Aprendiz junior",
    description: "Empiezo: explícame qué es cada cosa y por qué, paso a paso.",
  },
  middle: {
    title: "Aprendiz middle",
    description: "Conozco lo básico: dime el método y la razón de cada paso.",
  },
  senior: {
    title: "Aprendiz senior",
    description: "Ya diagnostico: dame hipótesis y pruebas que las distingan.",
  },
  technician: {
    title: "Técnico",
    description:
      "Domino las bases: solo el procedimiento, los valores y el porqué.",
  },
};

/** The level named by the address (`?nivel=`), or the default when it is missing or invalid. */
export function parseTutorLevel(value: string | undefined): TutorLevel {
  return TUTOR_LEVELS.find((level) => level === value) ?? DEFAULT_TUTOR_LEVEL;
}
