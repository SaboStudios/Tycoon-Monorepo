/** i18n keys for the join room flow (namespace: common). */
export const JOIN_ROOM_I18N = {
  title: "join_room.title",
  loadingAria: "join_room.loading_aria",
  form: {
    label: "join_room.form.label",
    hint: "join_room.form.hint",
    placeholder: "join_room.form.placeholder",
    submit: "join_room.form.submit",
    submitting: "join_room.form.submitting",
    retry: "join_room.form.retry",
    retryAria: "join_room.form.retry_aria",
  },
  success: {
    title: "join_room.success.title",
    redirect: "join_room.success.redirect",
    redirectGeneric: "join_room.success.redirect_generic",
  },
  validation: {
    codeLength: "join_room.validation.code_length",
    codeFormat: "join_room.validation.code_format",
  },
  errors: {
    rateLimit: "join_room.errors.rate_limit",
    unauthorized: "join_room.errors.unauthorized",
    notFound: "join_room.errors.not_found",
    roomFull: "join_room.errors.room_full",
    inviteExpired: "join_room.errors.invite_expired",
    alreadyJoined: "join_room.errors.already_joined",
    serverError: "join_room.errors.server_error",
    unexpected: "join_room.errors.unexpected",
    networkError: "join_room.errors.network_error",
    timeout: "join_room.errors.timeout",
  },
} as const;

export const JOIN_ROOM_I18N_KEY_LIST: string[] = [
  JOIN_ROOM_I18N.title,
  JOIN_ROOM_I18N.loadingAria,
  ...Object.values(JOIN_ROOM_I18N.form),
  ...Object.values(JOIN_ROOM_I18N.success),
  ...Object.values(JOIN_ROOM_I18N.validation),
  ...Object.values(JOIN_ROOM_I18N.errors),
];

/** Returns translated copy when message is an i18n key; otherwise returns as-is. */
export function translateJoinRoomMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  message: string | undefined
): string {
  if (!message) return "";
  if (message.startsWith("join_room.")) return t(message);
  return message;
}
