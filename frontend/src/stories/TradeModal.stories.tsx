import type { Meta, StoryObj } from '@storybook/react';
import { TradeModal } from '@/components/game/TradeModal';
import type { TradePlayer } from '@/components/game/TradeModal';

const meta: Meta<typeof TradeModal> = {
  title: 'Game/TradeModal',
  component: TradeModal,
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: false },
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[#010F10] flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    onClose: { action: 'closed' },
  },
};

export default meta;
type Story = StoryObj<typeof TradeModal>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const alice: TradePlayer = {
  id: 'p1',
  name: 'Alice',
  cash: 1500,
  properties: [
    { name: 'Park Place', color: 'bg-blue-700', price: 350, type: 'property' },
    { name: 'Boardwalk', color: 'bg-blue-700', price: 400, type: 'property' },
    { name: 'Reading Railroad', color: 'bg-gray-700', price: 200, type: 'railroad' },
  ],
};

const bob: TradePlayer = {
  id: 'p2',
  name: 'Bob',
  cash: 1200,
  properties: [
    { name: 'Mediterranean Ave', color: 'bg-purple-900', price: 60, type: 'property' },
    { name: 'Baltic Ave', color: 'bg-purple-900', price: 60, type: 'property' },
    { name: 'Electric Company', color: 'bg-gray-400', price: 150, type: 'utility' },
  ],
};

const playerWithNoProperties: TradePlayer = {
  id: 'p3',
  name: 'Charlie',
  cash: 800,
  properties: [],
};

// ─── Stories ─────────────────────────────────────────────────────────────────

/** Default open state with full players and properties */
export const Default: Story = {
  name: 'Default — open with players',
  args: {
    isOpen: true,
    players: [alice, bob],
    currentPlayer: alice,
  },
};

/** Edge: empty players list (only the current player, no other players) */
export const EmptyPlayers: Story = {
  name: 'Edge — no other players',
  args: {
    isOpen: true,
    players: [alice],
    currentPlayer: alice,
  },
};

/** Edge: players with no properties on either side */
export const NoProperties: Story = {
  name: 'Edge — players with no properties',
  args: {
    isOpen: true,
    players: [playerWithNoProperties, { id: 'p4', name: 'Dana', cash: 500, properties: [] }],
    currentPlayer: playerWithNoProperties,
  },
};

/** Edge: current player has no cash (zero balance) */
export const ZeroCash: Story = {
  name: 'Edge — current player zero cash',
  args: {
    isOpen: true,
    players: [{ ...alice, cash: 0 }, bob],
    currentPlayer: { ...alice, cash: 0 },
  },
};

/** Loading/closed state (modal hidden) */
export const Closed: Story = {
  name: 'State — modal closed',
  args: {
    isOpen: false,
    players: [alice, bob],
    currentPlayer: alice,
  },
};
