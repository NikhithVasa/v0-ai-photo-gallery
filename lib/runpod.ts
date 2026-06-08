const DEFAULT_RUNPOD_ENDPOINT_ID = "hvn0uutfoq4cbj";

function withoutRunSuffix(value: string) {
  return value.replace(/\/+$/, "").replace(/\/run$/i, "");
}

function runpodOperationUrl(operation: "health" | "run") {
  const endpointUrl = process.env.RUNPOD_ENDPOINT_URL?.trim();
  const endpointId =
    process.env.RUNPOD_ENDPOINT_ID?.trim() || DEFAULT_RUNPOD_ENDPOINT_ID;

  if (endpointUrl) {
    if (/^https?:\/\//i.test(endpointUrl)) {
      const url = new URL(endpointUrl);
      url.pathname = `${withoutRunSuffix(url.pathname)}/${operation}`;
      return url.toString();
    }

    const path = withoutRunSuffix(endpointUrl).replace(/^\/+|\/+$/g, "");
    return `https://api.runpod.ai/v2/${path}/${operation}`;
  }

  return `https://api.runpod.ai/v2/${endpointId}/${operation}`;
}

function runpodApiKey() {
  const apiKey = process.env.RUNPOD_API_KEY;

  if (!apiKey) {
    throw new Error("RUNPOD_API_KEY is not configured");
  }

  return apiKey;
}

export async function checkRunpodEndpoint() {
  const apiKey = runpodApiKey();
  const url = runpodOperationUrl("health");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : `RunPod health check failed (${response.status})`;
    throw new Error(`${message}: ${url}`);
  }

  return data;
}

export async function submitRunpodJob(input: Record<string, unknown>) {
  const apiKey = runpodApiKey();
  const url = runpodOperationUrl("run");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : `RunPod request failed (${response.status})`;
    throw new Error(`${message}: ${url}`);
  }

  return data;
}
