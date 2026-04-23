import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { generateBaseMetadata } from '@/lib/metadata';

export const metadata: Metadata = generateBaseMetadata({
  title: 'Privacy Policy',
  description: 'Tycoon Privacy Policy - Learn how we handle your data',
});

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--tycoon-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/settings">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--tycoon-text)] hover:bg-[var(--tycoon-border)]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-[var(--tycoon-text)]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[var(--tycoon-text)]/60">
            Last updated: March 30, 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="prose prose-invert max-w-none space-y-6 text-[var(--tycoon-text)]">
          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">1. Introduction</h2>
            <p className="text-[var(--tycoon-text)]/80">
              Tycoon ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">2. Information We Collect</h2>
            <p className="text-[var(--tycoon-text)]/80">We may collect information about you in a variety of ways. The information we may collect on the Site includes:</p>
            <ul className="list-disc list-inside space-y-2 text-[var(--tycoon-text)]/80">
              <li>Personal Data: Personally identifiable information, such as your name, shipping address, email address, and telephone number, that you voluntarily give to us when you register with the Site or when you choose to participate in various activities related to the Site.</li>
              <li>Financial Data: Financial information, such as data related to your payment method (e.g., valid credit card number, card brand, expiration date) that we may collect when you purchase, order, return, exchange, or request information about our services from the Site.</li>
              <li>Data From Social Networks: User information from social networks, including your name, your social network username, location, gender, birth date, email address, profile picture, and public data for contacts, if you connect your account to such social networks.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">3. Use of Your Information</h2>
            <p className="text-[var(--tycoon-text)]/80">Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:</p>
            <ul className="list-disc list-inside space-y-2 text-[var(--tycoon-text)]/80">
              <li>Create and manage your account</li>
              <li>Process your transactions and send related information</li>
              <li>Email you regarding your account or order</li>
              <li>Fulfill and manage purchases, orders, payments, and other transactions related to the Site</li>
              <li>Generate a personal profile about you in order to better understand and serve you</li>
              <li>Increase the efficiency and operation of the Site</li>
              <li>Monitor and analyze usage and trends to improve your experience with the Site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">4. Disclosure of Your Information</h2>
            <p className="text-[var(--tycoon-text)]/80">
              We may share information we have collected about you in certain situations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--tycoon-text)]/80">
              <li>By Law or to Protect Rights: If we believe the release of information about you is necessary to comply with the law, enforce our Site policies, or protect ours or others' rights, property, or safety.</li>
              <li>Third-Party Service Providers: We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">5. Security of Your Information</h2>
            <p className="text-[var(--tycoon-text)]/80">
              We use administrative, technical, and physical security measures to protect your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--tycoon-accent)]">6. Contact Us</h2>
            <p className="text-[var(--tycoon-text)]/80">
              If you have questions or comments about this Privacy Policy, please contact us at:
            </p>
            <p className="text-[var(--tycoon-text)]/80">
              Email: privacy@tycoon.game
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
