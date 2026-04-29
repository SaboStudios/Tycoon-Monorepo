/**
 * SW-FE-008: MSW fixtures for the Landing Hero section.
 *
 * These fixtures mirror the API contract for hero-related endpoints.
 * Currently the hero is client-rendered with no API calls, but these
 * fixtures are available for future server-driven hero content (e.g.
 * featured game modes, announcements, dynamic CTAs).
 */

export interface HeroAnnouncement {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaLink: string | null;
  priority: number;
  active: boolean;
  startsAt: string;
  expiresAt: string | null;
}

export interface HeroFeature {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  order: number;
}

export interface HeroContentResponse {
  announcements: HeroAnnouncement[];
  features: HeroFeature[];
  welcomeMessage: string;
}

export const mockHeroAnnouncements: HeroAnnouncement[] = [
  {
    id: "ann-001",
    title: "New Season Started!",
    body: "Compete in the new season for exclusive rewards and leaderboard glory.",
    ctaLabel: "View Season",
    ctaLink: "/game-settings",
    priority: 1,
    active: true,
    startsAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-12-31T23:59:59.000Z",
  },
  {
    id: "ann-002",
    title: "Double XP Weekend",
    body: "Earn double XP on all games this weekend. Don't miss out!",
    ctaLabel: "Play Now",
    ctaLink: "/play-ai",
    priority: 2,
    active: true,
    startsAt: "2024-06-01T00:00:00.000Z",
    expiresAt: null,
  },
];

export const mockHeroFeatures: HeroFeature[] = [
  {
    id: "feat-001",
    label: "Continue Game",
    description: "Resume your last game",
    icon: "Gamepad2",
    route: "/game-settings",
    order: 1,
  },
  {
    id: "feat-002",
    label: "Multiplayer",
    description: "Play with friends online",
    icon: "Users",
    route: "/game-settings",
    order: 2,
  },
  {
    id: "feat-003",
    label: "Join Room",
    description: "Join a game room by code",
    icon: "Dices",
    route: "/join-room",
    order: 3,
  },
  {
    id: "feat-004",
    label: "Challenge AI",
    description: "Practice against AI opponents",
    icon: "Bot",
    route: "/play-ai",
    order: 4,
  },
];

export const mockHeroContent: HeroContentResponse = {
  announcements: mockHeroAnnouncements,
  features: mockHeroFeatures,
  welcomeMessage: "Welcome back, Player!",
};

/**
 * Empty state fixtures — used for testing hero when no content is available.
 */
export const mockHeroContentEmpty: HeroContentResponse = {
  announcements: [],
  features: [],
  welcomeMessage: "Welcome back, Player!",
};

/**
 * Error state fixture — simulates an API error response.
 */
export const mockHeroApiError = {
  code: "HERO_FETCH_ERROR",
  message: "Failed to load hero content. Please try again.",
  statusCode: 500,
};
