/** Mono 16-bit PCM in a RIFF/WAVE container: what Muse Voice Transcribe takes. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // size of the fmt chunk
  view.setUint16(20, 1, true); // integer PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Linear resampling, for a microphone that does not give 16 kHz. */
export function resample(
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array {
  if (from === to) return samples;
  const length = Math.max(1, Math.round((samples.length * to) / from));
  const out = new Float32Array(length);
  const ratio = from / to;
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, samples.length - 1);
    const fraction = position - index;
    out[i] = samples[index]! * (1 - fraction) + samples[next]! * fraction;
  }
  return out;
}
