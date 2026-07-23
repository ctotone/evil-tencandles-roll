/**
 * Point d'entrée du module.
 *
 * Ce fichier enregistre les hooks Foundry et expose une petite API publique
 * utilisée par les macros. La logique métier se trouve dans les autres scripts.
 */

import {
  I18N_PREFIX,
  MODULE_ID,
  SOCKET_NAME,
  STATE_KEY
} from "./constants.js";
import {
  createDefaultState,
  getState,
  isActiveGM,
  saveState
} from "./state.js";
import { clone } from "./utils.js";
import {
  chooseCharacterActorForRoll,
  getActorResourceState,
  resetActorResources
} from "./resources.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { cancelActiveResolution } from "./resolution.js";
import { openCanvasSetup, openGMSetup } from "./dialogs.js";
import { onSocketMessage, requestAction, requestPlayerRoll } from "./socket.js";
import {
  activateChatMessageActions,
  registerSceneControlButtons
} from "./controls.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STATE_KEY, {
    name: `${I18N_PREFIX}.Settings.StateName`,
    hint: `${I18N_PREFIX}.Settings.StateHint`,
    scope: "world",
    config: false,
    type: Object,
    default: createDefaultState()
  });

  console.log(`${MODULE_ID} | Initialisation.`);
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET_NAME, onSocketMessage);

  game.evilTenCandlesRoll = {
    getState,
    openGMSetup,
    openCanvasSetup,
    syncCanvas: () => syncCanvasSafely(getState(), { notify: true }),
    diagnoseCanvas: () => syncCanvasSafely(getState(), { notify: true }),
    requestPlayerRoll,
    requestGMRoll: () => requestAction("gm-roll"),
    cancelActiveResolution,

    getSelectedActorResources: async () => {
      const actor = await chooseCharacterActorForRoll();
      if (!actor) return null;

      const resources = getActorResourceState(actor);
      console.log(`${MODULE_ID} | Ressources de ${actor.name} :`, resources);
      return resources;
    },

    resetSelectedActorResources: async () => {
      if (!game.user.isGM) {
        ui.notifications.warn("Cette action est réservée au MJ.");
        return false;
      }

      const actor = await chooseCharacterActorForRoll();
      if (!actor) return false;

      return resetActorResources(actor);
    },

    resetState: async () => {
      if (!game.user.isGM) {
        ui.notifications.warn("Cette action est réservée au MJ.");
        return;
      }

      const currentState = getState();
      const resetState = createDefaultState();

      // La configuration des UUID est conservée lors d'un reset de partie.
      resetState.canvasSync = clone(currentState.canvasSync);

      await saveState(resetState);
      await syncCanvasSafely(resetState);

      ui.notifications.info("L'état Ten Candles a été réinitialisé.");
    }
  };

  console.log(`${MODULE_ID} | Prêt.`);
});

Hooks.on("getSceneControlButtons", registerSceneControlButtons);
Hooks.on("renderChatMessageHTML", activateChatMessageActions);

Hooks.on("canvasReady", async () => {
  if (!isActiveGM()) return;

  const state = getState();
  const config = state.canvasSync;

  if (!config.enabled) return;
  if (config.sceneId && canvas.scene?.id !== config.sceneId) return;

  await syncCanvasSafely(state);
});
