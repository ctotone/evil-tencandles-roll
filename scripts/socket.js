/**
 * Communication joueur vers MJ et routage des actions du module.
 */

import { MODULE_ID, SOCKET_NAME } from "./constants.js";
import { isActiveGM } from "./state.js";
import { chooseCharacterActorForRoll } from "./resources.js";
import {
  handleGMRoll,
  handleLimit,
  handlePlayerRoll,
  handleStartNextScene,
  handleValidation,
  handleViceOrVirtue
} from "./resolution.js";
import { notifyRequester } from "./notifications.js";
import { handleDice3DRollMessage } from "./dice.js";

export async function requestPlayerRoll() {
  const actor = await chooseCharacterActorForRoll();
  if (!actor) return;

  return requestAction("player-roll", {
    actorUuid: actor.uuid
  });
}

export async function handleGMRequest(data) {
  const requesterId = data.requesterId;
  const resolutionId = data.payload?.resolutionId;

  switch (data.action) {
    case "player-roll":
      return handlePlayerRoll(requesterId, data.payload?.actorUuid);

    case "gm-roll":
      return handleGMRoll(requesterId, resolutionId);

    case "use-vice":
      return handleViceOrVirtue(requesterId, resolutionId, "vice");

    case "use-virtue":
      return handleViceOrVirtue(requesterId, resolutionId, "virtue");

    case "use-limit":
      return handleLimit(requesterId, resolutionId);

    case "validate-resolution":
      return handleValidation(requesterId, resolutionId);

    case "start-next-scene":
      return handleStartNextScene(requesterId, data.payload);

    default:
      console.warn(`${MODULE_ID} | Action socket inconnue :`, data.action);
  }
}

export async function onSocketMessage(data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "notification") {
    if (data.targetId !== game.user.id) return;

    const level = ["info", "warn", "error"].includes(data.level)
      ? data.level
      : "info";

    ui.notifications[level]?.(data.message);
    return;
  }

  if (data.type === "dice3d-roll") {
    await handleDice3DRollMessage(data);
    return;
  }

  if (data.type !== "request") return;
  if (!isActiveGM()) return;

  try {
    await handleGMRequest(data);
  } catch (error) {
    console.error(`${MODULE_ID} | Erreur de traitement :`, error);
    notifyRequester(
      data.requesterId,
      "error",
      "Une erreur est survenue pendant la résolution Ten Candles."
    );
  }
}

export async function requestAction(action, payload = {}) {
  const activeGM = game.users.activeGM;

  if (!activeGM) {
    ui.notifications.error(
      "Aucun MJ actif n'est disponible pour traiter la résolution Ten Candles."
    );
    return;
  }

  const request = {
    type: "request",
    action,
    requesterId: game.user.id,
    payload
  };

  if (isActiveGM()) {
    await handleGMRequest(request);
    return;
  }

  game.socket.emit(SOCKET_NAME, request);
}
