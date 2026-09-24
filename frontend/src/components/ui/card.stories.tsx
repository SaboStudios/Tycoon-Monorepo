import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here</p>
      </CardContent>
    </Card>
  ),
};

export const WithContent: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Game Stats</CardTitle>
        <CardDescription>Your current progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Level</span>
            <span className="font-bold">42</span>
          </div>
          <div className="flex justify-between">
            <span>Experience</span>
            <span className="font-bold">8,500 XP</span>
          </div>
          <div className="flex justify-between">
            <span>Coins</span>
            <span className="font-bold">1,250</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const Multiple: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle>Card {i}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Content {i}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
