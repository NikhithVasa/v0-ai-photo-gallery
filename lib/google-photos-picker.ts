"use client";

const GOOGLE_PHOTOS_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const PHOTOS_PICKER_API = "https://photospicker.googleapis.com/v1";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
}

interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

interface GoogleOAuthApi {
  hasGrantedAllScopes: (
    response: GoogleTokenResponse,
    ...scopes: string[]
  ) => boolean;
  initTokenClient: (config: {
    callback: (response: GoogleTokenResponse) => void;
    client_id: string;
    error_callback: (error: { type?: string }) => void;
    include_granted_scopes: boolean;
    scope: string;
  }) => GoogleTokenClient;
}

interface GooglePhotosPickerSession {
  id?: string;
  pickerUri?: string;
  expireTime?: string;
  mediaItemsSet?: boolean;
  pollingConfig?: {
    pollInterval?: string;
    timeoutIn?: string;
  };
}

export interface GooglePhotosMediaItem {
  id: string;
  createTime?: string;
  type: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
  };
}

export interface GooglePhotosPickerResult {
  accessToken: string;
  sessionId: string;
  mediaItems: GooglePhotosMediaItem[];
}

export interface GooglePhotosPickerSessionHandle {
  accessToken: string;
  session: GooglePhotosPickerSession;
}

export interface DownloadedGooglePhotosFile {
  file: File;
  metadata: GooglePhotosMediaItem;
}

interface GooglePhotosMediaItemsResponse {
  mediaItems?: Array<{
    id?: string;
    createTime?: string;
    type?: "PHOTO" | "VIDEO" | "TYPE_UNSPECIFIED";
    mediaFile?: {
      baseUrl?: string;
      mimeType?: string;
      filename?: string;
    };
  }>;
  nextPageToken?: string;
}

let identityLibraryPromise: Promise<GoogleOAuthApi> | null = null;
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function getGooglePhotosClientId() {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google Photos Picker is missing NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID");
  }

  return clientId;
}

function getGoogleOAuthApi() {
  return window.google?.accounts?.oauth2 as GoogleOAuthApi | undefined;
}

