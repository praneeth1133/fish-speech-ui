/**
 * Encode an AudioBuffer to a 16-bit PCM WAV Blob.
 *
 * MediaRecorder hands us audio/webm (opus). The Fish Speech backend reads WAV
 * most reliably, so after stopping recording we decode the webm via
 * AudioContext.decodeAudioData and re-encode as mono WAV with this function.
 *
 * Writes a standard 44-byte RIFF/WAVE header followed by interleaved 16-bit
 * samples. If the source is stereo, channels are mixed down to mono.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1; // always mono — reference samples don't need stereo
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // Mix down to mono if needed
  const srcChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  if (srcChannels === 1) {
    mono.set(buffer.getChannelData(0));
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
  }

  const dataSize = length * blockAlign;
  const fileSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(fileSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Samples
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}
