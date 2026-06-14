import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "How SaathiDesk collects, uses, stores, and protects personal information and Google user data.",
  path: "/legal/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="June 4, 2026"
      description="This Privacy Policy explains how SaathiDesk collects, uses, stores, and shares information when you use our private photo gallery, upload, search, editing, collage, and sharing services."
    >
      <section>
        <h2>Information we collect</h2>
        <p>We may collect the following categories of information:</p>
        <ul>
          <li>
            Account information, such as your name, email address, profile
            image, authentication provider, and account identifiers.
          </li>
          <li>
            Photos, file metadata, album information, captions, search data,
            sharing settings, and other content you upload or create.
          </li>
          <li>
            Technical and usage information needed to operate, secure, and
            improve the service, such as browser information, request logs, and
            error diagnostics.
          </li>
        </ul>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          If you choose Google Sign-In, we receive basic account information
          made available through Google and use it to authenticate you and
          maintain your SaathiDesk account.
        </p>
        <p>
          If you choose <strong>Upload from Google Drive</strong>, SaathiDesk uses
          Google Drive Picker with the{" "}
          <code>https://www.googleapis.com/auth/drive.file</code> scope. We
          access only the files you explicitly select through the picker,
          including their file identifiers, names, MIME types, metadata, and
          contents needed to import them.
        </p>
        <p>
          If you choose <strong>Upload from Google Photos</strong>, SaathiDesk uses
          the Google Photos Picker API with the{" "}
          <code>
            https://www.googleapis.com/auth/photospicker.mediaitems.readonly
          </code>{" "}
          scope. We access only media items you explicitly select in the Photos
          Picker. SaathiDesk does not use the legacy Google Photos Library API to
          browse your full photo library.
        </p>
        <p>
          Google Drive and Google Photos access tokens are short-lived and kept
          in browser memory for the import process. SaathiDesk does not store these
          picker access tokens. Selected files become normal uploads after you
          import them and are then handled as described in this policy.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Authenticate users and provide authorized gallery access.</li>
          <li>
            Store, organize, display, search, edit, download, and share photos
            according to user and gallery-owner instructions.
          </li>
          <li>
            Generate previews, thumbnails, captions, face groupings, search
            indexes, AI edits, and collage outputs.
          </li>
          <li>Maintain, troubleshoot, protect, and improve the service.</li>
          <li>Comply with legal obligations and enforce our terms.</li>
        </ul>
      </section>

      <section>
        <h2>Google API Limited Use</h2>
        <p>
          SaathiDesk&apos;s use and transfer of information received from Google
          APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          We do not sell Google user data, use it for advertising, or transfer
          it except as necessary to provide or secure user-requested features,
          comply with law, or as otherwise permitted by that policy. Humans do
          not read Google user data except with your affirmative permission,
          when necessary for security or support, to comply with law, or when
          the data has been aggregated and anonymized for internal operations.
        </p>
      </section>

      <section>
        <h2>How information is shared</h2>
        <p>
          We may share information with service providers that help us operate
          SaathiDesk, such as authentication, hosting, database, storage, and
          infrastructure providers. These providers may process information
          only to perform services for us under appropriate obligations.
        </p>
        <p>
          Content may also be shared with gallery owners, authorized gallery
          users, or recipients of share links according to the permissions and
          settings selected in the service. We may disclose information when
          required by law or necessary to protect users, SaathiDesk, or others.
        </p>
        <p>We do not sell personal information or Google user data.</p>
      </section>

      <section>
        <h2>Storage, retention, and deletion</h2>
        <p>
          Uploaded photos and generated derivatives may be stored in
          app-managed cloud storage and databases until they are deleted by an
          authorized user, the associated gallery is removed, or they are no
          longer needed to provide the service. Security and operational logs
          may be retained for a reasonable period.
        </p>
        <p>
          You can remove photos using available gallery controls. To request
          deletion of your account or personal information, email{" "}
          <a href="mailto:support@saathidesk.com">support@saathidesk.com</a>. You
          can revoke SaathiDesk&apos;s Google access at any time from your Google
          Account permissions.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational
          safeguards designed to protect information. No method of storage or
          transmission is completely secure, so we cannot guarantee absolute
          security.
        </p>
      </section>

      <section>
        <h2>Children&apos;s privacy</h2>
        <p>
          SaathiDesk is not directed to children under 13, and we do not knowingly
          collect personal information directly from children under 13. Contact
          us if you believe a child has provided personal information.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy as the service or legal requirements
          change. We will post the updated policy here and revise the date
          above. Questions or privacy requests can be sent to{" "}
          <a href="mailto:support@saathidesk.com">support@saathidesk.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
