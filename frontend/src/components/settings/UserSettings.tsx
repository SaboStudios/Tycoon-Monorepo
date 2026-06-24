'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { DangerZone } from './DangerZone';

export function UserSettings(): React.JSX.Element {
  const router = useRouter();

  return (
    <main
      aria-labelledby="settings-page-title"
      className="relative min-h-screen bg-[var(--tycoon-bg)]"
    >
      <a
        href="#settings-page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--tycoon-accent)] focus:px-4 focus:py-2 focus:text-[var(--tycoon-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2 focus:ring-offset-[var(--tycoon-bg)]"
      >
        Skip to settings
      </a>

      <div
        id="settings-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Settings status updates"
        className="sr-only"
      >
        Settings ready.
      </div>

      {/* Header */}
      <header className="border-b border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-[var(--tycoon-text)] hover:bg-[var(--tycoon-border)]"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Button>
            <div>
              <h1
                id="settings-page-title"
                className="text-3xl font-bold text-[var(--tycoon-text)]"
              >
                Settings
              </h1>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section
        id="settings-page-content"
        aria-label="Settings options"
        tabIndex={-1}
        className="mx-auto max-w-2xl px-4 py-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tycoon-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tycoon-bg)] sm:px-6 lg:px-8 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[var(--tycoon-accent)] [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-offset-[var(--tycoon-bg)]"
      >
        <div className="space-y-8">
          {/* Account Settings Section */}
          <section>
            <AccountSettings />
          </section>

          {/* Notification Settings Section */}
          <section>
            <NotificationSettings />
          </section>

          {/* Danger Zone Section */}
          <section>
            <DangerZone />
          </section>
        </div>
      </section>
    </main>
  );
}
