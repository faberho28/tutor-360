import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import {
  InvalidSegmentationMaskError,
  ResponsesStreamAbortedError,
  ResponsesStreamError,
  ResponsesStreamRefusalError,
  ResponsesStreamSourceError,
} from "@meta-sam/parser";

export type ModelErrorKind =
  | "not_configured"
  | "auth"
  | "quota"
  | "timeout"
  | "network"
  | "refused"
  | "invalid_response"
  | "aborted"
  | "unknown";

const RETRYABLE: ReadonlySet<ModelErrorKind> = new Set([
  "quota",
  "timeout",
  "network",
]);

export class ModelError extends Error {
  readonly kind: ModelErrorKind;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(
    kind: ModelErrorKind,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ModelError";
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
    this.status = options?.status;
  }
}

/** Translates anything thrown by the SDK or the parser into a ModelError. */
export function toModelError(error: unknown): ModelError {
  if (error instanceof ModelError) return error;

  // The parser wraps errors raised by the underlying event source.
  if (error instanceof ResponsesStreamSourceError && error.cause) {
    return toModelError(error.cause);
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = { cause: error };

  if (
    error instanceof APIUserAbortError ||
    error instanceof ResponsesStreamAbortedError ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return new ModelError("aborted", message, cause);
  }
  // The timeout class extends the connection class: check it first.
  if (error instanceof APIConnectionTimeoutError) {
    return new ModelError("timeout", message, cause);
  }
  if (error instanceof APIConnectionError) {
    return new ModelError("network", message, cause);
  }
  if (error instanceof RateLimitError) {
    return new ModelError("quota", message, { ...cause, status: 429 });
  }
  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError
  ) {
    return new ModelError("auth", message, { ...cause, status: error.status });
  }
  if (error instanceof APIError) {
    const kind =
      error.status !== undefined && error.status >= 500 ? "network" : "unknown";
    return new ModelError(kind, message, { ...cause, status: error.status });
  }
  if (error instanceof ResponsesStreamRefusalError) {
    return new ModelError("refused", message, cause);
  }
  if (
    error instanceof InvalidSegmentationMaskError ||
    error instanceof ResponsesStreamError
  ) {
    return new ModelError("invalid_response", message, cause);
  }
  return new ModelError("unknown", message, cause);
}
