'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { DangerZone } from './DangerZone';

export function UserSettings() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[var(--tycoon-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-[var(--tycoon-text)] hover:bg-[var(--tycoon-border)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[var(--tycoon-text)]">Settings</h1>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
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
      </div>
    </main>
  );
}
