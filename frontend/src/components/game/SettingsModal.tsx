'use client';

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Settings, Volume2, Monitor, Shield } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useFocusTrap(containerRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-[#003B3E] bg-[#010F10] shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#003B3E] px-6 py-4">
          <div className="flex items-center gap-2 text-[#00F0FF]">
            <Settings size={18} />
            <h2 id="settings-modal-title" className="text-lg font-bold text-[#F0F7F7] tracking-tight">
              {t('settings.title', 'Game Settings')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-[#F0F7F7]/60 hover:text-[#00F0FF] transition-colors p-1 rounded-md hover:bg-[#003B3E]/30"
          >
            <X size={18} />
          </button>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Audio Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <Volume2 size={14} />
              Audio
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-[#003B3E]/30">
                <span className="text-sm text-neutral-300">Sound Effects</span>
                <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-[#003B3E]/30">
                <span className="text-sm text-neutral-300">Background Music</span>
                <Switch checked={musicEnabled} onCheckedChange={setMusicEnabled} />
              </div>
            </div>
          </section>

          {/* Gameplay Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <Monitor size={14} />
              Gameplay
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-[#003B3E]/30">
                <span className="text-sm text-neutral-300">Fast Animations</span>
                <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-[#003B3E]/30">
                <div className="flex flex-col">
                  <span className="text-sm text-neutral-300">Language</span>
                  <span className="text-[10px] text-neutral-500">Current: English</span>
                </div>
                <Button variant="ghost" size="sm" className="text-cyan-500 hover:text-cyan-400 p-0 h-auto font-bold">
                  Change
                </Button>
              </div>
            </div>
          </section>

          {/* Privacy & Security */}
          <section className="space-y-4">
             <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
              <Shield size={14} />
              Privacy
            </h3>
             <Button variant="outline" className="w-full justify-start text-xs border-[#003B3E] text-neutral-400 hover:bg-[#003B3E]/20">
               Manage Cookie Preferences
             </Button>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-[#003B3E] px-6 py-4 bg-[#010F10]/80">
          <Button 
            onClick={onClose} 
            className="w-full bg-[#00F0FF] text-black hover:bg-[#00E0F0] font-bold"
          >
            Save & Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
