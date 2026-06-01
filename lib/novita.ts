const DEFAULT_NOVITA_QWEN_IMAGE_EDIT_ENDPOINT =
  "https://api.novita.ai/v3/async/qwen-image-edit";
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

export async function submitNovitaQwenImageEdit({
  base64Image,
  prompt,
  outputFormat = "png",
}: {
  base64Image: string;
  prompt: string;
  outputFormat?: "jpeg" | "png" | "webp";
}) {
  const apiKey = process.env.NOVITA_API_KEY;

  if (!apiKey) {
    throw new Error("NOVITA_API_KEY is not configured");
  }

  const finalPrompt = `${BASE_PHOTO_EDIT_PROMPT}\n${prompt}`.trim();
  const response = await fetch(
    process.env.NOVITA_QWEN_IMAGE_EDIT_ENDPOINT ||
      DEFAULT_NOVITA_QWEN_IMAGE_EDIT_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        image: base64Image,
        seed: -1,
        output_format: outputFormat,
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
      throw new Error(latest.task?.reason || "Novita image edit failed");
    }

    await sleep(intervalMs);
  }

  return {
    status: "submitted",
    imageUrl: null,
    response: latest,
  };
}
