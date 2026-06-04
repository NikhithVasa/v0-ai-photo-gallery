"use client";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_API_SCRIPT = "https://apis.google.com/js/api.js";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

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
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleDrivePickerResult {
  accessToken: string;
  files: GoogleDriveFileMetadata[];
}

export interface DownloadedGoogleDriveFile {
  file: File;
  metadata: GoogleDriveFileMetadata;
}

interface DriveApiFileResponse {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  capabilities?: {
    canDownload?: boolean;
  };
}

let librariesPromise: Promise<GoogleBrowserApi> | null = null;
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

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
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
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
              name: document.name || "Google Drive image",
              mimeType: document.mimeType || "application/octet-stream",
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

async function driveApiFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
      // Drive can return an empty or non-JSON error body.
    }

    throw new Error(detail || `Google Drive request failed (${response.status})`);
  }

  return response;
}

export async function pickGoogleDriveImages(): Promise<GoogleDrivePickerResult> {
  const config = getGoogleDriveConfig();
  const googleApi = await loadGoogleLibraries();
  const accessToken = await requestDriveAccessToken(googleApi, config.clientId);
  const files = await openDrivePicker(
    googleApi,
    accessToken,
    config.apiKey,
    config.appId,
  );

  return { accessToken, files };
}

export async function prepareGoogleDrivePicker() {
  getGoogleDriveConfig();
  await loadGoogleLibraries();
}

export async function downloadGoogleDriveImage(
  selectedFile: GoogleDriveFileMetadata,
  accessToken: string,
): Promise<DownloadedGoogleDriveFile> {
  const metadataParams = new URLSearchParams({
    fields:
      "id,name,mimeType,size,modifiedTime,webViewLink,capabilities(canDownload)",
  });
  const metadataResponse = await driveApiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      selectedFile.id,
    )}?${metadataParams}`,
    accessToken,
  );
  const metadataPayload = (await metadataResponse.json()) as DriveApiFileResponse;
  const metadata: GoogleDriveFileMetadata = {
    id: metadataPayload.id || selectedFile.id,
    name: metadataPayload.name || selectedFile.name,
    mimeType: metadataPayload.mimeType || selectedFile.mimeType,
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
    accessToken,
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
