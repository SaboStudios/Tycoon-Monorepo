import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button } from './button';
import { toastManager } from '@/lib/toast/toast-manager';

const meta = {
  title: 'UI/Toast',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  render: () => (
    <Button onClick={() => toastManager.success('Operation completed successfully!')}>
      Show Success Toast
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button
      variant="destructive"
      onClick={() => toastManager.error('An error occurred. Please try again.')}
    >
      Show Error Toast
    </Button>
  ),
};

export const Info: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() => toastManager.info('This is an informational message.')}
    >
      Show Info Toast
    </Button>
  ),
};

export const Warning: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() => toastManager.warning('Please be careful with this action.')}
    >
      Show Warning Toast
    </Button>
  ),
};

export const Multiple: Story = {
  render: () => {
    const [count, setCount] = useState(0);
    return (
      <Button
        onClick={() => {
          setCount(count + 1);
          toastManager.success(`Toast #${count + 1}`);
        }}
      >
        Show Multiple Toasts ({count})
      </Button>
    );
  },
};

export const Deduplication: Story = {
  render: () => (
    <Button
      onClick={() => {
        // Rapid clicks will be deduplicated
        toastManager.success('This message will be deduplicated if clicked rapidly');
      }}
    >
      Click Rapidly (Deduplication Test)
    </Button>
  ),
};
