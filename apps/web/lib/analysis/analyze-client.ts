import type { CapturedFrame } from "../camera/capture-frame";
import { API_KEY_HEADER } from "../settings/api-key";
import type { PlannedPart } from "./scene";
import type {
  AnalyzeErrorKind,
  AnalyzeErrorResponse,
  AnalyzeResponse,
} from "./types";

/**
 * Past this the screen treats the AI as offline. The first analysis of a scene
 * asks Spark (3 to 5 s) and then runs up to 24 SAM calls (2 to 3 s).
 */
const TIMEOUT_MS = 20_000;

const KINDS: readonly AnalyzeErrorKind[] = [
  "invalid_input",
  "not_configured",
  "auth",
  "quota",
  "timeout",
  "network",
  "refused",
  "invalid_response",
  "aborted",
  "unknown",
];

/** Worth trying again with a new frame; the others will not fix themselves. */
const RETRYABLE: ReadonlySet<AnalyzeErrorKind> = new Set([
  "network",
  "timeout",
  "invalid_response",
  "unknown",
]);

export class AnalyzeClientError extends Error {
  readonly kind: AnalyzeErrorKind;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(kind: AnalyzeErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AnalyzeClientError";
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
    this.status = status;
  }
}

function isAnalyzeResponse(body: unknown): body is AnalyzeResponse {
  if (typeof body !== "object" || body === null) return false;
  const value = body as Partial<AnalyzeResponse>;
  return (
    Array.isArray(value.components) &&
    Array.isArray(value.plan) &&
    typeof value.timestamp === "number"
  );
}

function serverError(status: number, body: unknown): AnalyzeClientError {
  const error = (body as Partial<AnalyzeErrorResponse> | null)?.error;
  const kind = KINDS.find((candidate) => candidate === error?.kind);
  if (!kind) {
    return new AnalyzeClientError(
      "unknown",
      `La respuesta del análisis no es válida (${status})`,
      status,
    );
  }
  return new AnalyzeClientError(
    kind,
    typeof error?.message === "string" ? error.message : "Error de análisis",
    status,
  );
}

/**
 * Sends one frame to `/api/analyze`. Rejects with an AnalyzeClientError: a
 * timeout, a cancellation by `signal` and a network failure are told apart.
 */
export async function requestAnalysis(
  frame: CapturedFrame,
  sessionId: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    endpoint?: string;
    /** The Laboratorio case context, sent along for the server to use. */
    context?: string;
    /** Whether the case judges condition; false reports everything as ok. */
    judgesCondition?: boolean;
    /** The user's own model API key (Ajustes); sent in a header, not the body. */
    apiKey?: string;
    /** The parts planned for this scene: the server then skips Spark. */
    plan?: PlannedPart[];
  } = {},
): Promise<AnalyzeResponse> {
  const {
    signal,
    timeoutMs = TIMEOUT_MS,
    endpoint = "/api/analyze",
    context,
    judgesCondition,
    apiKey,
    plan,
  } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const interrupted = () => {
    if (timedOut) {
      return new AnalyzeClientError("timeout", "El análisis tardó demasiado");
    }
    if (signal?.aborted) {
      return new AnalyzeClientError("aborted", "Análisis cancelado");
    }
    return null;
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { [API_KEY_HEADER]: apiKey } : {}),
      },
      body: JSON.stringify({
        image: frame.dataUrl,
        width: frame.width,
        height: frame.height,
        sessionId,
        context,
        judgesCondition,
        plan,
      }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    const stopped = interrupted();
    if (stopped) throw stopped;
    if (!response.ok) throw serverError(response.status, body);
    if (!isAnalyzeResponse(body)) {
      throw new AnalyzeClientError(
        "invalid_response",
        "La respuesta del análisis no es válida",
      );
    }
    return body;
  } catch (error) {
    if (error instanceof AnalyzeClientError) throw error;
    throw (
      interrupted() ??
      new AnalyzeClientError("network", "Sin conexión con la IA")
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
