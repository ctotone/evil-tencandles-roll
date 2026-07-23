/**
 * Boutons de la barre Tokens et interactions avec les cartes du chat.
 */

import { MODULE_ID } from "./constants.js";
import { getState } from "./state.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { openCanvasSetup, openGMSetup } from "./dialogs.js";
import { requestAction, requestPlayerRoll } from "./socket.js";

export function activateChatMessageActions(message, html) {
  const resolutionId = message.getFlag(MODULE_ID, "resolutionId");
  if (!resolutionId) return;

  const card = html.querySelector(".etc-card[data-etc-resolution-id]");
  if (!card) return;

  const playerId = card.dataset.etcPlayerId;
  const canUsePlayerActions =
    game.user.isGM || (playerId && game.user.id === playerId);

  const playerActions = card.querySelector("[data-etc-player-actions]");
  const gmActions = card.querySelectorAll("[data-etc-gm-actions]");
  const gmRollTriggers = card.querySelectorAll("[data-etc-gm-roll-trigger]");

  if (playerActions) {
    playerActions.hidden = !canUsePlayerActions;

    const playerRow = playerActions.closest(".etc-player-row");
    playerRow?.classList.toggle(
      "etc-player-row--has-actions",
      canUsePlayerActions
    );
  }

  for (const group of gmActions) {
    group.hidden = !game.user.isGM;

    const gmRow = group.closest(".etc-gm-row");
    gmRow?.classList.toggle(
      "etc-gm-row--has-actions",
      game.user.isGM
    );
  }

  for (const trigger of gmRollTriggers) {
    trigger.disabled = !game.user.isGM;

    if (!game.user.isGM) {
      trigger.title = "En attente du lancer du MJ";
    }
  }

  for (const button of card.querySelectorAll("[data-etc-action]")) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();

      if (button.disabled) return;

      const action = button.dataset.etcAction;
      button.disabled = true;

      try {
        await requestAction(action, {
          resolutionId,
          messageId: message.id
        });
      } finally {
        window.setTimeout(() => {
          if (button.isConnected) button.disabled = false;
        }, 750);
      }
    });
  }
}

export function registerSceneControlButtons(controls) {
  const tokenControl = controls.tokens;
  if (!tokenControl?.tools) {
    console.warn(`${MODULE_ID} | Le groupe de contrôles Tokens est introuvable.`);
    return;
  }

  tokenControl.tools["evil-tencandles-player-roll"] = {
    name: "evil-tencandles-player-roll",
    title: "Ten Candles : lancer le pool joueur",
    icon: "fa-solid fa-dice-d6",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,
    onChange: () => requestPlayerRoll()
  };

  tokenControl.tools["evil-tencandles-gm-roll"] = {
    name: "evil-tencandles-gm-roll",
    title: "Ten Candles : lancer le pool MJ",
    icon: "fa-solid fa-dice",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => requestAction("gm-roll")
  };

  tokenControl.tools["evil-tencandles-canvas-config"] = {
    name: "evil-tencandles-canvas-config",
    title: "Ten Candles : configurer le canevas",
    icon: "fa-solid fa-link",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => openCanvasSetup()
  };

  tokenControl.tools["evil-tencandles-canvas-sync"] = {
    name: "evil-tencandles-canvas-sync",
    title: "Ten Candles : synchroniser le canevas",
    icon: "fa-solid fa-arrows-rotate",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => syncCanvasSafely(getState(), { notify: true })
  };

  tokenControl.tools["evil-tencandles-dev-settings"] = {
    name: "evil-tencandles-dev-settings",
    title: "Ten Candles : réglages de développement",
    icon: "fa-solid fa-gear",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => openGMSetup()
  };
}
