/**
 * PWA Module
 *
 * Strict public surface for all Progressive Web App utilities.
 * Consumers must import from "@/lib/pwa" — never from internal paths.
 */

export {
  PWA_CACHE_PREFIX,
  PWA_CACHE_VERSION,
  PWA_CACHE_NAME,
  PWA_SW_URL,
  PWA_SW_SCOPE,
  PWA_OFFLINE_FALLBACK_URL,
  PWA_SHELL_PATHS,
  isShellAssetPath,
} from "./constants";
