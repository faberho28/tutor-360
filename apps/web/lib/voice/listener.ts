import { encodeWav, resample } from "./wav";

/** What Muse Voice Transcribe takes (it also takes 24 kHz). */
const TARGET_RATE = 16_000;
/** About 128 ms per buffer at 16 kHz. */
const BUFFER_SIZE = 2048;
/** Loud buffers in a row that start an utterance. */
const START_FRAMES = 2;
/** Quiet buffers in a row that end it (about 0.9 s). */
const END_FRAMES = 7;
/** Buffers kept from before the start, so the first syllable is not cut. */
const PRE_ROLL_FRAMES = 3;
/** Shorter than this (in loud buffers) is a click or a knock, not a word. */
const MIN_LOUD_FRAMES = 2;
/** A clip is cut here (about 15 s). */
const MAX_FRAMES = 117;
/** Never below this level, however quiet the room is. */
const MIN_THRESHOLD = 0.02;

export type ListenerEvents = {
  /** One utterance, already as a WAV ready to transcribe. */
  onUtterance(wav: Blob): void;
  /** 0..1, for a level meter. */
  onLevel(level: number): void;
  /** Someone is talking (or stopped). */
  onSpeech(speaking: boolean): void;
};

/**
 * Always listening, in the browser: cuts the microphone into utterances by
 * loudness (an adaptive noise floor, so a noisy workshop does not keep it open)
 * and hands each one over as a WAV. It can be paused while the tutor talks, so
 * it never hears itself. Nothing is kept: a clip lives until it is sent.
 */
export class VoiceListener {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muted = false;

  private floor = 0.01;
  private speaking = false;
  private loudRun = 0;
  private quietRun = 0;
  private loudTotal = 0;
  private clip: Float32Array[] = [];
  private preRoll: Float32Array[] = [];

  constructor(private readonly events: ListenerEvents) {}

  /** Someone is talking right now. */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  get active(): boolean {
    return this.context !== null;
  }

  async start(): Promise<void> {
    if (this.context) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext({ sampleRate: TARGET_RATE });
    const source = context.createMediaStreamSource(stream);
    // Deprecated but everywhere, and it needs no extra file to serve.
    const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
    processor.onaudioprocess = (event) => {
      this.handle(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    // The processor only runs when it is connected to the output: through a gain
    // of zero, so nothing is played back.
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(processor);
    processor.connect(silent);
    silent.connect(context.destination);
    this.stream = stream;
    this.context = context;
    this.source = source;
    this.processor = processor;
    this.reset();
  }

  stop(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.context = null;
    this.reset();
  }

  /** While the tutor talks: whatever is being heard is dropped. */
  pause(): void {
    this.muted = true;
    this.reset();
  }

  resume(): void {
    this.muted = false;
    this.reset();
  }

  private reset(): void {
    if (this.speaking) this.events.onSpeech(false);
    this.speaking = false;
    this.loudRun = 0;
    this.quietRun = 0;
    this.loudTotal = 0;
    this.clip = [];
    this.preRoll = [];
  }

  private handle(frame: Float32Array): void {
    if (this.muted) {
      this.events.onLevel(0);
      return;
    }
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
    const rms = Math.sqrt(sum / frame.length);
    this.events.onLevel(Math.min(1, rms * 12));

    const threshold = Math.max(MIN_THRESHOLD, this.floor * 3.5);
    const loud = rms > threshold;
    // The room's own noise is learned while nobody talks.
    if (!this.speaking && !loud) {
      this.floor = Math.min(
        0.05,
        Math.max(0.003, this.floor * 0.95 + rms * 0.05),
      );
    }

    if (!this.speaking) {
      this.preRoll.push(frame);
      if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
      this.loudRun = loud ? this.loudRun + 1 : 0;
      if (this.loudRun >= START_FRAMES) {
        this.speaking = true;
        this.clip = [...this.preRoll];
        this.loudTotal = this.loudRun;
        this.quietRun = 0;
        this.events.onSpeech(true);
      }
      return;
    }

    this.clip.push(frame);
    if (loud) {
      this.loudTotal++;
      this.quietRun = 0;
    } else {
      this.quietRun++;
    }
    if (this.quietRun >= END_FRAMES || this.clip.length >= MAX_FRAMES)
      this.finish();
  }

  private finish(): void {
    const clip = this.clip;
    const worthIt = this.loudTotal >= MIN_LOUD_FRAMES;
    // Drop most of the trailing silence: the transcriber does not need it.
    const keep = Math.max(0, clip.length - Math.max(0, this.quietRun - 2));
    this.reset();
    if (!worthIt || !this.context) return;
    const length = clip
      .slice(0, keep)
      .reduce((total, part) => total + part.length, 0);
    const samples = new Float32Array(length);
    let offset = 0;
    for (const part of clip.slice(0, keep)) {
      samples.set(part, offset);
      offset += part.length;
    }
    const rate = this.context.sampleRate;
    this.events.onUtterance(
      encodeWav(resample(samples, rate, TARGET_RATE), TARGET_RATE),
    );
  }
}
