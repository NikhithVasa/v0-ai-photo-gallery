"use client";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_API_SCRIPT = "https://apis.google.com/js/api.js";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_API_RETRY_DELAYS_MS = [500, 1_000, 2_000];
const DRIVE_FOLDER_LIST_CONCURRENCY = 4;
const DRIVE_API_RETRYABLE_STATUSES = new Set([
  408,
  409,
  425,
  429,
  500,
  502,
  503,
  504,
]);

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  scope?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

interface PickerDocument {
  id?: string;
  name?: string;
  mimeType?: string;
  resourceKey?: string;
  sizeBytes?: number;
  url?: string;
}

interface PickerCallbackData {
  action?: string;
  docs?: PickerDocument[];
}

interface PickerView {
  setIncludeFolders: (included: boolean) => PickerView;
  setMode: (mode: string) => PickerView;
  setSelectFolderEnabled: (enabled: boolean) => PickerView;
}

interface Picker {
  setVisible: (visible: boolean) => void;
}

interface PickerBuilder {
  addView: (view: PickerView) => PickerBuilder;
  build: () => Picker;
  enableFeature: (feature: string) => PickerBuilder;
  setAppId: (appId: string) => PickerBuilder;
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder;
  setDeveloperKey: (developerKey: string) => PickerBuilder;
  setOAuthToken: (accessToken: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
}

interface GoogleBrowserApi {
  accounts: {
    oauth2: {
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
    };
  };
  picker: {
    Action: {
      CANCEL: string;
      PICKED: string;
    };
    DocsView: new (viewId: string) => PickerView;
    DocsViewMode: {
      LIST: string;
    };
    Feature: {
      MULTISELECT_ENABLED: string;
    };
    PickerBuilder: new () => PickerBuilder;
    ViewId: {
      DOCS_IMAGES: string;
    };
  };
}

declare global {
  interface Window {
    gapi?: {
      load: (
        api: string,
        config:
          | (() => void)
          | {
              callback: () => void;
              onerror: () => void;
              timeout: number;
              ontimeout: () => void;
            },
      ) => void;
    };
    google?: GoogleBrowserApi;
  }
}

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  resourceKey?: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleDriveSelectionSummary {
  folderCount: number;
  imageCount: number;
}

export interface GoogleDrivePickerResult {
  accessToken: string;
  files: GoogleDriveFileMetadata[];
  summary: GoogleDriveSelectionSummary;
}

export interface GoogleDrivePublicFolderResult {
  apiKey: string;
  folder: GoogleDriveFileMetadata;
  files: GoogleDriveFileMetadata[];
  summary: GoogleDriveSelectionSummary;
}

export interface DownloadedGoogleDriveFile {
  file: File;
  metadata: GoogleDriveFileMetadata;
}

interface DriveApiCredentials {
  accessToken?: string;
  apiKey?: string;
}

interface DriveApiFileResponse {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  resourceKey?: string;
  webViewLink?: string;
  capabilities?: {
    canDownload?: boolean;
  };
}

interface DriveApiFileListResponse {
  nextPageToken?: string;
  files?: DriveApiFileResponse[];
}

let librariesPromise: Promise<GoogleBrowserApi> | null = null;
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

class GoogleDriveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GoogleDriveApiError";
  }
}

function getGoogleDriveConfig() {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID;

  const missing = [
    !clientId && "NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID",
    !apiKey && "NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY",
    !appId && "NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Google Drive Picker is missing ${missing.join(", ")}`);
  }

  return {
    apiKey: apiKey as string,
    appId: appId as string,
    clientId: clientId as string,
  };
}

function getGoogleDriveApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error("Google Drive link import is missing NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY");
  }

  return apiKey;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const handleError = () => reject(new Error(`Could not load ${src}`));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = src;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

async function loadGoogleLibraries() {
  if (librariesPromise) return librariesPromise;

  librariesPromise = (async () => {
    await Promise.all([
      loadScript(GOOGLE_API_SCRIPT),
      loadScript(GOOGLE_IDENTITY_SCRIPT),
    ]);

    if (!window.gapi || !window.google?.accounts?.oauth2) {
      throw new Error("Google authorization libraries did not initialize");
    }

    await new Promise<void>((resolve, reject) => {
      window.gapi?.load("picker", {
        callback: resolve,
        onerror: () => reject(new Error("Google Drive Picker failed to load")),
        timeout: 10_000,
        ontimeout: () => reject(new Error("Google Drive Picker timed out while loading")),
      });
    });

    if (!window.google?.picker) {
      throw new Error("Google Drive Picker did not initialize");
    }

    return window.google;
  })().catch((error) => {
    librariesPromise = null;
    throw error;
  });

  return librariesPromise;
}

