const DEFAULT_RUNPOD_ENDPOINT_ID = "hvn0uutfoq4cbj";

function withoutRunSuffix(value: string) {
  return value.replace(/\/+$/, "").replace(/\/run$/i, "");
}

function runpodOperationUrl(operation: "health" | "run", endpointIdOverride?: string) {
  const endpointUrl = process.env.RUNPOD_ENDPOINT_URL?.trim();
  const endpointId =
    endpointIdOverride?.trim() ||
    process.env.RUNPOD_ENDPOINT_ID?.trim() ||
    DEFAULT_RUNPOD_ENDPOINT_ID;

  if (endpointIdOverride) {
    return `https://api.runpod.ai/v2/${endpointId}/${operation}`;
  }

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

function runpodErrorMessage(
  operation: "health check" | "job submission",
  status: number,
  data: Record<string, unknown>,
) {
  const resetSafetyNote =
    operation === "health check" ? " No album AI data was deleted." : "";

  if (status === 404) {
    return `Configured RunPod endpoint was not found. Verify RUNPOD_ENDPOINT_ID and confirm it is an active queue-based Serverless endpoint.${resetSafetyNote}`;
  }

  if (status === 401 || status === 403) {
    return `RunPod rejected the configured API key. Verify RUNPOD_API_KEY.${resetSafetyNote}`;
  }

  return typeof data.error === "string"
    ? data.error
    : `RunPod ${operation} failed (${status})`;
}

export async function checkRunpodEndpoint(endpointId?: string) {
  const apiKey = runpodApiKey();
  const url = runpodOperationUrl("health", endpointId);
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
    throw new Error(runpodErrorMessage("health check", response.status, data));
  }

  return data;
}
export async function submitRunpodJob(input: Record<string, unknown>, endpointId?: string) {
  const apiKey = runpodApiKey();
  const url = runpodOperationUrl("run", endpointId);
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
    throw new Error(runpodErrorMessage("job submission", response.status, data));
  }

  return data;
}
