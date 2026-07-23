/**
 * Cycle complet d'un conflit : jets, relances, validation et nouvelle scène.
 */

import { TOTAL_CANDLES } from "./constants.js";
import { clone } from "./utils.js";
import { getState, saveState } from "./state.js";
import { countValue, getResolutionAnalysis, rollD6Pool } from "./dice.js";
import {
  consumeActorResource,
  getActorResourceState,
  refreshResolutionResources
} from "./resources.js";
import {
  createBallOfTruthsMessage,
  createResolutionMessage,
  renderBallOfTruthsCard,
  updateResolutionMessage
} from "./chat.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { notifyRequester } from "./notifications.js";

export function requesterCanControlResolution(requesterId, resolution) {
  const requester = game.users.get(requesterId);

  return Boolean(
    requester &&
    (requester.isGM || resolution.playerId === requesterId)
  );
}

export function getActionResolution(requesterId, resolutionId) {
  const state = getState();
  const resolution = state.activeResolution;

  if (!resolution || resolution.id !== resolutionId) {
    notifyRequester(
      requesterId,
      "warn",
      "Cette résolution n'est plus active."
    );
    return null;
  }

  if (!requesterCanControlResolution(requesterId, resolution)) {
    notifyRequester(
      requesterId,
      "warn",
      "Tu ne peux pas modifier cette résolution."
    );
    return null;
  }

  return { state, resolution };
}

export async function saveAndRefreshResolution(state, resolution) {
  resolution.updatedAt = Date.now();
  state.activeResolution = resolution;

  await saveState(state);
  await updateResolutionMessage(resolution);
}