async function requestDriveAccessToken(googleApi: GoogleBrowserApi, clientId: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = googleApi.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !googleApi.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_FILE_SCOPE)
        ) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Google Drive access was not granted",
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
              ? "Google authorization was cancelled"
              : "Google authorization could not be opened",
          ),
        );
      },
    });

    // Empty prompt reuses an existing grant and asks for consent only when needed.
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

function openDrivePicker(
  googleApi: GoogleBrowserApi,
  accessToken: string,
  apiKey: string,
  appId: string,
) {
  return new Promise<GoogleDriveFileMetadata[]>((resolve, reject) => {
    const imageView = new googleApi.picker.DocsView(
      googleApi.picker.ViewId.DOCS_IMAGES,
    )
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMode(googleApi.picker.DocsViewMode.LIST);

    try {
      const picker = new googleApi.picker.PickerBuilder()
        .addView(imageView)
        .enableFeature(googleApi.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(appId)
        .setDeveloperKey(apiKey)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setCallback((data) => {
          if (data.action === googleApi.picker.Action.CANCEL) {
            resolve([]);
            return;
          }

          if (data.action !== googleApi.picker.Action.PICKED) return;

          const files = (data.docs || [])
            .filter((document): document is PickerDocument & { id: string } =>
              Boolean(document.id),
            )
            .map((document) => ({
              id: document.id,
              name:
                document.name ||
                (document.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
                  ? "Google Drive folder"
                  : "Google Drive image"),
              mimeType: document.mimeType || "application/octet-stream",
              resourceKey: document.resourceKey || undefined,
              size: document.sizeBytes,
              webViewLink: document.url,
            }));

          resolve(files);
        })
        .build();

      picker.setVisible(true);
    } catch (error) {
      reject(error);
    }
  });
}

function retryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1000;

  const retryAt = new Date(retryAfter).getTime();
  if (Number.isFinite(retryAt)) return Math.max(retryAt - Date.now(), 0);

  return undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableDriveError(error: unknown) {
  return (
    error instanceof GoogleDriveApiError &&
    DRIVE_API_RETRYABLE_STATUSES.has(error.status)
  );
}

function driveResourceKeyHeader(
  fileId?: string,
  resourceKey?: string,
) {
  if (!fileId || !resourceKey) return null;
  return `${fileId}/${resourceKey}`;
}

function driveApiUrl(url: string, credentials: DriveApiCredentials) {
  if (!credentials.apiKey) return url;

  const requestUrl = new URL(url);
  requestUrl.searchParams.set("key", credentials.apiKey);
  return requestUrl.toString();
}

function parseGoogleDriveFolderLink(folderLink: string) {
  let url: URL;
  try {
    url = new URL(folderLink.trim());
  } catch {
    throw new Error("Paste a valid Google Drive folder link.");
  }

  if (url.hostname !== "drive.google.com") {
    throw new Error("Paste a Google Drive folder link.");
  }

  const folderMatch = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/);
  const openId = url.pathname === "/open" ? url.searchParams.get("id") : null;
  const id = folderMatch?.[1] || openId;

  if (!id) {
    throw new Error("Paste a Google Drive folder link, not an individual file link.");
  }

  return {
    id,
    resourceKey: url.searchParams.get("resourcekey") || undefined,
  };
}

async function fetchDriveApiOnce(
  url: string,
  credentials: DriveApiCredentials,
  resourceKeyHeader?: string | null,
) {
  const headers: Record<string, string> = {};
  if (credentials.accessToken) headers.Authorization = `Bearer ${credentials.accessToken}`;
  if (resourceKeyHeader) {
    headers["X-Goog-Drive-Resource-Keys"] = resourceKeyHeader;
  }

  const response = await fetch(driveApiUrl(url, credentials), {
    headers,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      detail = payload.error?.message || "";
    } catch {
      // Drive can return an empty or non-JSON error body.
    }

    throw new GoogleDriveApiError(
      detail || `Google Drive request failed (${response.status})`,
      response.status,
      retryAfterMs(response),
    );
  }

  return response;
}

