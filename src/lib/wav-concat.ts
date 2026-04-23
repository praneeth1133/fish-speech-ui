/**
 * Concatenate multiple audio blobs into a single WAV blob.
 *
 * Used by the multi-voice feature: after every segment in a batch has been
 * generated and stored in IndexedDB, we load the individual blobs, decode
 * them with the Web Audio API, stitch them together (with a small silence
 * gap between segments for natural pacing), and save the result as ONE
 * combined history item.
 */
import { audioBufferToWav } from "./wav-encoder";

export interface ConcatOptions {
  /** Gap between segments in seconds. Default 0.3s. */
  gapSeconds?: number;
  /**
   * When true, each segment is RMS-normalized so every character speaks at
   * roughly the same perceived loudness. Default true. Especially important
   * for multi-voice generations where different voice models output very
   * different base amplitudes.
   */
  normalizeVolume?: boolean;
  /**
   * Target RMS amplitude in linear [0, 1]. ~0.1 is around -20 dBFS, a safe
   * speech level that leaves ~20 dB of headroom before clipping. Lower = quieter.
   */
  targetRms?: number;
}

/** Compute the RMS (root-mean-square) amplitude of a mono buffer. */
function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  // Sparse sample: scanning every 4th frame is plenty accurate and ~4× faster
  const step = 4;
  let counted = 0;
  for (let i = 0; i < samples.length; i += step) {
    const v = samples[i];
    sumSquares += v * v;
    counted++;
  }
  return Math.sqrt(sumSquares / counted);
}

/** Scale a buffer in place by `gain`, then soft-clip to [-0.98, 0.98] to
 * guarantee no wrap-around in the int16 encoder. */
function applyGainWithLimiter(samples: Float32Array, gain: number): void {
  const ceiling = 0.98;
  for (let i = 0; i < samples.length; i++) {
    let v = samples[i] * gain;
    if (v > ceiling) v = ceiling;
    else if (v < -ceiling) v = -ceiling;
    samples[i] = v;
  }
}

/**
 * Decode each blob via AudioContext, resample (if needed) to a common sample
 * rate, concatenate into one Float32Array, then encode as WAV.
 */
export async function concatAudioBlobs(
  blobs: Blob[],
  options: ConcatOptions = {}
): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error("concatAudioBlobs: no blobs provided");
  }
  if (blobs.length === 1) {
    // Single blob — decode + re-encode so we always return a WAV
    return reencodeToWav(blobs[0]);
  }

  const gapSeconds = options.gapSeconds ?? 0.3;
  const ctx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();

  try {
    // Decode all blobs. Each result is an AudioBuffer with its own sample rate.
    const buffers = await Promise.all(
      blobs.map(async (b) => {
        const ab = await b.arrayBuffer();
        return ctx.decodeAudioData(ab.slice(0));
      })
    );

    // Pick the highest sample rate among the inputs so we never lose quality
    const targetSampleRate = Math.max(...buffers.map((b) => b.sampleRate));

    // Convert each buffer to mono at the target sample rate
    const monoFloats: Float32Array[] = buffers.map((buf) =>
      bufferToMonoAtRate(buf, targetSampleRate)
    );

    // Volume leveling: scale each segment toward a common RMS so no character
    // is dramatically louder/quieter than the others.
    const normalize = options.normalizeVolume ?? true;
    if (normalize) {
      const targetRms = options.targetRms ?? 0.1;
      for (const seg of monoFloats) {
        const rms = computeRms(seg);
        if (rms < 1e-5) continue; // near silence — skip
        const gain = targetRms / rms;
        // Cap gain to avoid blowing up near-silent inputs by 50x
        const safeGain = Math.min(gain, 4.0);
        applyGainWithLimiter(seg, safeGain);
      }
    }

    const gapSamples = Math.floor(gapSeconds * targetSampleRate);
    const totalLength = monoFloats.reduce(
      (sum, arr, i) => sum + arr.length + (i < monoFloats.length - 1 ? gapSamples : 0),
      0
    );

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < monoFloats.length; i++) {
      combined.set(monoFloats[i], offset);
      offset += monoFloats[i].length;
      if (i < monoFloats.length - 1) {
        // gap is zeroed by default
        offset += gapSamples;
      }
    }

    // Wrap in a synthetic AudioBuffer so we can pass it to the existing encoder
    const outBuffer = ctx.createBuffer(1, combined.length, targetSampleRate);
    outBuffer.copyToChannel(combined, 0);

    return audioBufferToWav(outBuffer);
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function reencodeToWav(blob: Blob): Promise<Blob> {
  const ctx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();
  try {
    const ab = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    return audioBufferToWav(decoded);
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Convert an AudioBuffer (any channel count, any sample rate) to a mono
 * Float32Array at the target sample rate. Uses linear interpolation for
 * resampling — fast, acceptable quality for speech.
 */
function bufferToMonoAtRate(
  buffer: AudioBuffer,
  targetRate: number
): Float32Array {
  const srcChannels = buffer.numberOfChannels;
  const srcLen = buffer.length;

  // Mix down to mono
  const mono = new Float32Array(srcLen);
  if (srcChannels === 1) {
    mono.set(buffer.getChannelData(0));
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < srcLen; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
  }

  if (buffer.sampleRate === targetRate) {
    return mono;
  }

  // Linear resample
  const ratio = targetRate / buffer.sampleRate;
  const outLen = Math.floor(srcLen * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, srcLen - 1);
    const frac = srcPos - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}
