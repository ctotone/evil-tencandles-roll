/**
 * Boutons de la barre Tokens et interactions avec les cartes du chat.
 */

import { MODULE_ID } from "./constants.js";
import { getState } from "./state.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { openCanvasSetup, openGMSetup } from "./dialogs.js";
import { requestAction, requestPlayerRoll } from "./socket.js";
import {
  chooseCharacterActorForRoll,
  openSelectedActorResourceStatus,
  resetActorResources
} from "./resources.js";

const FLOATING_ROLL_BUTTON_ID = `${MODULE_ID}-floating-roll`;
let floatingRollBusy = false;

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


function getFloatingRollButtonState() {
  const activeGM = game.users.activeGM;
  const state = getState();

  if (floatingRollBusy) {
    return {
      disabled: true,
      title: "Préparation du conflit en cours..."
    };
  }

  if (!activeGM) {
    return {
      disabled: true,
      title: "Aucun MJ actif n'est disponible."
    };
  }

  if (state.activeResolution) {
    return {
      disabled: true,
      title: "Un conflit est déjà en cours de résolution."
    };
  }

  if (state.stage !== "scene") {
    return {
      disabled: true,
      title: "La partie est actuellement au Bal des vérités."
    };
  }

  if (state.bluePoolRemaining <= 0) {
    return {
      disabled: true,
      title: "Aucun dé joueur n'est disponible pour lancer un conflit."
    };
  }

  return {
    disabled: false,
    title: "Lancer un nouveau conflit."
  };
}

export function refreshFloatingPlayerRollButton() {
  const button = document.getElementById(FLOATING_ROLL_BUTTON_ID);
  if (!button) return;

  const state = getFloatingRollButtonState();

  button.disabled = state.disabled;
  button.title = state.title;
  button.setAttribute("aria-label", `Lancer les dés — ${state.title}`);
  button.setAttribute("aria-busy", floatingRollBusy ? "true" : "false");
  button.classList.toggle("etc-floating-roll--busy", floatingRollBusy);
}

export function mountFloatingPlayerRollButton() {
  let button = document.getElementById(FLOATING_ROLL_BUTTON_ID);

  if (!button) {
    button = document.createElement("button");
    button.id = FLOATING_ROLL_BUTTON_ID;
    button.type = "button";
    button.className = "etc-floating-roll";
    button.innerHTML = `
      <i class="fa-solid fa-dice-d6" aria-hidden="true"></i>
      <span>Lancer les dés</span>
    `;

    button.addEventListener("click", async (event) => {
      event.preventDefault();

      if (button.disabled || floatingRollBusy) return;

      floatingRollBusy = true;
      refreshFloatingPlayerRollButton();

      try {
        await requestPlayerRoll();
      } finally {
        window.setTimeout(() => {
          floatingRollBusy = false;
          refreshFloatingPlayerRollButton();
        }, 750);
      }
    });

    document.body.append(button);
  }

  refreshFloatingPlayerRollButton();
}

async function resetSelectedActorResourcesFromControl() {
  if (!game.user.isGM) {
    ui.notifications.warn("Cette action est réservée au MJ.");
    return false;
  }

  const actor = await chooseCharacterActorForRoll();
  if (!actor) return false;

  return resetActorResources(actor);
}

function getTenCandlesControlOrder(controls) {
  const notesOrder = Number.isFinite(controls.notes?.order)
    ? controls.notes.order
    : null;

  if (notesOrder === null) {
    const existingOrders = Object.values(controls)
      .map((control) => control?.order)
      .filter(Number.isFinite);

    return existingOrders.length
      ? Math.max(...existingOrders) + 1
      : 0;
  }

  const desiredOrder = notesOrder + 1;

  for (const control of Object.values(controls)) {
    if (
      control !== controls.notes &&
      Number.isFinite(control?.order) &&
      control.order >= desiredOrder
    ) {
      control.order += 1;
    }
  }

  return desiredOrder;
}

export function registerSceneControlButtons(controls) {
  const tokenControl = controls.tokens;

  if (!tokenControl?.tools) {
    console.warn(`${MODULE_ID} | Le groupe de contrôles Tokens est introuvable.`);
  } else {
    // Accès joueur conservé dans Tokens en complément du bouton flottant.
    tokenControl.tools["evil-tencandles-player-roll"] = {
      name: "evil-tencandles-player-roll",
      title: "Ten Candles : lancer le pool joueur",
      icon: "fa-solid fa-dice-d6",
      order: Object.keys(tokenControl.tools).length,
      button: true,
      visible: true,
      onChange: () => requestPlayerRoll()
    };
  }

  if (!game.user.isGM) return;

  controls["evil-tencandles-gm"] = {
    name: "evil-tencandles-gm",
    title: "Ten Candles — Régie MJ",
    icon: "fa-solid fa-fire-flame-curved",
    order: getTenCandlesControlOrder(controls),
    visible: true,
    tools: {
      "evil-tencandles-gm-roll": {
        name: "evil-tencandles-gm-roll",
        title: "Ten Candles : lancer le pool MJ",
        icon: "fa-solid fa-dice",
        order: 0,
        button: true,
        visible: true,
        onChange: () => requestAction("gm-roll")
      },

      "evil-tencandles-resource-status": {
        name: "evil-tencandles-resource-status",
        title: "Ten Candles : contrôler Vertu, Vice et Limite",
        icon: "fa-solid fa-eye",
        order: 1,
        button: true,
        visible: true,
        onChange: () => openSelectedActorResourceStatus()
      },

      "evil-tencandles-resource-reset": {
        name: "evil-tencandles-resource-reset",
        title: "Ten Candles : réinitialiser Vertu et Vice",
        icon: "fa-solid fa-rotate-left",
        order: 2,
        button: true,
        visible: true,
        onChange: () => resetSelectedActorResourcesFromControl()
      },

      "evil-tencandles-canvas-config": {
        name: "evil-tencandles-canvas-config",
        title: "Ten Candles : configurer le canevas",
        icon: "fa-solid fa-link",
        order: 3,
        button: true,
        visible: true,
        onChange: () => openCanvasSetup()
      },

      "evil-tencandles-canvas-sync": {
        name: "evil-tencandles-canvas-sync",
        title: "Ten Candles : synchroniser le canevas",
        icon: "fa-solid fa-arrows-rotate",
        order: 4,
        button: true,
        visible: true,
        onChange: () => syncCanvasSafely(getState(), { notify: true })
      },

      "evil-tencandles-dev-settings": {
        name: "evil-tencandles-dev-settings",
        title: "Ten Candles : réglages de développement",
        icon: "fa-solid fa-gear",
        order: 5,
        button: true,
        visible: true,
        onChange: () => openGMSetup()
      }
    }
  };
}

