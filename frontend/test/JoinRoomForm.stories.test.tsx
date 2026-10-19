import { describe, expect, it } from "vitest";
import * as joinRoomStories from "@/components/settings/JoinRoomForm.stories";

describe("JoinRoomForm stories (#843)", () => {
  const requiredStories = [
    "Idle",
    "Loading",
    "RoomNotFound",
    "InviteExpired",
    "RoomFull",
    "Unauthorized",
    "Success",
    "PageLoading",
  ] as const;

  it.each(requiredStories)("exports %s story", (storyName) => {
    expect(joinRoomStories[storyName]).toBeDefined();
    expect(typeof joinRoomStories[storyName].render).toBe("function");
  });
});
