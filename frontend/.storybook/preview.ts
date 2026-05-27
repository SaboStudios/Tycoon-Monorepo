import React from 'react';
import type { Preview } from '@storybook/react';
import '../src/app/globals.css';
import './preview.css';
import { I18nProvider } from '../src/components/providers/i18n-provider';

const preview: Preview = {
    decorators: [
        (Story) => (
            <I18nProvider>
                <Story />
            </I18nProvider>
        ),
    ],
    parameters: {
        actions: { argTypesRegex: '^on[A-Z].*' },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        a11y: {
            config: {
                rules: [
                    {
                        id: 'color-contrast',
                        enabled: true,
                    },
                ],
            },
        },
    },
};

export default preview;
