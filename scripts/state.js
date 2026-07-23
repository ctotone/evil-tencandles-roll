/**
 * État persistant du monde : bougies, pools, résolution active et canevas.
 */

import { MODULE_ID, STATE_KEY, TOTAL_CANDLES } from "./constants.js";
import {
  clampInteger,
  clone,
  normalizeSceneId,
  normalizeUuidList
} from "./utils.js";

export function createDefaultCanvasSync() {
  return {
    enabled: false,
    sceneId: null,
    candleFlameUuids: [],
    candleLightUuids: [],
    blueDieUuids: [],
    redDieUuids: []
  };
}

export function createDefaultState() {
  return {
    schemaVersion: 2,

    // État général de la partie
    stage: "scene",
    litCandles: 10,
    bluePoolRemaining: 10,

    // Configuration de la scène de jeu
    canvasSync: createDefaultCanvasSync(),

    // Une seule résolution peut être active à la fois
    activeResolution: null,

    // Utile pour le débogage et les futures fonctions d'annulation
    lastResolution: null
  };
}

export function normalizeCanvasSync(rawConfig) {
  const config = foundry.utils.mergeObject(
    createDefaultCanvasSync(),
    rawConfig ?? {},
    {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true
    }
  );

  config.enabled = Boolean(config.enabled);
  config.sceneId = normalizeSceneId(config.sceneId);
  config.candleFlameUuids = normalizeUuidList(config.candleFlameUuids);
  config.candleLightUuids = normalizeUuidList(config.candleLightUuids);
  config.blueDieUuids = normalizeUuidList(config.blueDieUuids);
  config.redDieUuids = normalizeUuidList(config.redDieUuids);

  // Nettoyage des anciennes versions de test.
  delete config.visualAlphaByUuid;

  return config;
}

export function normalizeState(rawState) {
  const defaults = createDefaultState();
  const state = foundry.utils.mergeObject(defaults, rawState ?? {}, {
    inplace: false,
    insertKeys: true,
    insertValues: true,
    overwrite: true
  });

  state.schemaVersion = 2;
  state.stage = state.stage === "ball-of-truths" ? "ball-of-truths" : "scene";
  state.litCandles = clampInteger(state.litCandles, 0, TOTAL_CANDLES);
  state.bluePoolRemaining = clampInteger(
    state.bluePoolRemaining,
    0,
    state.litCandles
  );
  state.canvasSync = normalizeCanvasSync(state.canvasSync);

  if (state.activeResolution) {
    const resolution = state.activeResolution;

    resolution.rerolls = {
      vice: false,
      virtue: false,
      limit: false,
      ...(resolution.rerolls ?? {})
    };

    resolution.history = Array.isArray(resolution.history)
      ? resolution.history
      : [];

    resolution.characterDeparture = Boolean(
      resolution.characterDeparture
    );

    resolution.momentUsed = Boolean(resolution.momentUsed);
    resolution.momentResult = resolution.momentUsed
      ? resolution.momentResult
      : null;

    resolution.gmRollCompleted = Boolean(resolution.gmRollCompleted);
    resolution.gmRollSkipped = Boolean(resolution.gmRollSkipped);
    resolution.actorId = resolution.actorId ?? null;
    resolution.actorUuid = resolution.actorUuid ?? null;
    resolution.actorName = resolution.actorName ?? null;
    resolution.resources = {
      canUseVice: false,
      canUseVirtue: false,
      canUseMoment: false,
      canUseLimit: false,
      ...(resolution.resources ?? {})
    };

    if (typeof resolution.limitAvailableAtStart !== "boolean") {
      const unlockedDuringCurrentResolution = resolution.history.some(
        (entry) => entry?.type === "vice" || entry?.type === "virtue"
      );

      resolution.limitAvailableAtStart =
        Boolean(resolution.resources.canUseLimit) &&
        !unlockedDuringCurrentResolution;
    }
  }

  return state;
}

export function getState() {
  return normalizeState(clone(game.settings.get(MODULE_ID, STATE_KEY)));
}

export async function saveState(state) {
  if (!game.user.isGM) {
    throw new Error(`${MODULE_ID} | Seul un MJ peut enregistrer l'état du module.`);
  }

  return game.settings.set(MODULE_ID, STATE_KEY, normalizeState(state));
}

export function isActiveGM() {
  return Boolean(game.user.isGM && game.users.activeGM?.id === game.user.id);
}
