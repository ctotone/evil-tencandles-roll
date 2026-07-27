/**
 * Enregistrement des polices du module auprès de Foundry.
 */

export const THIRD_FONT_FAMILY = "special-elite";
export const THIRD_FONT_URL =
  "modules/evil-tencandles-roll/fonts/special-elite.woff2";

export function registerModuleFonts() {
  CONFIG.fontDefinitions[THIRD_FONT_FAMILY] = {
    editor: true,
    fonts: [
      {
        urls: [THIRD_FONT_URL],
        weight: 400,
        style: "normal"
      }
    ]
  };
}
