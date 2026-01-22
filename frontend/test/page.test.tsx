import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';

test('Page', () => {
    render(<Page />);
    // Check for some text in the page
    // The default Next.js page usually has "Get started" or similar
    expect(screen.getByRole('main')).toBeDefined();
});
