import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';
import { SkeletonCard, SkeletonList, SkeletonDetail } from './skeleton-card';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="space-y-2">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
    </div>
  ),
};

export const SkeletonCardStory: Story = {
  render: () => <SkeletonCard />,
  name: 'Card Skeleton',
};

export const SkeletonListStory: Story = {
  render: () => <SkeletonList count={3} />,
  name: 'List Skeleton',
};

export const SkeletonDetailStory: Story = {
  render: () => <SkeletonDetail />,
  name: 'Detail Skeleton',
};

export const CustomSkeleton: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    </div>
  ),
};
