'use client';

import React, { useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [gameUpdates, setGameUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]">
      <CardHeader>
        <CardTitle className="text-[var(--tycoon-text)]">Notifications</CardTitle>
        <CardDescription className="text-[var(--tycoon-text)]/60">
          Control how you receive updates and notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-[var(--tycoon-accent)]" />
            <div>
              <Label className="text-[var(--tycoon-text)] font-medium">Email Notifications</Label>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Receive email updates about your account
              </p>
            </div>
          </div>
          <Switch
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
            disabled={isSaving}
          />
        </div>

        {/* Game Updates */}
        <div className="flex items-center justify-between border-t border-[var(--tycoon-border)] pt-6">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-[var(--tycoon-accent)]" />
            <div>
              <Label className="text-[var(--tycoon-text)] font-medium">Game Updates</Label>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Get notified about game events and achievements
              </p>
            </div>
          </div>
          <Switch
            checked={gameUpdates}
            onCheckedChange={setGameUpdates}
            disabled={isSaving}
          />
        </div>

        {/* Promotional Emails */}
        <div className="flex items-center justify-between border-t border-[var(--tycoon-border)] pt-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[var(--tycoon-accent)]" />
            <div>
              <Label className="text-[var(--tycoon-text)] font-medium">Promotional Emails</Label>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Receive special offers and promotions
              </p>
            </div>
          </div>
          <Switch
            checked={promotions}
            onCheckedChange={setPromotions}
            disabled={isSaving}
          />
        </div>

        {/* Save Button */}
        <div className="border-t border-[var(--tycoon-border)] pt-6">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[var(--tycoon-accent)] text-[#010F10] hover:bg-[var(--tycoon-accent)]/90"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
