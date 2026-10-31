import { failure as fail } from "@/lib/analysis/error-response";
import { toModelError } from "@/lib/models/errors";
import { transcribeWav } from "@/lib/models/transcriber";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

/** A 15 s clip of mono 16-bit audio at 16 kHz is under 0.5 MB: this is generous. */
const MAX_BYTES = 2_000_000;

/**
 * Speech to text for the voice mode: the body is one recording (audio/wav, mono
 * 16-bit PCM at 16 kHz). Answers `{ text }`.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return fail("invalid_input");

  const bytes = new Uint8Array(
    await request.arrayBuffer().catch(() => new ArrayBuffer(0)),
  );
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  if (
    bytes.length < 1000 ||
    bytes.length > MAX_BYTES ||
    riff !== "RIFF" ||
    wave !== "WAVE"
  ) {
    return fail("invalid_input");
  }

  // The user's own key wins over the server's; it is never stored or logged.
  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) return fail("auth");

  try {
    const text = await transcribeWav(bytes, {
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json({ text });
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the audio nor the transcript goes to the log.
    console.error(
      `[transcribe] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

export const maxDuration = 30;
