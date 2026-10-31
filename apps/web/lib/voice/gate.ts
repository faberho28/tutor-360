/** Lowercase, no accents: the transcript comes with or without them. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The tutor was called ("tutor", "tutora", or the way the transcriber hears it). */
export function callsTheTutor(text: string): boolean {
  return /\btut[oa]r?a?\b/.test(normalize(text));
}

/**
 * Whether what was heard is worth a call to Spark. While a step waits for the
 * student's answer anything with words in it is: the tutor tells an answer from
 * chatter. Otherwise only when the tutor is called by name, so that the room's
 * conversations never cost anything.
 */
export function worthAsking(text: string, awaiting: boolean): boolean {
  const clean = normalize(text);
  if (clean.replace(/\s/g, "").length < 2) return false;
  return awaiting || callsTheTutor(text);
}
