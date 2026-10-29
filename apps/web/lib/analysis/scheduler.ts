import type { ChangeStatus } from "../vision/change-detector";

/** Minimum time between the starts of two analyses (cost and quota guard). */
export const DEFAULT_MIN_GAP_MS = 2000;
export const MIN_GAP_FLOOR_MS = 500;
/**
 * A change must hold this long before it costs an analysis: a shadow or a hand
 * that crosses and leaves is not worth a request. Shorter than the engine's
 * 3 s reference adoption, so a real change is analyzed before it becomes normal.
 */
export const DEFAULT_CHANGE_HOLD_MS = 250;
const BACKOFF_MS = [1000, 2000, 4000, 8000] as const;

/** The image holds still: the engine only reports these after it settled. */
const CHANGED: ReadonlySet<ChangeStatus> = new Set([
  "changed",
  "camera-moved",
  "scene-lost",
]);
const SETTLED: ReadonlySet<ChangeStatus> = new Set([...CHANGED, "stable"]);

export type SchedulerPhase =
  | "idle" // not started by the user
  | "waiting" // started, waiting for a steady image or the minimum gap
  | "analyzing" // one request in flight
  | "watching" // the screen is up to date; waiting for the next change
  | "retrying"; // the last request failed; waiting to try again

export type Clock = {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export type SchedulerOptions<T> = {
  /** Captures a frame and analyzes it. It must honor `signal`. */
  run: (signal: AbortSignal) => Promise<T>;
  /** Called only for a request that was not cancelled. */
  onResult: (value: T) => void;
  /** `manual` is a failed "Capturar": it does not stop the automatic mode. */
  onError?: (
    error: unknown,
    info: { willRetry: boolean; manual: boolean },
  ) => void;
  onPhase?: (phase: SchedulerPhase) => void;
  minGapMs?: number;
  /** How long a change must last before it triggers an analysis. */
  changeHoldMs?: number;
  clock?: Clock;
  /** Defaults to `error.retryable === true`. */
  isRetryable?: (error: unknown) => boolean;
};

function retryableByFlag(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { retryable?: unknown }).retryable === true
  );
}

/**
 * Decides when to analyze. Nothing runs until the user starts it; then the
 * first analysis waits for a steady image and a new one fires each time the
 * change engine reports that the scene changed (not while the same change
 * lasts). There is never more than one request in flight.
 */
export class AnalysisScheduler<T> {
  private readonly options: SchedulerOptions<T>;
  private readonly clock: Clock;
  private readonly minGapMs: number;
  private readonly changeHoldMs: number;
  private armed = false;
  /** The screen shows an older scene than the camera. */
  private needs = false;
  private lastStatus: ChangeStatus = "calibrating";
  private current: {
    controller: AbortController;
    promise: Promise<void>;
  } | null = null;
  private timer: unknown;
  /** Running while a change has not yet held for `changeHoldMs`. */
  private holdTimer: unknown;
  private nextAllowedAt = Number.NEGATIVE_INFINITY;
  private failures = 0;
  private phase: SchedulerPhase = "idle";

  constructor(options: SchedulerOptions<T>) {
    this.options = options;
    this.clock = options.clock ?? realClock;
    this.minGapMs = Math.max(
      MIN_GAP_FLOOR_MS,
      options.minGapMs ?? DEFAULT_MIN_GAP_MS,
    );
    this.changeHoldMs = Math.max(
      0,
      options.changeHoldMs ?? DEFAULT_CHANGE_HOLD_MS,
    );
  }

  /** The user starts the automatic analysis. */
  start() {
    if (this.armed) return;
    this.armed = true;
    this.needs = true;
    this.failures = 0;
    this.setPhase("waiting");
    this.tick();
  }

  /** The user pauses it: the request in flight is cancelled and discarded. */
  stop() {
    this.armed = false;
    this.needs = false;
    this.failures = 0;
    this.clearTimer();
    this.clearHold();
    this.current?.controller.abort();
    this.setPhase("idle");
  }

  /** Feeds the latest status of the change engine. */
  report(status: ChangeStatus) {
    const previous = this.lastStatus;
    this.lastStatus = status;
    if (!CHANGED.has(status)) {
      // Back to stable (or moving again) before holding: it was not a change.
      this.clearHold();
    } else if (this.armed && !CHANGED.has(previous)) {
      this.clearHold();
      this.holdTimer = this.clock.setTimeout(() => {
        this.holdTimer = undefined;
        if (!this.armed || !CHANGED.has(this.lastStatus)) return;
        this.needs = true;
        this.tick();
      }, this.changeHoldMs);
    }
    this.tick();
  }

  /**
   * One analysis on demand ("Capturar"). It shares the request in flight, does
   * nothing if the screen is already up to date, and rejects on failure.
   */
  async captureOnce(): Promise<void> {
    if (this.current) return this.current.promise;
    if (this.armed && !this.needs && this.failures === 0) return;
    await this.execute(true);
  }

  dispose() {
    this.stop();
  }

  private setPhase(phase: SchedulerPhase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.options.onPhase?.(phase);
  }

  private clearTimer() {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private clearHold() {
    if (this.holdTimer !== undefined) this.clock.clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
  }

  private tick() {
    this.clearTimer();
    if (!this.armed || this.current) return;
    if (!this.needs) {
      this.setPhase("watching");
      return;
    }
    const pending = this.failures > 0 ? "retrying" : "waiting";
    if (!SETTLED.has(this.lastStatus)) {
      this.setPhase(pending);
      return;
    }
    const wait = this.nextAllowedAt - this.clock.now();
    if (wait > 0) {
      this.setPhase(pending);
      this.timer = this.clock.setTimeout(() => this.tick(), wait);
      return;
    }
    void this.execute(false);
  }

  private execute(manual: boolean): Promise<void> {
    const controller = new AbortController();
    // A change that arrives while this runs sets it again.
    this.needs = false;
    this.nextAllowedAt = this.clock.now() + this.minGapMs;
    this.setPhase("analyzing");

    const promise = (async () => {
      // Lets `this.current` be set before anything below can finish.
      await Promise.resolve();
      try {
        const value = await this.options.run(controller.signal);
        if (controller.signal.aborted) return;
        this.failures = 0;
        this.options.onResult(value);
      } catch (error) {
        if (controller.signal.aborted) return;
        this.needs = true;
        if (manual) {
          this.options.onError?.(error, { willRetry: false, manual: true });
          throw error;
        }
        this.failures++;
        const retry =
          this.armed && (this.options.isRetryable ?? retryableByFlag)(error);
        this.options.onError?.(error, { willRetry: retry, manual: false });
        if (retry) {
          const step = Math.min(this.failures, BACKOFF_MS.length) - 1;
          this.nextAllowedAt = Math.max(
            this.nextAllowedAt,
            this.clock.now() + (BACKOFF_MS[step] ?? 8000),
          );
        } else {
          this.stop();
        }
      } finally {
        if (this.current?.controller === controller) this.current = null;
        this.tick();
      }
    })();

    this.current = { controller, promise };
    return promise;
  }
}