function loadIdentityLibrary() {
  if (identityLibraryPromise) return identityLibraryPromise;

  identityLibraryPromise = new Promise<GoogleOAuthApi>((resolve, reject) => {
    const loadedApi = getGoogleOAuthApi();
    if (loadedApi) {
      resolve(loadedApi);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`,
    );
    const script = existing || document.createElement("script");
    const handleLoad = () => {
      script.dataset.loaded = "true";
      const api = getGoogleOAuthApi();
      if (api) resolve(api);
      else reject(new Error("Google authorization library did not initialize"));
    };
    const handleError = () =>
      reject(new Error("Google authorization library could not be loaded"));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    identityLibraryPromise = null;
    throw error;
  });

  return identityLibraryPromise;
}

async function requestGooglePhotosAccessToken(clientId: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const oauthApi = await loadIdentityLibrary();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauthApi.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_PHOTOS_SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !oauthApi.hasGrantedAllScopes(response, GOOGLE_PHOTOS_SCOPE)
        ) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Google Photos access was not granted",
            ),
          );
          return;
        }

        cachedAccessToken = {
          value: response.access_token,
          expiresAt: Date.now() + Math.max(response.expires_in || 3600, 60) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Google Photos authorization was cancelled"
              : "Google Photos authorization could not be opened",
          ),
        );
      },
    });

    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function photosPickerFetch(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(`${PHOTOS_PICKER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      detail = payload.error?.message || "";
    } catch {
      // The Picker API can return an empty or non-JSON error body.
    }

    throw new Error(detail || `Google Photos Picker request failed (${response.status})`);
  }

  return response;
}

function durationToMilliseconds(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.max(seconds * 1000, 250) : fallback;
}

async function createPickerSession(accessToken: string) {
  const response = await photosPickerFetch("/sessions", accessToken, {
    method: "POST",
    body: JSON.stringify({
      pickingConfig: {
        maxItemCount: "200",
      },
    }),
  });
  const session = (await response.json()) as GooglePhotosPickerSession;

  if (!session.id || !session.pickerUri) {
    throw new Error("Google Photos Picker did not create a valid session");
  }

  return session;
}

const PICKER_WINDOW_FEATURES =
  "popup=yes,width=1100,height=760,resizable=yes,scrollbars=yes";

function pickerAutocloseUri(pickerUri: string) {
  const separator = pickerUri.endsWith("/") ? "" : "/";
  return `${pickerUri}${separator}autoclose`;
}

export function openGooglePhotosPickerPlaceholder() {
  const pickerWindow = window.open(
    "about:blank",
    "google-photos-picker",
    PICKER_WINDOW_FEATURES,
  );

  if (!pickerWindow) {
    throw new Error(
      "Google Photos Picker popup was blocked. Allow popups for this site and try again.",
    );
  }

  try {
    pickerWindow.document.title = "Google Photos";
    pickerWindow.document.body.style.fontFamily =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    pickerWindow.document.body.style.margin = "0";
    pickerWindow.document.body.innerHTML =
      "<main style=\"min-height:100vh;display:flex;align-items:center;justify-content:center;color:#3f3f46;background:#fafafa;\"><p>Preparing Google Photos...</p></main>";
  } catch {
    // The picker can still navigate even if the placeholder content cannot be written.
  }

  pickerWindow.focus();
  return pickerWindow;
}

function openPickerWindow(pickerUri: string, pickerWindow?: Window | null) {
  const pickerUrl = pickerAutocloseUri(pickerUri);

  if (pickerWindow && !pickerWindow.closed) {
    pickerWindow.location.href = pickerUrl;
    pickerWindow.focus();
    return pickerWindow;
  }

  const openedWindow = window.open(
    pickerUrl,
    "google-photos-picker",
    PICKER_WINDOW_FEATURES,
  );

  if (!openedWindow) {
    throw new Error(
      "Google Photos Picker popup was blocked. Allow popups for this site and try again.",
    );
  }

  openedWindow.focus();
  return openedWindow;
}

async function waitForSelection(
  session: GooglePhotosPickerSession,
  accessToken: string,
  pickerWindow: Window,
) {
  const initialTimeout = durationToMilliseconds(
    session.pollingConfig?.timeoutIn,
    10 * 60 * 1000,
  );
  const deadline = Date.now() + initialTimeout;
  let currentSession = session;
  let closedPollCount = 0;

  while (Date.now() < deadline) {
    const pollInterval = durationToMilliseconds(
      currentSession.pollingConfig?.pollInterval,
      2000,
    );
    await new Promise((resolve) => window.setTimeout(resolve, pollInterval));

    const response = await photosPickerFetch(
      `/sessions/${encodeURIComponent(session.id as string)}`,
      accessToken,
    );
    currentSession = (await response.json()) as GooglePhotosPickerSession;

    if (currentSession.mediaItemsSet) return;
    if (pickerWindow.closed) {
      closedPollCount += 1;
      if (closedPollCount >= 3) {
        throw new Error("No Google Photos items were selected.");
      }
    } else {
      closedPollCount = 0;
    }
  }

  throw new Error("Google Photos selection timed out.");
}

async function listSelectedMediaItems(sessionId: string, accessToken: string) {
  const mediaItems: GooglePhotosMediaItem[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      sessionId,
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await photosPickerFetch(
      `/mediaItems?${params.toString()}`,
      accessToken,
    );
    const payload = (await response.json()) as GooglePhotosMediaItemsResponse;

    for (const item of payload.mediaItems || []) {
      if (
        !item.id ||
        !item.mediaFile?.baseUrl ||
        !item.mediaFile.mimeType ||
        !item.mediaFile.filename
      ) {
        continue;
      }

      mediaItems.push({
        id: item.id,
        createTime: item.createTime,
        type: item.type || "TYPE_UNSPECIFIED",
        mediaFile: {
          baseUrl: item.mediaFile.baseUrl,
          mimeType: item.mediaFile.mimeType,
          filename: item.mediaFile.filename,
        },
      });
    }

    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return mediaItems;
}

export async function prepareGooglePhotosPicker() {
  getGooglePhotosClientId();
  await loadIdentityLibrary();
}

export async function createGooglePhotosPickerSession(): Promise<GooglePhotosPickerSessionHandle> {
  const clientId = getGooglePhotosClientId();
  const accessToken = await requestGooglePhotosAccessToken(clientId);
  const session = await createPickerSession(accessToken);

  return { accessToken, session };
}

export async function completeGooglePhotosPickerSession(
  handle: GooglePhotosPickerSessionHandle,
  pickerWindow?: Window | null,
): Promise<GooglePhotosPickerResult> {
  const sessionId = handle.session.id as string;
  const activePickerWindow = openPickerWindow(
    handle.session.pickerUri as string,
    pickerWindow,
  );

  try {
    await waitForSelection(
      handle.session,
      handle.accessToken,
      activePickerWindow,
    );
    const mediaItems = await listSelectedMediaItems(sessionId, handle.accessToken);

    return {
      accessToken: handle.accessToken,
      sessionId,
      mediaItems,
    };
  } catch (error) {
    await deleteGooglePhotosPickerSession(sessionId, handle.accessToken).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function downloadGooglePhotosImage(
  mediaItem: GooglePhotosMediaItem,
  accessToken: string,
): Promise<DownloadedGooglePhotosFile> {
  if (!mediaItem.mediaFile.mimeType.startsWith("image/")) {
    throw new Error(`${mediaItem.mediaFile.filename} is not an image`);
  }

  const response = await fetch(`${mediaItem.mediaFile.baseUrl}=d`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not download ${mediaItem.mediaFile.filename} (${response.status})`,
    );
  }

  const blob = await response.blob();
  const lastModified = mediaItem.createTime
    ? new Date(mediaItem.createTime).getTime()
    : Date.now();

  return {
    metadata: mediaItem,
    file: new File([blob], mediaItem.mediaFile.filename, {
      type: mediaItem.mediaFile.mimeType || blob.type,
      lastModified,
    }),
  };
}

export async function deleteGooglePhotosPickerSession(
  sessionId: string,
  accessToken: string,
) {
  await photosPickerFetch(
    `/sessions/${encodeURIComponent(sessionId)}`,
    accessToken,
    { method: "DELETE" },
  );
}
