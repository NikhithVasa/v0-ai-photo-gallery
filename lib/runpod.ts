const DEFAULT_RUNPOD_ENDPOINT =
  "https://api.runpod.ai/v2/lnqoy8xpzigzv0/run";

export async function submitRunpodJob(input: Record<string, unknown>) {
  const apiKey = process.env.RUNPOD_API_KEY;

  if (!apiKey) {
    throw new Error("RUNPOD_API_KEY is not configured");
  }

  const response = await fetch(
    process.env.RUNPOD_ENDPOINT_URL || DEFAULT_RUNPOD_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input }),
    }
  );

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : `RunPod request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}
