import type { Metadata } from 'next';
import type { JSX } from 'react';
import { UserSettings } from '@/components/settings/UserSettings';
import { generateBaseMetadata } from '@/lib/metadata';

export const metadata: Metadata = generateBaseMetadata({
  title: 'Settings',
  description: 'Manage your account settings, notifications, and preferences',
});

export default function SettingsPage(): JSX.Element {
  return <UserSettings />;
}