export async function handlePlayerRoll(requesterId, actorUuid) {
  const requester = game.users.get(requesterId);
  if (!requester) return;

  const actor = actorUuid ? await fromUuid(actorUuid) : null;

  if (!actor || actor.documentName !== "Actor" || actor.type !== "character") {
    notifyRequester(
      requesterId,
      "warn",
      "Aucun personnage Ten Candles valide n'a été fourni pour ce lancer."
    );
    return;
  }

  if (!requester.isGM && !actor.testUserPermission(requester, "OWNER")) {
    notifyRequester(
      requesterId,
      "warn",
      "Tu ne possèdes pas ce personnage."
    );
    return;
  }

  const state = getState();

  if (state.activeResolution) {
    notifyRequester(
      requesterId,
      "warn",
      "Une résolution Ten Candles est déjà en cours."
    );
    return;
  }

  if (state.stage !== "scene") {
    notifyRequester(
      requesterId,
      "warn",
      "La partie est actuellement au Bal des vérités."
    );
    return;
  }

  if (state.bluePoolRemaining <= 0) {
    notifyRequester(
      requesterId,
      "warn",
      "Aucun dé bleu n'est actuellement disponible."
    );
    return;
  }

  const resources = getActorResourceState(actor);
  const blueResults = await rollD6Pool(state.bluePoolRemaining);
  const hopeResults = resources.canUseMoment
    ? await rollD6Pool(1)
    : [];
  const hopeResult = hopeResults[0] ?? null;
  const redPoolSize = TOTAL_CANDLES - state.litCandles;
  const gmRollCompleted = redPoolSize === 0;

  const resolution = {
    id: foundry.utils.randomID(),
    status: gmRollCompleted ? "pending-validation" : "waiting-gm",
    chatMessageId: null,

    playerId: requester.id,
    actorId: actor.id,
    actorUuid: actor.uuid,
    actorName: actor.name,
    playerName: actor.name,
    simulatedByGM: requester.isGM,

    litCandlesAtRoll: state.litCandles,

    bluePoolSize: state.bluePoolRemaining,
    blueResults,

    momentUsed: hopeResult !== null,
    momentResult: hopeResult,

    redPoolSize,
    redResults: [],
    gmRollCompleted,

    rerolls: {
      vice: false,
      virtue: false,
      limit: false
    },

    resources,

    // La disponibilité de la Limite est figée au début du conflit.
    // Si Vice ou Vertu est consommé pendant ce jet, elle n'apparaîtra
    // qu'à partir du conflit suivant.
    limitAvailableAtStart: Boolean(resources.canUseLimit),

    finalSuccess: null,
    narrator: null,
    blueDiceLost: 0,

    history: [
      {
        type: "player-roll",
        results: clone(blueResults),
        timestamp: Date.now()
      },
      ...(hopeResult !== null
        ? [{
            type: "hope-roll",
            result: hopeResult,
            timestamp: Date.now()
          }]
        : [])
    ],

    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const message = await createResolutionMessage(resolution);
  resolution.chatMessageId = message.id;

  state.activeResolution = resolution;
  await saveState(state);

  notifyRequester(
    requesterId,
    "info",
    [
      `${resolution.bluePoolSize} dé(s) bleu(s) lancé(s) pour ${actor.name}.`,
      hopeResult !== null ? "Le dé d'Espoir a également été lancé." : ""
    ].filter(Boolean).join(" ")
  );
}

export async function handleGMRoll(requesterId, requestedResolutionId = null) {
  if (!game.users.get(requesterId)?.isGM) return;

  const state = getState();
  const resolution = state.activeResolution;

  if (!resolution) {
    notifyRequester(
      requesterId,
      "warn",
      "Aucune résolution joueur n'attend le lancer du MJ."
    );
    return;
  }

  if (requestedResolutionId && resolution.id !== requestedResolutionId) {
    notifyRequester(
      requesterId,
      "warn",
      "Cette carte ne correspond plus à la résolution active."
    );
    return;
  }

  if (resolution.gmRollCompleted) {
    notifyRequester(
      requesterId,
      "warn",
      "Le pool du MJ a déjà été lancé pour cette résolution."
    );
    return;
  }

  resolution.redResults = await rollD6Pool(resolution.redPoolSize);
  resolution.gmRollCompleted = true;
  resolution.status = "pending-validation";
  resolution.history.push({
    type: "gm-roll",
    results: clone(resolution.redResults),
    timestamp: Date.now()
  });

  await saveAndRefreshResolution(state, resolution);
}

export async function handleViceOrVirtue(requesterId, resolutionId, resource) {
  const context = getActionResolution(requesterId, resolutionId);
  if (!context) return;

  const { state, resolution } = context;
  const actor = await refreshResolutionResources(resolution);

  if (!actor) {
    notifyRequester(requesterId, "warn", "Le personnage lié à cette résolution est introuvable.");
    return;
  }

  const resourceKey = resource === "vice" ? "canUseVice" : "canUseVirtue";
  if (!resolution.resources[resourceKey]) {
    notifyRequester(
      requesterId,
      "warn",
      `${resource === "vice" ? "Le Vice" : "La Vertu"} n'est plus disponible.`
    );
    return;
  }

  if (resolution.rerolls.vice || resolution.rerolls.virtue) {
    notifyRequester(
      requesterId,
      "warn",
      "Le Vice ou la Vertu a déjà été utilisé sur cette résolution."
    );
    return;
  }

  const oneCount = countValue(resolution.blueResults, 1);
  if (oneCount === 0) {
    notifyRequester(
      requesterId,
      "warn",
      "Aucun résultat de 1 n'est disponible à relancer."
    );
    return;
  }

  const replacements = await rollD6Pool(oneCount);
  let replacementIndex = 0;

  resolution.blueResults = resolution.blueResults.map((result) => {
    if (result !== 1) return result;

    const replacement = replacements[replacementIndex];
    replacementIndex += 1;
    return replacement;
  });

  await consumeActorResource(actor, resource);
  resolution.rerolls[resource] = true;
  await refreshResolutionResources(resolution);

  resolution.history.push({
    type: resource,
    results: clone(replacements),
    timestamp: Date.now()
  });

  await saveAndRefreshResolution(state, resolution);
}

export async function handleLimit(requesterId, resolutionId) {
  const context = getActionResolution(requesterId, resolutionId);
  if (!context) return;

  const { state, resolution } = context;
  const actor = await refreshResolutionResources(resolution);

  if (!actor) {
    notifyRequester(requesterId, "warn", "Le personnage lié à cette résolution est introuvable.");
    return;
  }

  if (!resolution.limitAvailableAtStart) {
    notifyRequester(
      requesterId,
      "warn",
      "La Limite ne sera disponible qu'au prochain conflit, après consommation du Vice et de la Vertu."
    );
    return;
  }

  if (resolution.rerolls.limit) {
    notifyRequester(
      requesterId,
      "warn",
      "La Limite a déjà été utilisée sur cette résolution."
    );
    return;
  }

  resolution.blueResults = await rollD6Pool(resolution.bluePoolSize);

  // La Limite reste disponible pour les conflits suivants.
  // Ce marqueur empêche seulement une seconde utilisation dans ce conflit.
  resolution.rerolls.limit = true;

  resolution.history.push({
    type: "limit",
    results: clone(resolution.blueResults),
    timestamp: Date.now()
  });

  // Le dé de Moment est volontairement conservé.
  await saveAndRefreshResolution(state, resolution);
}

export async function handleValidation(requesterId, resolutionId) {
  const requester = game.users.get(requesterId);
  if (!requester?.isGM) return;

  const context = getActionResolution(requesterId, resolutionId);
  if (!context) return;

  const { state, resolution } = context;

  if (!resolution.gmRollCompleted) {
    notifyRequester(
      requesterId,
      "warn",
      "Le pool du MJ doit être lancé avant de valider la résolution."
    );
    return;
  }

  const analysis = getResolutionAnalysis(resolution);

  resolution.status = "resolved";
  resolution.finalSuccess = analysis.success;
  resolution.narrator = analysis.narrator;
  resolution.blueDiceLost = analysis.blueOnes;
  resolution.updatedAt = Date.now();
  resolution.history.push({
    type: "validation",
    success: analysis.success,
    narrator: analysis.narrator,
    blueDiceLost: analysis.blueOnes,
    timestamp: Date.now()
  });

  state.bluePoolRemaining = Math.max(
    0,
    resolution.bluePoolSize - resolution.blueDiceLost
  );

  if (!analysis.success) {
    state.stage = "ball-of-truths";
  }

  state.lastResolution = clone(resolution);
  state.activeResolution = null;

  await saveState(state);

  // Les dés bleus perdus sont masqués dès la validation définitive.
  await syncCanvasSafely(state);

  await updateResolutionMessage(resolution);

  if (!analysis.success) {
    await createBallOfTruthsMessage(resolution);
  }
}

export async function handleStartNextScene(requesterId, payload = {}) {
  const requester = game.users.get(requesterId);
  if (!requester?.isGM) return;

  const state = getState();

  if (state.stage !== "ball-of-truths") {
    notifyRequester(
      requesterId,
      "warn",
      "La partie n'est pas actuellement au Bal des vérités."
    );
    return;
  }

  if (state.litCandles <= 0) {
    notifyRequester(
      requesterId,
      "warn",
      "Toutes les bougies sont déjà éteintes."
    );
    return;
  }

  state.litCandles = Math.max(0, state.litCandles - 1);
  state.bluePoolRemaining = state.litCandles;
  state.stage = "scene";

  await saveState(state);

  // Une flamme et une lumière sont masquées, le pool bleu est restauré
  // et un dé rouge supplémentaire devient visible.
  await syncCanvasSafely(state, { notify: true });

  const message = game.messages.get(payload.messageId);
  const resolution = state.lastResolution;

  if (message && resolution) {
    await message.update({
      content: renderBallOfTruthsCard(resolution, {
        completed: true,
        litCandles: state.litCandles
      })
    });
  }

  notifyRequester(
    requesterId,
    "info",
    `Nouvelle scène : ${state.litCandles} bougie(s) et ${state.bluePoolRemaining} dé(s) joueur.`
  );
}

export async function cancelActiveResolution({ updateMessage = true } = {}) {
  const state = getState();
  const resolution = state.activeResolution;
  if (!resolution) return false;

  resolution.status = "cancelled";
  resolution.updatedAt = Date.now();

  state.lastResolution = resolution;
  state.activeResolution = null;
  await saveState(state);

  if (updateMessage) await updateResolutionMessage(resolution);
  return true;
}
