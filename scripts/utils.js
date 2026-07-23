/**
 * Petites fonctions génériques utilisées dans plusieurs fichiers.
 */

import { I18N_PREFIX, MODULE_ID, TOTAL_CANDLES } from "./constants.js";

export function localize(key) {
  return game.i18n.localize(`${I18N_PREFIX}.${key}`);
}

export function clone(data) {
  return foundry.utils.deepClone(data);
}

export function clampInteger(value, minimum, maximum) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

export function extractUuid(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  // Accepte aussi les liens Foundry : @UUID[Scene.xxx.Tile.xxx]{Nom}
  const uuidMatch = text.match(/@UUID\[([^\]]+)\]/i);
  return (uuidMatch?.[1] ?? text).trim();
}

export function normalizeUuidList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value ?? "").split(/\r?\n|,/);

  return list
    .map(extractUuid)
    .filter(Boolean)
    .slice(0, TOTAL_CANDLES);
}

export function normalizeSceneId(value) {
  const sceneReference = extractUuid(value);
  if (!sceneReference) return null;

  const match = sceneReference.match(/^Scene\.([^.]+)$/i);
  return match?.[1] ?? sceneReference;
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function uuidsToTextarea(uuids) {
  return escapeHTML(normalizeUuidList(uuids).join("\n"));
}

export function readDialogForm(button) {
  const form = button?.form;
  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`${MODULE_ID} | Formulaire DialogV2 introuvable.`);
  }

  const getElement = (name) => {
    const element = form.elements.namedItem(name);
    if (!element) {
      throw new Error(`${MODULE_ID} | Champ de formulaire introuvable : ${name}`);
    }
    return element;
  };

  return {
    form,
    getValue: (name) => String(getElement(name).value ?? ""),
    isChecked: (name) => Boolean(getElement(name).checked)
  };
}
