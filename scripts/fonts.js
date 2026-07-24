/**
 * Enregistrement des polices du module auprès de Foundry.
 */

export const THIRD_FONT_FAMILY = "3rd";
export const THIRD_FONT_URL =
  "modules/evil-tencandles-roll/fonts/3rd%20Man.woff2";

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
