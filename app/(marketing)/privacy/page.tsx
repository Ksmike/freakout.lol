export const metadata = {
  title: "Privacy Policy | Freakout.lol",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
      <p className="mt-4 text-foreground/60 text-sm">Last updated: May 26, 2026</p>

      <div className="mt-8 space-y-6 text-foreground/80 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-medium text-foreground">1. Introduction</h2>
          <p className="mt-2">
            Freakout (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the
            freakout.lol platform. This Privacy Policy explains how we collect, use, and
            protect your personal information when you use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">
            2. Information We Collect
          </h2>
          <p className="mt-2">We collect information you provide directly to us:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account information (name, email address, password)</li>
            <li>Documents and files you upload for analysis</li>
            <li>Usage data and interaction logs</li>
            <li>Payment and billing information (processed by our payment provider)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">
            3. How We Use Your Information
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To provide, maintain, and improve our services</li>
            <li>To process your documents and generate analysis</li>
            <li>To communicate with you about your account and our services</li>
            <li>To process payments and manage subscriptions</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">4. Data Storage</h2>
          <p className="mt-2">
            Your data is stored securely using industry-standard encryption. Documents you
            upload are processed for analysis and stored in encrypted form. We retain your
            data for as long as your account is active or as needed to provide services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">5. Data Sharing</h2>
          <p className="mt-2">
            We do not sell your personal information. We may share data with:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Service providers who assist in operating our platform</li>
            <li>AI model providers for document analysis (data is not used for training)</li>
            <li>Payment processors for billing</li>
            <li>Law enforcement when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">6. Your Rights</h2>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access and export your data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Opt out of non-essential communications</li>
            <li>Request correction of inaccurate information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">7. Cookies</h2>
          <p className="mt-2">
            We use essential cookies for authentication and session management. We do not
            use third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">8. Security</h2>
          <p className="mt-2">
            We implement appropriate technical and organizational measures to protect your
            data, including encryption in transit and at rest, access controls, and regular
            security reviews.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">9. Changes</h2>
          <p className="mt-2">
            We may update this policy from time to time. We will notify you of material
            changes by email or through the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-foreground">10. Contact</h2>
          <p className="mt-2">
            For privacy-related questions, contact us at{" "}
            <a
              href="mailto:general@freakout.ai"
              className="text-primary hover:underline"
            >
              general@freakout.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
