const DEFAULT_DASHSCOPE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

const DEFAULT_DASHSCOPE_MODEL = "qwen-image-2.0-pro";

export const BASE_PHOTO_EDIT_PROMPT = `
Edit only the provided image.
Preserve the main person's identity, face, outfit, pose, jewelry, and important details unless the user explicitly asks to change them.
Make the edit realistic, natural, high quality, and consistent with the original lighting, shadows, camera angle, and perspective.
Do not add text, watermarks, logos, extra fingers, distorted faces, or unnatural artifacts.
Return a polished final image.
User edit request:
`;

function firstGeneratedImageUrl(data: unknown) {
  const choices = (data as { output?: { choices?: unknown[] } })?.output?.choices;
  const firstChoice = Array.isArray(choices) ? choices[0] : null;
  const content = (firstChoice as { message?: { content?: unknown[] } } | null)
    ?.message?.content;

  if (!Array.isArray(content)) return null;

  for (const item of content) {
    const image = (item as { image?: unknown }).image;
    if (typeof image === "string" && image) return image;
  }

  return null;
}

function dashscopeErrorMessage(data: unknown, status: number) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return [code, message].filter(Boolean).join(": ") || `DashScope request failed (${status})`;
}

export async function editImageWithDashScope({
  imageUrl,
  prompt,
  size,
}: {
  imageUrl: string;
  prompt: string;
  size?: string | null;
}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const finalPrompt = `${BASE_PHOTO_EDIT_PROMPT}\n${prompt}`.trim();
  const response = await fetch(
    process.env.DASHSCOPE_ENDPOINT || DEFAULT_DASHSCOPE_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DASHSCOPE_IMAGE_EDIT_MODEL || DEFAULT_DASHSCOPE_MODEL,
        input: {
          messages: [
            {
              role: "user",
              content: [{ image: imageUrl }, { text: finalPrompt }],
            },
          ],
        },
        parameters: {
          n: 1,
          negative_prompt: " ",
          prompt_extend: true,
          watermark: false,
          ...(size ? { size } : {}),
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(dashscopeErrorMessage(data, response.status));
  }

  const image = firstGeneratedImageUrl(data);
  if (!image) {
    throw new Error("DashScope did not return an edited image URL");
  }

  return {
    imageUrl: image,
    response: data,
    finalPrompt,
  };
}
