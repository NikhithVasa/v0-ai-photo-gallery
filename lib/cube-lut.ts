import sharp from "sharp";

export interface CubeLut {
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  values: Float32Array;
}

function triplet(parts: string[], label: string): [number, number, number] {
  const values = parts.slice(1, 4).map(Number);
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} must contain three numeric values.`);
  }
  return values as [number, number, number];
}

export function parseCubeLut(source: string): CubeLut {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("TITLE")) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === "LUT_3D_SIZE") {
      size = Number.parseInt(parts[1] ?? "", 10);
      continue;
    }
    if (parts[0] === "DOMAIN_MIN") {
      domainMin = triplet(parts, "DOMAIN_MIN");
      continue;
    }
    if (parts[0] === "DOMAIN_MAX") {
      domainMax = triplet(parts, "DOMAIN_MAX");
      continue;
    }
    if (parts[0] === "LUT_1D_SIZE") {
      throw new Error("This preset uses a 1D LUT. Please upload a 3D .cube preset.");
    }

    const color = parts.slice(0, 3).map(Number);
    if (color.length === 3 && color.every(Number.isFinite)) {
      values.push(...color);
    }
  }

  if (!Number.isInteger(size) || size < 2 || size > 65) {
    throw new Error("This preset has an unsupported LUT size.");
  }

  if (values.length !== size * size * size * 3) {
    throw new Error("This preset file is incomplete or invalid.");
  }

  return {
    size,
    domainMin,
    domainMax,
    values: new Float32Array(values),
  };
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lookup(lut: CubeLut, red: number, green: number, blue: number) {
  const normalized = [red, green, blue].map((value, channel) => {
    const min = lut.domainMin[channel];
    const max = lut.domainMax[channel];
    return clamp((value - min) / Math.max(max - min, Number.EPSILON));
  });

  const coordinates = normalized.map((value) => value * (lut.size - 1));
  const lower = coordinates.map(Math.floor);
  const upper = lower.map((value) => Math.min(value + 1, lut.size - 1));
  const mix = coordinates.map((value, channel) => value - lower[channel]);

  const sample = (r: number, g: number, b: number, channel: number) => {
    const index = (r + g * lut.size + b * lut.size * lut.size) * 3 + channel;
    return lut.values[index];
  };

  return [0, 1, 2].map((channel) => {
    const c000 = sample(lower[0], lower[1], lower[2], channel);
    const c100 = sample(upper[0], lower[1], lower[2], channel);
    const c010 = sample(lower[0], upper[1], lower[2], channel);
    const c110 = sample(upper[0], upper[1], lower[2], channel);
    const c001 = sample(lower[0], lower[1], upper[2], channel);
    const c101 = sample(upper[0], lower[1], upper[2], channel);
    const c011 = sample(lower[0], upper[1], upper[2], channel);
    const c111 = sample(upper[0], upper[1], upper[2], channel);

    const c00 = c000 + (c100 - c000) * mix[0];
    const c10 = c010 + (c110 - c010) * mix[0];
    const c01 = c001 + (c101 - c001) * mix[0];
    const c11 = c011 + (c111 - c011) * mix[0];
    const c0 = c00 + (c10 - c00) * mix[1];
    const c1 = c01 + (c11 - c01) * mix[1];
    return clamp(c0 + (c1 - c0) * mix[2]);
  });
}

export async function applyCubeLutToImage({
  imageBytes,
  lut,
  intensity,
  maxDimension,
}: {
  imageBytes: Uint8Array;
  lut: CubeLut;
  intensity: number;
  maxDimension?: number;
}) {
  let pipeline = sharp(imageBytes).rotate().flatten({ background: "#ffffff" });
  if (maxDimension) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const { data, info } = await pipeline
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  const strength = clamp(intensity / 100);

  for (let index = 0; index < output.length; index += info.channels) {
    const original = [
      output[index] / 255,
      output[index + 1] / 255,
      output[index + 2] / 255,
    ];
    const edited = lookup(lut, original[0], original[1], original[2]);

    output[index] = Math.round(
      clamp(original[0] + (edited[0] - original[0]) * strength) * 255,
    );
    output[index + 1] = Math.round(
      clamp(original[1] + (edited[1] - original[1]) * strength) * 255,
    );
    output[index + 2] = Math.round(
      clamp(original[2] + (edited[2] - original[2]) * strength) * 255,
    );
  }

  const bytes = await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return {
    bytes: new Uint8Array(bytes),
    contentType: "image/jpeg",
    width: info.width,
    height: info.height,
  };
}
