# Google Drive Picker setup

The upload screen uses Google Identity Services and Google Drive Picker to let a
user explicitly select image files. It requests only:

```text
https://www.googleapis.com/auth/drive.file
```

Selected images are downloaded from Drive in the browser, converted to normal
`File` objects, and passed into the existing upload queue. The short-lived Drive
access token stays in browser memory and is not stored by the app.

## Google Cloud

Use the same Google Cloud project for all three credentials/settings below:

1. Enable **Google Picker API** and **Google Drive API**.
2. Use a **Web application** OAuth client ID.
3. Add this authorized JavaScript origin for local development:

   ```text
   http://localhost:3000
   ```

4. The following redirect URI can remain registered:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

   Picker uses Google's browser token popup flow, so this feature does not
   invoke the redirect URI or use the downloaded OAuth client secret.

5. Create a browser API key for Picker. Restrict its HTTP referrer to
   `http://localhost:3000/*` and restrict the key to the Google Picker API.
6. Find the project's numeric **project number**. Picker calls this the App ID;
   it is not the project ID string.

## Environment

Add these values to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY=your-restricted-browser-api-key
NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID=your-numeric-google-cloud-project-number
```

For compatibility, the app also accepts the existing
`NEXT_PUBLIC_OAUTH_CLIENT_ID` as the Drive client ID. The dedicated
`NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` name is preferred.

Google Photos is not part of this implementation. It requires a separate Google
Photos Picker integration and the
`https://www.googleapis.com/auth/photospicker.mediaitems.readonly` scope.
