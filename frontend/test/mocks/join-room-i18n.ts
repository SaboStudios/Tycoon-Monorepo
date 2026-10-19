import { vi } from "vitest";

const joinRoomEnglish: Record<string, string> = {
  "join_room.title": "Join Room",
  "join_room.loading_aria": "Loading join room form",
  "join_room.form.label": "Room Code",
  "join_room.form.hint": "6-character alphanumeric code (e.g. TYCOON)",
  "join_room.form.placeholder": "e.g. TYCOON",
  "join_room.form.submit": "Join",
  "join_room.form.submitting": "Joining…",
  "join_room.form.retry": "Retry",
  "join_room.form.retry_aria": "Retry joining the room",
  "join_room.success.title": "Join successful",
  "join_room.success.redirect": "Redirecting to the waiting room for code {{code}}…",
  "join_room.success.redirect_generic": "Redirecting to the waiting room…",
  "join_room.validation.code_length": "Room code must be exactly 6 characters",
  "join_room.validation.code_format": "Room code must be letters and numbers only",
  "join_room.errors.rate_limit": "Please wait a moment before trying again.",
  "join_room.errors.unauthorized": "Please sign in to join a room.",
  "join_room.errors.not_found": "Room not found. Check the code and try again.",
  "join_room.errors.room_full": "Room is full. Try a different room.",
  "join_room.errors.invite_expired": "This invite link has expired. Ask the host for a new one.",
  "join_room.errors.already_joined": "You're already in this room.",
  "join_room.errors.server_error": "Server error. Please try again in a moment.",
  "join_room.errors.unexpected": "An unexpected error occurred",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; code?: string }) => {
      const template = joinRoomEnglish[key] ?? options?.defaultValue ?? key;
      if (options?.code) {
        return template.replace("{{code}}", options.code);
      }
      return template;
    },
  }),
}));
