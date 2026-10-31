import { API_KEY_HEADER } from "../settings/api-key";

/** Meta transcribes a short clip in 1 to 2 s; this leaves room for a slow network. */
const TIMEOUT_MS = 20_000;

export type VoiceOutcome = {
  /** "answer": says what happened in the step; "question": asks the tutor; "ignore": not for it. */
  intent: "answer" | "question" | "ignore";
  result: "yes" | "no" | "unsure" | null;
  note: string;
  /** What the tutor says out loud (a question only). */
  reply: string;
};

export type VoiceRequestContext = {
  goal: string;
  assessment?: string;
  steps: string[];
  current: number;
  reports: ({ result: "yes" | "no" | "unsure"; note?: string } | null)[];
  awaiting: boolean;
  conclusion?: string;
};

async function post<T>(
  url: string,
  body: BodyInit,
  headers: Record<string, string>,
  options: { signal?: AbortSignal; apiKey?: string },
  accept: (value: unknown) => value is T,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body,
      signal: controller.signal,
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok || !accept(json)) {
      throw new Error(`${url} failed (${response.status})`);
    }
    return json;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/** The text of one recording, as the speech-to-text heard it. Rejects on any failure. */
export async function transcribe(
  wav: Blob,
  options: { signal?: AbortSignal; apiKey?: string } = {},
): Promise<string> {
  const { text } = await post<{ text: string }>(
    "/api/transcribe",
    wav,
    { "content-type": "audio/wav" },
    options,
    (value): value is { text: string } =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as { text?: unknown }).text === "string",
  );
  return text;
}

function isOutcome(value: unknown): value is VoiceOutcome {
  if (typeof value !== "object" || value === null) return false;
  const { intent, result, note, reply } = value as Record<string, unknown>;
  return (
    (intent === "answer" || intent === "question" || intent === "ignore") &&
    (result === null ||
      result === "yes" ||
      result === "no" ||
      result === "unsure") &&
    typeof note === "string" &&
    typeof reply === "string"
  );
}

/** What Spark makes of what the student said, looking at the live frame. */
export async function requestVoiceTurn(
  input: {
    transcript: string;
    image: string;
    caseContext?: string;
    context: VoiceRequestContext;
  },
  options: { signal?: AbortSignal; apiKey?: string } = {},
): Promise<VoiceOutcome> {
  return post(
    "/api/voice",
    JSON.stringify(input),
    { "content-type": "application/json" },
    options,
    isOutcome,
  );
}
