/** i18n keys for the landing hero flow (namespace: common). */
export const HERO_I18N = {
  aria: {
    heroSection: "hero.aria.hero_section",
  },
  welcome: "hero.welcome",
  title: {
    main: "hero.title.main",
    decorative: "hero.title.decorative",
  },
  tagline: {
    conquer: "hero.tagline.conquer",
    conquerBuild: "hero.tagline.conquer_build",
    conquerBuildTradeOn: "hero.tagline.conquer_build_trade_on",
    playSoloVsAI: "hero.tagline.play_solo_vs_ai",
  },
  subtitle: {
    rollTheDice: "hero.subtitle.roll_the_dice",
    buyProperties: "hero.subtitle.buy_properties",
    collectRent: "hero.subtitle.collect_rent",
    playAgainstAI: "hero.subtitle.play_against_ai",
    becomeTopTycoon: "hero.subtitle.become_top_tycoon",
  },
  description: "hero.description",
  buttons: {
    continueGame: "hero.buttons.continue_game",
    multiplayer: "hero.buttons.multiplayer",
    joinRoom: "hero.buttons.join_room",
    challengeAI: "hero.buttons.challenge_ai",
  },
  error: {
    heading: "hero.error.heading",
    generic: "hero.error.generic",
    tryAgain: "hero.error.try_again",
  },
} as const;

export const HERO_I18N_KEY_LIST: string[] = [
  HERO_I18N.aria.heroSection,
  HERO_I18N.welcome,
  HERO_I18N.title.main,
  HERO_I18N.title.decorative,
  HERO_I18N.tagline.conquer,
  HERO_I18N.tagline.conquerBuild,
  HERO_I18N.tagline.conquerBuildTradeOn,
  HERO_I18N.tagline.playSoloVsAI,
  HERO_I18N.subtitle.rollTheDice,
  HERO_I18N.subtitle.buyProperties,
  HERO_I18N.subtitle.collectRent,
  HERO_I18N.subtitle.playAgainstAI,
  HERO_I18N.subtitle.becomeTopTycoon,
  HERO_I18N.description,
  HERO_I18N.buttons.continueGame,
  HERO_I18N.buttons.multiplayer,
  HERO_I18N.buttons.joinRoom,
  HERO_I18N.buttons.challengeAI,
  HERO_I18N.error.heading,
  HERO_I18N.error.generic,
  HERO_I18N.error.tryAgain,
];
