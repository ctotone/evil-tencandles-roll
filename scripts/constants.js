/**
 * Constantes partagées par l'ensemble du module.
 */

export const MODULE_ID = "evil-tencandles-roll";
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const STATE_KEY = "gameState";
export const I18N_PREFIX = "EVILTENCANDLES";
export const TOTAL_CANDLES = 10;
export const SUPPORTED_VISUAL_DOCUMENTS = new Set(["Tile", "Token"]);

export const ACTOR_RESOURCE_FLAGS = {
  vice: "viceUsed",
  virtue: "virtueUsed"
};
