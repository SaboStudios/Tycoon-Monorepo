'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmationModal } from './ConfirmationModal';

export function DangerZone() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Account deletion request submitted. Check your email for confirmation.');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to submit deletion request');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-red-900/50 bg-red-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-500">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-red-400/70">
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Privacy Policy Link */}
          <div className="flex items-center justify-between rounded-lg border border-red-900/30 bg-red-950/10 p-4">
            <div>
              <h3 className="font-semibold text-[var(--tycoon-text)]">Privacy Policy</h3>
              <p className="text-sm text-[var(--tycoon-text)]/60">
                Review our privacy practices and data handling
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-900/50 text-red-400 hover:bg-red-950/30"
              asChild
            >
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View
              </a>
            </Button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <div>
              <h3 className="font-semibold text-red-500">Delete Account</h3>
              <p className="text-sm text-red-400/70">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Account?"
        description="This action cannot be undone. All your data, progress, and account information will be permanently deleted."
        confirmText="Delete My Account"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
