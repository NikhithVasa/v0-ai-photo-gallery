const DEFAULT_NOVITA_FLUX_KONTEXT_MAX_ENDPOINT =
  "https://api.novita.ai/v3/async/flux-1-kontext-max";
const DEFAULT_NOVITA_TASK_RESULT_ENDPOINT =
  "https://api.novita.ai/v3/async/task-result";

export const BASE_PHOTO_EDIT_PROMPT = `
Edit only the provided image.
Preserve the main person's identity, face, outfit, pose, jewelry, and important details unless the user explicitly asks to change them.
Make the edit realistic, natural, high quality, and consistent with the original lighting, shadows, camera angle, and perspective.
Do not add text, watermarks, logos, extra fingers, distorted faces, or unnatural artifacts.
Return a polished final image.
User edit request:
`;

interface NovitaSubmitResponse {
  task_id?: string;
}

export type NovitaFluxAspectRatio =
  | "21:9"
  | "16:9"
  | "4:3"
  | "3:2"
  | "1:1"
  | "2:3"
  | "3:4"
  | "9:16"
  | "9:21";

type NovitaFluxSafetyTolerance = "1" | "2" | "3" | "4" | "5";

const FLUX_ASPECT_RATIOS: Array<{
  value: NovitaFluxAspectRatio;
  ratio: number;
}> = [
  { value: "21:9", ratio: 21 / 9 },
  { value: "16:9", ratio: 16 / 9 },
  { value: "4:3", ratio: 4 / 3 },
  { value: "3:2", ratio: 3 / 2 },
  { value: "1:1", ratio: 1 },
  { value: "2:3", ratio: 2 / 3 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "9:16", ratio: 9 / 16 },
  { value: "9:21", ratio: 9 / 21 },
];

interface NovitaTaskResult {
  task_id?: string;
  task?: {
    task_id?: string;
    status?: string;
    reason?: string;
    eta?: number;
    progress_percent?: number;
  };
  images?: Array<{
    image_url?: string;
    image_url_ttl?: string;
    image_type?: string;
  }>;
  videos?: unknown[];
  extra?: Record<string, unknown>;
}

export class NovitaTaskFailedError extends Error {
  taskId: string;
  response: NovitaTaskResult;

  constructor(taskId: string, response: NovitaTaskResult) {
    const reason = response.task?.reason || "Novita image edit failed";
    super(reason);
    this.name = "NovitaTaskFailedError";
    this.taskId = taskId;
    this.response = response;
  }
}

function errorMessage(data: unknown, status: number, fallback: string) {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : "";
  const code = typeof record.code === "string" ? record.code : "";

  return [code, message].filter(Boolean).join(": ") || `${fallback} (${status})`;
}

function taskStatus(data: NovitaTaskResult) {
  return (data.task?.status || "").toUpperCase();
}

function firstImageUrl(data: NovitaTaskResult) {
  return data.images?.find((image) => image.image_url)?.image_url ?? null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function fluxSafetyToleranceFromEnv(): NovitaFluxSafetyTolerance {
  const value = process.env.NOVITA_FLUX_SAFETY_TOLERANCE;
  return value === "1" ||
    value === "2" ||
    value === "3" ||
    value === "4" ||
    value === "5"
    ? value
    : "2";
}

function fluxGuidanceScaleFromEnv() {
  const value = Number.parseFloat(process.env.NOVITA_FLUX_GUIDANCE_SCALE || "");
  if (!Number.isFinite(value)) return 3.5;
  return Math.min(Math.max(value, 1), 20);
}

export function nearestNovitaFluxAspectRatio(
  width?: number | null,
  height?: number | null,
): NovitaFluxAspectRatio | null {
  if (!width || !height || width <= 0 || height <= 0) return null;

  const sourceRatio = width / height;
  return FLUX_ASPECT_RATIOS.reduce((closest, option) => {
    const closestDistance = Math.abs(Math.log(sourceRatio / closest.ratio));
    const optionDistance = Math.abs(Math.log(sourceRatio / option.ratio));
    return optionDistance < closestDistance ? option : closest;
  }).value;
}

export async function submitNovitaFluxKontextMaxImageEdit({
  base64Image,
  prompt,
  aspectRatio,
  guidanceScale = fluxGuidanceScaleFromEnv(),
  safetyTolerance = fluxSafetyToleranceFromEnv(),
}: {
  base64Image: string;
  prompt: string;
  aspectRatio?: NovitaFluxAspectRatio | null;
  guidanceScale?: number;
  safetyTolerance?: NovitaFluxSafetyTolerance;
}) {
  const apiKey = process.env.NOVITA_API_KEY;

  if (!apiKey) {
    throw new Error("NOVITA_API_KEY is not configured");
  }

  const finalPrompt = `${BASE_PHOTO_EDIT_PROMPT}\n${prompt}`.trim();
  const response = await fetch(
    process.env.NOVITA_FLUX_KONTEXT_MAX_ENDPOINT ||
      DEFAULT_NOVITA_FLUX_KONTEXT_MAX_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        images: [base64Image],
        seed: -1,
        guidance_scale: guidanceScale,
        safety_tolerance: safetyTolerance,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as NovitaSubmitResponse;

  if (!response.ok) {
    throw new Error(errorMessage(data, response.status, "Novita request failed"));
  }

  if (!data.task_id) {
    throw new Error("Novita did not return a task_id");
  }

  return {
    taskId: data.task_id,
    finalPrompt,
    aspectRatio: aspectRatio ?? null,
    response: data,
  };
}

export async function fetchNovitaTaskResult(taskId: string) {
  const apiKey = process.env.NOVITA_API_KEY;

  if (!apiKey) {
    throw new Error("NOVITA_API_KEY is not configured");
  }

  const endpoint =
    process.env.NOVITA_TASK_RESULT_ENDPOINT ||
    DEFAULT_NOVITA_TASK_RESULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("task_id", taskId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const data = (await response.json().catch(() => ({}))) as NovitaTaskResult;

  if (!response.ok) {
    throw new Error(
      errorMessage(data, response.status, "Novita task result request failed"),
    );
  }

  return data;
}

export async function waitForNovitaImageResult(taskId: string) {
  const attempts = Number.parseInt(process.env.NOVITA_POLL_ATTEMPTS || "45", 10);
  const intervalMs = Number.parseInt(
    process.env.NOVITA_POLL_INTERVAL_MS || "2000",
    10,
  );
  let latest: NovitaTaskResult | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await fetchNovitaTaskResult(taskId);

    const imageUrl = firstImageUrl(latest);
    if (imageUrl) {
      return {
        status: "completed",
        imageUrl,
        response: latest,
      };
    }

    const status = taskStatus(latest);
    if (status === "TASK_STATUS_FAILED" || status === "FAILED") {
      throw new NovitaTaskFailedError(taskId, latest);
    }

    await sleep(intervalMs);
  }

  return {
    status: "submitted",
    imageUrl: null,
    response: latest,
  };
}
