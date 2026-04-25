'use client';

import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export function AccountSettings() {
  const [email, setEmail] = useState('player@tycoon.game');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);
    setEmailSuccess(false);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Email updated successfully');
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (error) {
      toast.error('Failed to update email');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setIsPasswordLoading(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Password reset link sent to your email');
    } catch (error) {
      toast.error('Failed to send password reset link');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <Card className="border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)]">
      <CardHeader>
        <CardTitle className="text-[var(--tycoon-text)]">Account Settings</CardTitle>
        <CardDescription className="text-[var(--tycoon-text)]/60">
          Manage your email and password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--tycoon-accent)]" />
            <h3 className="font-semibold text-[var(--tycoon-text)]">Email Address</h3>
          </div>
          <form onSubmit={handleEmailUpdate} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-[var(--tycoon-text)]/80">
                Current Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 border-[var(--tycoon-border)] bg-[#010F10] text-[var(--tycoon-text)]"
                disabled={isEmailLoading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isEmailLoading}
                className="bg-[var(--tycoon-accent)] text-[#010F10] hover:bg-[var(--tycoon-accent)]/90"
              >
                {isEmailLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Updating...
                  </>
                ) : emailSuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Updated
                  </>
                ) : (
                  'Update Email'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Password Section */}
        <div className="space-y-4 border-t border-[var(--tycoon-border)] pt-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[var(--tycoon-accent)]" />
            <h3 className="font-semibold text-[var(--tycoon-text)]">Password</h3>
          </div>
          <p className="text-sm text-[var(--tycoon-text)]/60">
            We'll send a secure link to your email to reset your password.
          </p>
          <Button
            onClick={handlePasswordReset}
            disabled={isPasswordLoading}
            variant="outline"
            className="border-[var(--tycoon-border)] text-[var(--tycoon-accent)] hover:bg-[var(--tycoon-border)]"
          >
            {isPasswordLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Sending...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
