const MULAW_MAX = 0x1fff;
const MULAW_BIAS = 0x84;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const pcm16ToMulawSample = (sample) => {
  let sign = 0;
  let magnitude = sample;

  if (magnitude < 0) {
    sign = 0x80;
    magnitude = -magnitude;
  }

  magnitude = clamp(magnitude, 0, MULAW_MAX);
  magnitude += MULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  const mulaw = ~(sign | (exponent << 4) | mantissa);
  return mulaw & 0xff;
};

const mulawToPcm16Sample = (mulaw) => {
  let value = ~mulaw & 0xff;
  const sign = value & 0x80;
  const exponent = (value >> 4) & 0x07;
  const mantissa = value & 0x0f;

  let magnitude = ((mantissa << 3) + MULAW_BIAS) << exponent;
  magnitude -= MULAW_BIAS;

  return sign ? -magnitude : magnitude;
};

export const mulawToPcm16 = (mulawBuffer) => {
  const pcm = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i += 1) {
    const sample = mulawToPcm16Sample(mulawBuffer[i]);
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
};

export const pcm16ToMulaw = (pcmBuffer) => {
  const length = Math.floor(pcmBuffer.length / 2);
  const mulaw = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    mulaw[i] = pcm16ToMulawSample(sample);
  }
  return mulaw;
};

export const resamplePcm16 = (pcmBuffer, inputRate, outputRate) => {
  if (inputRate === outputRate) return pcmBuffer;

  const inputSamples = Math.floor(pcmBuffer.length / 2);
  const ratio = inputRate / outputRate;
  const outputSamples = Math.max(1, Math.floor(inputSamples / ratio));
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i += 1) {
    const srcIndex = i * ratio;
    const left = Math.floor(srcIndex);
    const right = Math.min(left + 1, inputSamples - 1);
    const interp = srcIndex - left;

    const leftSample = pcmBuffer.readInt16LE(left * 2);
    const rightSample = pcmBuffer.readInt16LE(right * 2);
    const sample = leftSample + (rightSample - leftSample) * interp;
    output.writeInt16LE(Math.round(sample), i * 2);
  }

  return output;
};

export const pcm16ToWav = (pcmBuffer, sampleRate, channels = 1) => {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
};

export const wavToPcm16 = (wavBuffer) => {
  if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Invalid WAV header');
  }

  let offset = 12;
  let fmt = null;
  let data = null;

  while (offset < wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      const audioFormat = wavBuffer.readUInt16LE(chunkStart);
      const channels = wavBuffer.readUInt16LE(chunkStart + 2);
      const sampleRate = wavBuffer.readUInt32LE(chunkStart + 4);
      const bitsPerSample = wavBuffer.readUInt16LE(chunkStart + 14);

      fmt = {
        audioFormat,
        channels,
        sampleRate,
        bitsPerSample,
      };
    }

    if (chunkId === 'data') {
      data = wavBuffer.slice(chunkStart, chunkStart + chunkSize);
    }

    offset = chunkStart + chunkSize;
  }

  if (!fmt || !data) {
    throw new Error('Invalid WAV data');
  }

  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error('Unsupported WAV format');
  }

  if (fmt.channels !== 1) {
    throw new Error('Only mono WAV supported');
  }

  return { pcm: data, sampleRate: fmt.sampleRate };
};

export const rmsLevel = (pcmBuffer) => {
  const samples = Math.floor(pcmBuffer.length / 2);
  if (!samples) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples);
};
