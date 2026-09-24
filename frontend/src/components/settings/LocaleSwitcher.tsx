'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LocaleSwitcher() {
  const { i18n, t } = useTranslation('common');

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-400">
        <Globe size={16} />
        {t('settings.language')}
      </div>
      <div className="flex gap-2">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={i18n.language === lang.code ? 'default' : 'outline'}
            onClick={() => changeLanguage(lang.code)}
            className={i18n.language === lang.code ? 'bg-indigo-600 text-white' : 'border-neutral-800 text-neutral-400'}
          >
            {lang.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
