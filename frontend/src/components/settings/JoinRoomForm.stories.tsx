import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import JoinRoomForm, {
  type JoinRoomFormPreviewState,
} from "@/components/settings/JoinRoomForm";
import JoinRoomLoading from "@/app/join-room/loading";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

function JoinRoomStoryShell({
  children,
  title = "Join Room",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6">
          {title}
        </h1>
        <div className="rounded-lg border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] p-6">
          {children}
        </div>
      </div>
    </section>
  );
}

function previewStory(previewState: JoinRoomFormPreviewState) {
  return (
    <JoinRoomStoryShell>
      <JoinRoomForm previewState={{ skipAutoFocus: true, ...previewState }} />
    </JoinRoomStoryShell>
  );
}

const meta = {
  title: "Join Room/JoinRoomForm",
  component: JoinRoomForm,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/join-room",
      },
    },
    chromatic: { disableSnapshot: false },
  },
  tags: ["autodocs", "visual-regression"],
} satisfies Meta<typeof JoinRoomForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  render: () => previewStory({ code: "" }),
};

export const Loading: Story = {
  render: () =>
    previewStory({ code: "ABC123", isLoading: true }),
};

export const RoomNotFound: Story = {
  render: () =>
    previewStory({
      code: "NOTFND",
      errors: { _form: JOIN_ROOM_I18N.errors.notFound },
    }),
};

export const InviteExpired: Story = {
  render: () =>
    previewStory({
      code: "EXPIRD",
      errors: { _form: JOIN_ROOM_I18N.errors.inviteExpired },
    }),
};

export const RoomFull: Story = {
  render: () =>
    previewStory({
      code: "FULL00",
      errors: { _form: JOIN_ROOM_I18N.errors.roomFull },
    }),
};

export const Unauthorized: Story = {
  render: () =>
    previewStory({
      code: "UNAUTH",
      errors: { _form: JOIN_ROOM_I18N.errors.unauthorized },
    }),
};

export const Success: Story = {
  render: () => (
    <JoinRoomStoryShell title="Join Room">
      <div
        role="status"
        className="space-y-3 text-center"
        data-testid="join-room-success-state"
      >
        <p className="font-orbitron text-lg text-[var(--tycoon-accent)]">
          Join successful
        </p>
        <p className="text-sm text-[var(--tycoon-text)]/80">
          Redirecting to the waiting room for code{" "}
          <span className="font-orbitron tracking-widest">ABC123</span>…
        </p>
      </div>
    </JoinRoomStoryShell>
  ),
};

export const PageLoading: Story = {
  render: () => (
    <JoinRoomStoryShell>
      <JoinRoomLoading />
    </JoinRoomStoryShell>
  ),
};
