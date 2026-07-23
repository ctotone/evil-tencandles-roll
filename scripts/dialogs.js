/**
 * Fenêtres de réglages de développement et de configuration du canevas.
 */

import { MODULE_ID, TOTAL_CANDLES } from "./constants.js";
import {
  clampInteger,
  clone,
  escapeHTML,
  readDialogForm,
  uuidsToTextarea
} from "./utils.js";
import {
  getState,
  normalizeCanvasSync,
  saveState
} from "./state.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { cancelActiveResolution } from "./resolution.js";

export async function openGMSetup() {
  if (!game.user.isGM) return;

  const state = getState();
  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Ten Candles — Réglages de développement"
    },
    content: `
      <div class="etc-dialog">
        <label>
          <span>Bougies allumées</span>
          <input
            type="number"
            name="litCandles"
            min="0"
            max="${TOTAL_CANDLES}"
            step="1"
            value="${state.litCandles}"
          >
        </label>

        <label>
          <span>Dés bleus encore disponibles</span>
          <input
            type="number"
            name="bluePoolRemaining"
            min="0"
            max="${state.litCandles}"
            step="1"
            value="${state.bluePoolRemaining}"
          >
        </label>

        <label>
          <span>Étape actuelle</span>
          <select name="stage">
            <option value="scene" ${state.stage === "scene" ? "selected" : ""}>
              Scène
            </option>
            <option
              value="ball-of-truths"
              ${state.stage === "ball-of-truths" ? "selected" : ""}
            >
              Bal des vérités
            </option>
          </select>
        </label>

        <label class="etc-dialog__checkbox">
          <input type="checkbox" name="cancelResolution">
          <span>Annuler la résolution active</span>
        </label>

        <label class="etc-dialog__checkbox">
          <input
            type="checkbox"
            name="syncCanvas"
            ${state.canvasSync.enabled ? "checked" : ""}
          >
          <span>Synchroniser le canevas après l'enregistrement</span>
        </label>
      </div>
    `,
    ok: {
      label: "Enregistrer",
      callback: (_event, button) => {
        const fields = readDialogForm(button);

        return {
          litCandles: fields.getValue("litCandles"),
          bluePoolRemaining: fields.getValue("bluePoolRemaining"),
          stage: fields.getValue("stage"),
          cancelResolution: fields.isChecked("cancelResolution"),
          syncCanvas: fields.isChecked("syncCanvas")
        };
      }
    },
    rejectClose: false,
    modal: true
  });

  if (!result) return;

  const litCandles = clampInteger(result.litCandles, 0, TOTAL_CANDLES);
  const bluePoolRemaining = clampInteger(
    result.bluePoolRemaining,
    0,
    litCandles
  );

  if (result.cancelResolution) {
    await cancelActiveResolution();
  }

  const refreshedState = getState();
  refreshedState.litCandles = litCandles;
  refreshedState.bluePoolRemaining = bluePoolRemaining;
  refreshedState.stage =
    result.stage === "ball-of-truths" ? "ball-of-truths" : "scene";

  await saveState(refreshedState);

  if (result.syncCanvas) {
    await syncCanvasSafely(refreshedState, { notify: true });
  }

  ui.notifications.info(
    `Ten Candles : ${litCandles} bougie(s), ${bluePoolRemaining} dé(s) bleu(s).`
  );
}

export async function openCanvasSetup() {
  if (!game.user.isGM) return;

  const state = getState();
  const config = state.canvasSync;
  const activeSceneId = canvas.scene?.id ?? "";

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Ten Candles — Configuration du canevas"
    },
    content: `
      <div class="etc-dialog etc-dialog--wide">
        <p class="etc-dialog__help">
          Les UUID doivent être placés dans l'ordre, un par ligne.
          Les premiers éléments restent visibles ; les derniers sont masqués
          lorsque le nombre de bougies ou de dés diminue.
        </p>

        <label class="etc-dialog__checkbox">
          <input
            type="checkbox"
            name="enabled"
            ${config.enabled ? "checked" : ""}
          >
          <span>Activer la synchronisation du canevas</span>
        </label>

        <label>
          <span>ID de la scène Ten Candles</span>
          <input
            type="text"
            name="sceneId"
            value="${escapeHTML(config.sceneId ?? activeSceneId)}"
            placeholder="${escapeHTML(activeSceneId)}"
          >
        </label>

        <fieldset class="etc-dialog__section">
          <legend>Bougies</legend>

          <label>
            <span>UUID des flammes — Tiles ou Tokens</span>
            <textarea
              name="candleFlameUuids"
              rows="6"
              placeholder="Un UUID par ligne"
            >${uuidsToTextarea(config.candleFlameUuids)}</textarea>
          </label>

          <label>
            <span>UUID des lumières — AmbientLight</span>
            <textarea
              name="candleLightUuids"
              rows="6"
              placeholder="Un UUID par ligne"
            >${uuidsToTextarea(config.candleLightUuids)}</textarea>
          </label>
        </fieldset>

        <fieldset class="etc-dialog__section">
          <legend>Dés sur le canevas</legend>

          <label>
            <span>UUID des dés bleus — Tiles ou Tokens</span>
            <textarea
              name="blueDieUuids"
              rows="6"
              placeholder="Un UUID par ligne"
            >${uuidsToTextarea(config.blueDieUuids)}</textarea>
          </label>

          <label>
            <span>UUID des dés rouges — Tiles ou Tokens</span>
            <textarea
              name="redDieUuids"
              rows="6"
              placeholder="Un UUID par ligne"
            >${uuidsToTextarea(config.redDieUuids)}</textarea>
          </label>
        </fieldset>

        <label class="etc-dialog__checkbox">
          <input type="checkbox" name="syncNow" checked>
          <span>Synchroniser immédiatement après l'enregistrement</span>
        </label>
      </div>
    `,
    ok: {
      label: "Enregistrer",
      callback: (_event, button) => {
        const fields = readDialogForm(button);

        return {
          enabled: fields.isChecked("enabled"),
          sceneId: fields.getValue("sceneId"),
          candleFlameUuids: fields.getValue("candleFlameUuids"),
          candleLightUuids: fields.getValue("candleLightUuids"),
          blueDieUuids: fields.getValue("blueDieUuids"),
          redDieUuids: fields.getValue("redDieUuids"),
          syncNow: fields.isChecked("syncNow")
        };
      }
    },
    rejectClose: false,
    modal: true
  });

  if (!result) return;

  const refreshedState = getState();
  refreshedState.canvasSync = normalizeCanvasSync({
    enabled: result.enabled,
    sceneId: result.sceneId,
    candleFlameUuids: result.candleFlameUuids,
    candleLightUuids: result.candleLightUuids,
    blueDieUuids: result.blueDieUuids,
    redDieUuids: result.redDieUuids
  });

  await saveState(refreshedState);

  const savedConfig = refreshedState.canvasSync;

  ui.notifications.info(
    [
      `Configuration enregistrée — synchronisation : ${savedConfig.enabled ? "ACTIVÉE" : "DÉSACTIVÉE"}`,
      `${savedConfig.candleFlameUuids.length} flamme(s)`,
      `${savedConfig.candleLightUuids.length} lumière(s)`,
      `${savedConfig.blueDieUuids.length} dé(s) joueur`,
      `${savedConfig.redDieUuids.length} dé(s) MJ`
    ].join(" — ")
  );

  console.log(`${MODULE_ID} | Configuration du canevas enregistrée :`, clone(savedConfig));

  if (result.syncNow && savedConfig.enabled) {
    await syncCanvasSafely(refreshedState, { notify: true });
  }
}
