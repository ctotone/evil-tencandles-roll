/**
 * Cycle complet d'un conflit : jets, relances, validation et nouvelle scène.
 */

import { TOTAL_CANDLES } from "./constants.js";
import { clone, format, localize } from "./utils.js";
import { getState, saveState } from "./state.js";
import {
  countValue,
  getResolutionAnalysis,
  rollD6Pool,
  rollPlayerD6Pool
} from "./dice.js";
import {
  consumeActorResource,
  getActorResourceState,
  refreshResolutionResources
} from "./resources.js";
import {
  createBallOfTruthsMessage,
  createCharacterDepartureMessage,
  createDarknessProgressionMessage,
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
      localize("Notifications.ResolutionInactive")
    );
    return null;
  }

  if (!requesterCanControlResolution(requesterId, resolution)) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.CannotModifyResolution")
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
      localize("Notifications.InvalidActor")
    );
    return;
  }

  if (!requester.isGM && !actor.testUserPermission(requester, "OWNER")) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.NotOwner")
    );
    return;
  }

  const state = getState();

  if (state.activeResolution) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.ActiveResolution")
    );
    return;
  }

  if (state.stage !== "scene") {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.BallActive")
    );
    return;
  }

  if (state.bluePoolRemaining <= 0) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.NoBlueDice")
    );
    return;
  }

  const resources = getActorResourceState(actor);
  const {
    blueResults,
    hopeResult
  } = await rollPlayerD6Pool(state.bluePoolRemaining, {
    includeHope: resources.canUseMoment,
    userId: requesterId,
    actorId: actor.id
  });
  const redPoolSize = TOTAL_CANDLES - state.litCandles;
  const gmRollCompleted = redPoolSize === 0;

  const resolution = {
    id: foundry.utils.randomID(),
    status: "pending-validation",
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
    gmRollSkipped: false,

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
      format("Notifications.PlayerRollDone", {
        count: resolution.bluePoolSize,
        name: actor.name
      }),
      hopeResult !== null
        ? localize("Notifications.HopeRolled")
        : ""
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
      localize("Notifications.NoPendingResolution")
    );
    return;
  }

  if (requestedResolutionId && resolution.id !== requestedResolutionId) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.CardOutdated")
    );
    return;
  }

  if (resolution.gmRollCompleted) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.GMAlreadyRolled")
    );
    return;
  }

  resolution.redResults = await rollD6Pool(
    resolution.redPoolSize,
    { userId: requesterId }
  );
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
    notifyRequester(requesterId, "warn", localize("Notifications.ActorMissing"));
    return;
  }

  const resourceKey = resource === "vice" ? "canUseVice" : "canUseVirtue";
  if (!resolution.resources[resourceKey]) {
    notifyRequester(
      requesterId,
      "warn",
      format("Notifications.ResourceUnavailable", {
        resource: resource === "vice"
          ? localize("Resources.Vice")
          : localize("Resources.Virtue")
      })
    );
    return;
  }

  if (resolution.rerolls.vice || resolution.rerolls.virtue) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.ViceVirtueUsed")
    );
    return;
  }

  const oneCount = countValue(resolution.blueResults, 1);
  if (oneCount === 0) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.NoOnes")
    );
    return;
  }

  const replacements = await rollD6Pool(oneCount, {
    userId: resolution.playerId,
    actorId: resolution.actorId
  });
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
    notifyRequester(requesterId, "warn", localize("Notifications.ActorMissing"));
    return;
  }

  if (!resolution.limitAvailableAtStart) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.LimitNextConflict")
    );
    return;
  }

  if (resolution.rerolls.limit) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.LimitUsed")
    );
    return;
  }

  resolution.blueResults = await rollD6Pool(
    resolution.bluePoolSize,
    {
      userId: resolution.playerId,
      actorId: resolution.actorId
    }
  );

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

  const gmRollSkipped =
    resolution.redPoolSize > 0 &&
    !resolution.gmRollCompleted;

  if (gmRollSkipped) {
    resolution.gmRollSkipped = true;
    resolution.redResults = [];
    resolution.history.push({
      type: "gm-roll-skipped",
      timestamp: Date.now()
    });
  }

  const analysis = getResolutionAnalysis(resolution);
  const characterDeparture =
    !analysis.success &&
    Number(resolution.litCandlesAtRoll) === 1;

  resolution.status = "resolved";
  resolution.finalSuccess = analysis.success;
  resolution.narrator = analysis.narrator;
  resolution.characterDeparture = characterDeparture;

  // Lors de la dernière bougie, un personnage qui échoue quitte la partie,
  // mais l'unique dé reste disponible pour les personnages encore en vie.
  resolution.blueDiceLost = characterDeparture
    ? 0
    : analysis.blueOnes;

  resolution.updatedAt = Date.now();
  resolution.history.push({
    type: "validation",
    success: analysis.success,
    narrator: analysis.narrator,
    blueDiceLost: resolution.blueDiceLost,
    characterDeparture,
    gmRollSkipped,
    timestamp: Date.now()
  });

  if (characterDeparture) {
    state.bluePoolRemaining = 1;
    state.stage = "scene";
  } else {
    state.bluePoolRemaining = Math.max(
      0,
      resolution.bluePoolSize - resolution.blueDiceLost
    );

    if (!analysis.success) {
      state.stage = "ball-of-truths";
    }
  }

  state.lastResolution = clone(resolution);
  state.activeResolution = null;

  await saveState(state);

  // Les dés bleus perdus sont masqués dès la validation définitive.
  await syncCanvasSafely(state);

  await updateResolutionMessage(resolution);

  if (characterDeparture) {
    await createCharacterDepartureMessage(resolution);
  } else if (!analysis.success) {
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
      localize("Notifications.NotBallActive")
    );
    return;
  }

  if (state.litCandles <= 0) {
    notifyRequester(
      requesterId,
      "warn",
      localize("Notifications.AllCandlesOut")
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

  await createDarknessProgressionMessage(state.litCandles);

  notifyRequester(
    requesterId,
    "info",
    format("Notifications.NextScene", {
      candles: state.litCandles,
      dice: state.bluePoolRemaining
    })
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
