# Google authentication and photo imports

The app uses two separate Google authorization paths:

- **Google login** uses Supabase Auth to create the app session.
- **Google Drive and Google Photos imports** request short-lived, picker-specific
  Google access tokens in the browser.

Keeping picker grants separate means signing in does not automatically grant
access to Drive or Photos. Import tokens stay in browser memory and are not
stored by the app.

## Where import buttons appear

Google Drive and Google Photos import controls appear in every full-photo
selection workflow:

- The standalone **Upload Photos** page at `/upload`
- **Manage Events**, below the media drop zone for new and existing events
- **Collage**, in the source controls beside **Upload from Device**

Selected images enter the same local `File` queue used by each screen.
Single-image album, event, and customer cover editors remain device-only because
they use separate cover-upload endpoints.

## Supabase Google login

In the Supabase dashboard, open:

```text
Authentication -> Providers -> Google
```

Enable Google and enter the Web application OAuth client ID and client secret.
Copy the Supabase callback URL:

```text
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

Add that URL to the Google OAuth client's **Authorized redirect URIs**.

The app already starts Google login through Supabase and returns to:

```text
http://localhost:3000/auth/callback
```

Add the local app URL to the Supabase project's allowed redirect URLs.

## Google Cloud APIs and scopes

Enable these APIs in the same Google Cloud project:

- Google Drive API
- Google Picker API
- Google Photos Picker API

Configure the OAuth consent screen with only the picker scopes the app uses:

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/photospicker.mediaitems.readonly
```

The implementation does not request `drive.readonly`, `drive`, or the Google
Photos Library API scopes.

If the External OAuth app is still in testing mode, add each developer/test
Google account under **OAuth consent screen -> Test users**.

Add this OAuth client's authorized JavaScript origin for local development:

```text
http://localhost:3000
```

The following local redirect URI can remain registered, but the browser picker
token flows do not invoke it:

```text
http://localhost:3000/api/auth/callback/google
```

## Google Drive Picker

Create a browser API key for Drive Picker. Restrict its HTTP referrer to:

```text
http://localhost:3000/*
```

Restrict the key to the Google Picker API and Google Drive API. Also find the
Google Cloud project's numeric **project number**. Picker calls this the App ID;
it is not the project ID string.

Drive Picker displays image files and folders. Selected Drive files are
downloaded through the Drive API. Selected folders are scanned recursively for
image files, converted to `File` objects, and added to the existing upload
queue.

Users can also paste a public Google Drive folder link in the upload controls.
The folder must be shared as **Anyone with the link -> Viewer**. Public link
imports use the browser API key to list and download image files from the shared
folder, without requesting broader Drive OAuth scopes.

## Google Photos Picker

Google Photos uses a separate session-based Picker API:

```text
https://photospicker.googleapis.com/v1
```

1. The app requests the `photospicker.mediaitems.readonly` scope.
2. The app creates a Picker session.
3. The user clicks **Continue in Google Photos** to open the session's
   `pickerUri`.
4. The app polls the session using Google's recommended interval.
5. The app lists, downloads, and queues the selected images.
6. The app deletes the Picker session.

Google Photos Picker can display photos and videos. The current app upload API
supports images only, so selected videos are reported and skipped.

The Google account active in the Photos picker window must match the account
that authorized the Photos Picker scope.

The production build runs `pnpm verify:google-photos-picker` and fails if app
source code introduces the old Google Photos Library API hostname or scopes.

## Environment

Add these public browser credential values to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY=your-restricted-browser-api-key
NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID=your-numeric-google-cloud-project-number
NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
```

The same Web application OAuth client ID can be used for Drive and Photos. For
compatibility, both integrations fall back to the existing
`NEXT_PUBLIC_OAUTH_CLIENT_ID`. OAuth client secrets must never use a
`NEXT_PUBLIC_` environment variable or be shipped to the browser.

## OAuth branding verification

Use the exact application name **SaathiDesk** throughout the Google OAuth
consent screen and public website.

Verify ownership of `saathidesk.com` by adding it as a **Domain** property in
Google Search Console and publishing Google's TXT verification record through
the domain's DNS provider.

Use these deployed public URLs in the OAuth consent screen:

```text
Application homepage: https://saathidesk.com
Privacy policy:       https://saathidesk.com/legal/privacy-policy
Terms of service:     https://saathidesk.com/legal/terms-of-service
```

Deploy the updated branding and legal pages before requesting branding
reverification in Google Cloud Console.
