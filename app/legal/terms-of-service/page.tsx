import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service",
  description: `Terms governing use of ${SITE_NAME}.`,
  path: "/legal/terms-of-service",
});

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="June 4, 2026"
      description={`These Terms of Service govern your access to and use of ${SITE_NAME}. By using the service, you agree to these terms.`}
    >
      <section>
        <h2>Using {SITE_NAME}</h2>
        <p>
          You may use {SITE_NAME} only in compliance with these terms and applicable
          law. You must be legally capable of entering into these terms. If you
          use {SITE_NAME} on behalf of an organization, you represent that you have
          authority to bind that organization.
        </p>
      </section>

      <section>
        <h2>Accounts and access</h2>
        <p>
          You are responsible for safeguarding your account credentials,
          passcodes, and share links and for activity performed through them.
          You must provide accurate information and promptly notify us of
          suspected unauthorized access.
        </p>
        <p>
          Gallery owners and administrators control access to their galleries
          and may add, remove, or restrict users and content.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You retain ownership of photos and other content you submit. You grant
          {SITE_NAME} a limited license to host, copy, process, display, transform,
          and distribute that content only as needed to operate and provide the
          service, including previews, search, AI-assisted features, downloads,
          collages, and sharing you authorize.
        </p>
        <p>
          You represent that you have the rights and permissions needed to
          upload and use your content and that doing so does not violate the
          rights of others or applicable law.
        </p>
      </section>

      <section>
        <h2>Google services</h2>
        <p>
          Optional Google Sign-In, Google Drive Picker, and Google Photos Picker
          features are also subject to Google&apos;s applicable terms and
          policies. You choose which Drive files or Photos media items to import.
          Imported files are then treated as content submitted to {SITE_NAME}.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>Use {SITE_NAME} for unlawful, harmful, fraudulent, or abusive activity.</li>
          <li>
            Upload content that infringes intellectual property, privacy,
            publicity, or other rights.
          </li>
          <li>
            Attempt to bypass access controls, probe vulnerabilities, disrupt
            the service, or access another user&apos;s data without permission.
          </li>
          <li>
            Use automated means to overload, scrape, or reverse engineer the
            service except where applicable law expressly permits it.
          </li>
          <li>Distribute malware or interfere with other users.</li>
        </ul>
      </section>

      <section>
        <h2>Service changes and availability</h2>
        <p>
          We may update, add, remove, suspend, or discontinue features. We aim
          to provide a reliable service but do not guarantee uninterrupted,
          error-free, or permanent availability. You are responsible for
          maintaining copies of content you need.
        </p>
      </section>

      <section>
        <h2>Suspension and termination</h2>
        <p>
          You may stop using {SITE_NAME} at any time. We may suspend or terminate
          access when reasonably necessary to protect the service or users,
          address violations, comply with law, or discontinue the service.
          Provisions that by their nature should survive termination will
          survive.
        </p>
      </section>

      <section>
        <h2>Disclaimers</h2>
        <p>
          To the maximum extent permitted by law, {SITE_NAME} is provided “as is”
          and “as available,” without warranties of any kind, whether express
          or implied. AI-assisted results, face groupings, captions, search
          results, and edits may be incomplete or inaccurate and should be
          reviewed before use.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, {SITE_NAME} and its operators will
          not be liable for indirect, incidental, special, consequential,
          exemplary, or punitive damages, or for loss of data, profits,
          goodwill, or business opportunities arising from use of the service.
          Some jurisdictions do not allow certain limitations, so portions of
          this section may not apply to you.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms from time to time by posting a revised
          version here and changing the date above. Continued use after an
          update means you accept the revised terms. Questions can be sent to{" "}
          <a href="mailto:support@saathidesk.com">support@saathidesk.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
