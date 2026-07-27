/**
 * Fenêtres de réglages de développement et de configuration du canevas.
 */

import { MODULE_ID, TOTAL_CANDLES } from "./constants.js";
import {
  clampInteger,
  clone,
  escapeHTML,
  format,
  localize,
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
      title: localize("Dialogs.DevTitle")
    },
    content: `
      <div class="etc-dialog">
        <label>
          <span>${localize("Dialogs.LitCandles")}</span>
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
          <span>${localize("Dialogs.BlueDiceRemaining")}</span>
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
          <span>${localize("Dialogs.CurrentStage")}</span>
          <select name="stage">
            <option value="scene" ${state.stage === "scene" ? "selected" : ""}>
              ${localize("Common.Scene")}
            </option>
            <option
              value="ball-of-truths"
              ${state.stage === "ball-of-truths" ? "selected" : ""}
            >
              ${localize("Common.BallOfTruths")}
            </option>
          </select>
        </label>

        <label class="etc-dialog__checkbox">
          <input type="checkbox" name="cancelResolution">
          <span>${localize("Dialogs.CancelResolution")}</span>
        </label>

        <label class="etc-dialog__checkbox">
          <input
            type="checkbox"
            name="syncCanvas"
            ${state.canvasSync.enabled ? "checked" : ""}
          >
          <span>${localize("Dialogs.SyncAfterSave")}</span>
        </label>
      </div>
    `,
    ok: {
      label: localize("Common.Save"),
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
    format("Dialogs.StateSaved", {
      candles: litCandles,
      dice: bluePoolRemaining
    })
  );
}

export async function openCanvasSetup() {
  if (!game.user.isGM) return;

  const state = getState();
  const config = state.canvasSync;
  const activeSceneId = canvas.scene?.id ?? "";

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: localize("Dialogs.CanvasTitle")
    },
    content: `
      <div class="etc-dialog etc-dialog--wide">
        <p class="etc-dialog__help">
          ${localize("Dialogs.CanvasHelp")}
        </p>

        <label class="etc-dialog__checkbox">
          <input
            type="checkbox"
            name="enabled"
            ${config.enabled ? "checked" : ""}
          >
          <span>${localize("Dialogs.EnableCanvasSync")}</span>
        </label>

        <label>
          <span>${localize("Dialogs.SceneId")}</span>
          <input
            type="text"
            name="sceneId"
            value="${escapeHTML(config.sceneId ?? activeSceneId)}"
            placeholder="${escapeHTML(activeSceneId)}"
          >
        </label>

        <fieldset class="etc-dialog__section">
          <legend>${localize("Dialogs.Candles")}</legend>

          <label>
            <span>${localize("Dialogs.FlameUuids")}</span>
            <textarea
              name="candleFlameUuids"
              rows="6"
              placeholder="${localize("Common.UUIDPerLine")}"
            >${uuidsToTextarea(config.candleFlameUuids)}</textarea>
          </label>

          <label>
            <span>${localize("Dialogs.LightUuids")}</span>
            <textarea
              name="candleLightUuids"
              rows="6"
              placeholder="${localize("Common.UUIDPerLine")}"
            >${uuidsToTextarea(config.candleLightUuids)}</textarea>
          </label>
        </fieldset>

        <fieldset class="etc-dialog__section">
          <legend>${localize("Dialogs.CanvasDice")}</legend>

          <label>
            <span>${localize("Dialogs.BlueDieUuids")}</span>
            <textarea
              name="blueDieUuids"
              rows="6"
              placeholder="${localize("Common.UUIDPerLine")}"
            >${uuidsToTextarea(config.blueDieUuids)}</textarea>
          </label>

          <label>
            <span>${localize("Dialogs.RedDieUuids")}</span>
            <textarea
              name="redDieUuids"
              rows="6"
              placeholder="${localize("Common.UUIDPerLine")}"
            >${uuidsToTextarea(config.redDieUuids)}</textarea>
          </label>
        </fieldset>

        <label class="etc-dialog__checkbox">
          <input type="checkbox" name="syncNow" checked>
          <span>${localize("Dialogs.SyncNow")}</span>
        </label>
      </div>
    `,
    ok: {
      label: localize("Common.Save"),
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
      format("Dialogs.CanvasConfigSaved", {
        state: savedConfig.enabled
          ? localize("Common.Enabled")
          : localize("Common.Disabled")
      }),
      format("Dialogs.FlameCount", {
        count: savedConfig.candleFlameUuids.length
      }),
      format("Dialogs.LightCount", {
        count: savedConfig.candleLightUuids.length
      }),
      format("Dialogs.BlueDieCount", {
        count: savedConfig.blueDieUuids.length
      }),
      format("Dialogs.RedDieCount", {
        count: savedConfig.redDieUuids.length
      })
    ].join(" — ")
  );

  console.log(`${MODULE_ID} | Configuration du canevas enregistrée :`, clone(savedConfig));

  if (result.syncNow && savedConfig.enabled) {
    await syncCanvasSafely(refreshedState, { notify: true });
  }
}