async function driveApiFetch(
  url: string,
  credentials: DriveApiCredentials,
  resourceKeyHeader?: string | null,
) {
  let lastError: unknown;
  const maxAttempts = DRIVE_API_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fetchDriveApiOnce(url, credentials, resourceKeyHeader);
    } catch (error) {
      lastError = error;
      const retryDelay = DRIVE_API_RETRY_DELAYS_MS[attempt];
      const hasAnotherAttempt = retryDelay !== undefined;
      if (!hasAnotherAttempt || !isRetryableDriveError(error)) {
        throw error;
      }

      const delay =
        error instanceof GoogleDriveApiError && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : retryDelay;
      await wait(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Google Drive request failed");
}

function isGoogleDriveFolder(file: GoogleDriveFileMetadata) {
  return file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE;
}

function isGoogleDriveImage(file: GoogleDriveFileMetadata) {
  return file.mimeType.startsWith("image/");
}

function driveApiMetadataFromResponse(
  file: DriveApiFileResponse,
  fallback?: GoogleDriveFileMetadata,
): GoogleDriveFileMetadata {
  return {
    id: file.id || fallback?.id || "",
    name: file.name || fallback?.name || "Google Drive file",
    mimeType: file.mimeType || fallback?.mimeType || "application/octet-stream",
    resourceKey: file.resourceKey || fallback?.resourceKey,
    size: file.size ? Number(file.size) : fallback?.size,
    modifiedTime: file.modifiedTime || fallback?.modifiedTime,
    webViewLink: file.webViewLink || fallback?.webViewLink,
  };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listGoogleDriveFolderChildren(
  folder: GoogleDriveFileMetadata,
  credentials: DriveApiCredentials,
) {
  const files: GoogleDriveFileMetadata[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      fields:
        "nextPageToken,files(id,name,mimeType,resourceKey,size,modifiedTime,webViewLink,capabilities(canDownload))",
      pageSize: "1000",
      q: `'${escapeDriveQueryValue(folder.id)}' in parents and trashed = false`,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveApiFetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      credentials,
      driveResourceKeyHeader(folder.id, folder.resourceKey),
    );
    const payload = (await response.json()) as DriveApiFileListResponse;

    for (const file of payload.files || []) {
      const metadata = driveApiMetadataFromResponse(file);
      if (!metadata.id) continue;
      if (isGoogleDriveImage(metadata) || isGoogleDriveFolder(metadata)) {
        files.push(metadata);
      }
    }

    pageToken = payload.nextPageToken;
  } while (pageToken);

  return files;
}

async function expandGoogleDriveSelection(
  selectedFiles: GoogleDriveFileMetadata[],
  credentials: DriveApiCredentials,
): Promise<{
  files: GoogleDriveFileMetadata[];
  summary: GoogleDriveSelectionSummary;
}> {
  const images: GoogleDriveFileMetadata[] = [];
  const folderQueue = selectedFiles.filter(isGoogleDriveFolder);
  const queuedFolders = new Set(folderQueue.map((folder) => folder.id));
  const seenImages = new Set<string>();
  const seenFolders = new Set<string>();
  let folderCount = queuedFolders.size;

  for (const selectedFile of selectedFiles) {
    if (!isGoogleDriveImage(selectedFile) || seenImages.has(selectedFile.id)) {
      continue;
    }

    seenImages.add(selectedFile.id);
    images.push(selectedFile);
  }

  while (folderQueue.length) {
    const folderBatch = folderQueue.splice(0, DRIVE_FOLDER_LIST_CONCURRENCY);
    const childBatches = await Promise.all(
      folderBatch.map(async (folder) => {
        if (seenFolders.has(folder.id)) return [];
        seenFolders.add(folder.id);
        return listGoogleDriveFolderChildren(folder, credentials);
      }),
    );

    for (const children of childBatches) {
      for (const child of children) {
        if (isGoogleDriveFolder(child)) {
          if (!seenFolders.has(child.id) && !queuedFolders.has(child.id)) {
            queuedFolders.add(child.id);
            folderQueue.push(child);
            folderCount += 1;
          }
          continue;
        }

        if (isGoogleDriveImage(child) && !seenImages.has(child.id)) {
          seenImages.add(child.id);
          images.push(child);
        }
      }
    }
  }

  return {
    files: images,
    summary: {
      folderCount,
      imageCount: images.length,
    },
  };
}

export async function pickGoogleDriveImages(): Promise<GoogleDrivePickerResult> {
  const config = getGoogleDriveConfig();
  const googleApi = await loadGoogleLibraries();
  const accessToken = await requestDriveAccessToken(googleApi, config.clientId);
  const selectedFiles = await openDrivePicker(
    googleApi,
    accessToken,
    config.apiKey,
    config.appId,
  );
  const expandedSelection = await expandGoogleDriveSelection(
    selectedFiles,
    { accessToken },
  );

  return { accessToken, ...expandedSelection };
}

export async function importPublicGoogleDriveFolder(
  folderLink: string,
): Promise<GoogleDrivePublicFolderResult> {
  const apiKey = getGoogleDriveApiKey();
  const parsedFolder = parseGoogleDriveFolderLink(folderLink);
  const metadataParams = new URLSearchParams({
    fields: "id,name,mimeType,resourceKey,webViewLink",
    supportsAllDrives: "true",
  });
  const metadataResponse = await driveApiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      parsedFolder.id,
    )}?${metadataParams}`,
    { apiKey },
    driveResourceKeyHeader(parsedFolder.id, parsedFolder.resourceKey),
  );
  const metadataPayload = (await metadataResponse.json()) as DriveApiFileResponse;
  const folder = driveApiMetadataFromResponse(metadataPayload, {
    id: parsedFolder.id,
    name: "Google Drive folder",
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    resourceKey: parsedFolder.resourceKey,
  });

  if (!isGoogleDriveFolder(folder)) {
    throw new Error("Paste a Google Drive folder link, not an individual file link.");
  }

  const expandedSelection = await expandGoogleDriveSelection([folder], { apiKey });
  return { apiKey, folder, ...expandedSelection };
}

export async function prepareGoogleDrivePicker() {
  getGoogleDriveConfig();
  await loadGoogleLibraries();
}

async function downloadGoogleDriveImageWithCredentials(
  selectedFile: GoogleDriveFileMetadata,
  credentials: DriveApiCredentials,
): Promise<DownloadedGoogleDriveFile> {
  const metadataParams = new URLSearchParams({
    fields:
      "id,name,mimeType,resourceKey,size,modifiedTime,webViewLink,capabilities(canDownload)",
  });
  const metadataResponse = await driveApiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      selectedFile.id,
    )}?${metadataParams}`,
    credentials,
    driveResourceKeyHeader(selectedFile.id, selectedFile.resourceKey),
  );
  const metadataPayload = (await metadataResponse.json()) as DriveApiFileResponse;
  const metadata: GoogleDriveFileMetadata = {
    id: metadataPayload.id || selectedFile.id,
    name: metadataPayload.name || selectedFile.name,
    mimeType: metadataPayload.mimeType || selectedFile.mimeType,
    resourceKey: metadataPayload.resourceKey || selectedFile.resourceKey,
    size: metadataPayload.size ? Number(metadataPayload.size) : selectedFile.size,
    modifiedTime: metadataPayload.modifiedTime,
    webViewLink: metadataPayload.webViewLink || selectedFile.webViewLink,
  };

  if (!metadata.mimeType.startsWith("image/")) {
    throw new Error(`${metadata.name} is not an image`);
  }

  if (metadataPayload.capabilities?.canDownload === false) {
    throw new Error(`${metadata.name} cannot be downloaded`);
  }

  const contentResponse = await driveApiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      metadata.id,
    )}?alt=media`,
    credentials,
    driveResourceKeyHeader(metadata.id, metadata.resourceKey),
  );
  const blob = await contentResponse.blob();
  const lastModified = metadata.modifiedTime
    ? new Date(metadata.modifiedTime).getTime()
    : Date.now();

  return {
    metadata,
    file: new File([blob], metadata.name, {
      type: metadata.mimeType || blob.type,
      lastModified,
    }),
  };
}

export async function downloadGoogleDriveImage(
  selectedFile: GoogleDriveFileMetadata,
  accessToken: string,
) {
  return downloadGoogleDriveImageWithCredentials(selectedFile, { accessToken });
}

export async function downloadPublicGoogleDriveImage(
  selectedFile: GoogleDriveFileMetadata,
  apiKey: string,
) {
  return downloadGoogleDriveImageWithCredentials(selectedFile, { apiKey });
}
