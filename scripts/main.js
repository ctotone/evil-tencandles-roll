const MODULE_ID = "evil-tencandles-roll";
const SOCKET_NAME = `module.${MODULE_ID}`;
const STATE_KEY = "gameState";
const TOTAL_CANDLES = 10;

function createDefaultState() {
  return {
    schemaVersion: 1,

    // État général de la partie
    stage: "scene",
    litCandles: 10,
    bluePoolRemaining: 10,

    // Une seule résolution peut être active à la fois
    activeResolution: null,

    // Conservé pour le débogage et les futures fonctions d'annulation
    lastResolution: null
  };
}

function clone(data) {
  return foundry.utils.deepClone(data);
}

function clampInteger(value, minimum, maximum) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const state = foundry.utils.mergeObject(defaults, rawState ?? {}, {
    inplace: false,
    insertKeys: true,
    insertValues: true,
    overwrite: true
  });

  state.schemaVersion = 1;
  state.stage = state.stage === "ball-of-truths" ? "ball-of-truths" : "scene";
  state.litCandles = clampInteger(state.litCandles, 0, TOTAL_CANDLES);
  state.bluePoolRemaining = clampInteger(
    state.bluePoolRemaining,
    0,
    state.litCandles
  );

  return state;
}

function getState() {
  return normalizeState(clone(game.settings.get(MODULE_ID, STATE_KEY)));
}

async function saveState(state) {
  if (!game.user.isGM) {
    throw new Error(`${MODULE_ID} | Seul un MJ peut enregistrer l'état du module.`);
  }

  return game.settings.set(MODULE_ID, STATE_KEY, normalizeState(state));
}

function isActiveGM() {
  return Boolean(game.user.isGM && game.users.activeGM?.id === game.user.id);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function rollD6Pool(numberOfDice) {
  const count = clampInteger(numberOfDice, 0, TOTAL_CANDLES);
  if (count === 0) return [];

  const roll = new foundry.dice.Roll(`${count}d6`);
  await roll.evaluate({ allowInteractive: false });

  return roll.dice.flatMap((die) =>
    die.results
      .filter((result) => result.active !== false)
      .map((result) => result.result)
  );
}

function countValue(results, value) {
  return results.filter((result) => result === value).length;
}

function renderDice(results, color) {
  if (!results?.length) {
    return '<span class="etc-empty">Aucun dé</span>';
  }

  return results
    .map((result) => {
      const classes = ["etc-die", `etc-die--${color}`];
      if (result === 1) classes.push("etc-die--one");
      if (result === 6) classes.push("etc-die--six");

      return `<span class="${classes.join(" ")}" title="d6 : ${result}">${result}</span>`;
    })
    .join("");
}

function renderResolutionCard(resolution) {
  const blueSixes = countValue(resolution.blueResults, 6);
  const blueOnes = countValue(resolution.blueResults, 1);
  const redSixes = countValue(resolution.redResults, 6);

  const statusLabel = {
    "waiting-gm": "En attente du lancer du MJ",
    "pending-validation": "Jets réunis — résolution à venir",
    resolved: "Résolution terminée",
    cancelled: "Résolution annulée"
  }[resolution.status] ?? resolution.status;

  const redSection = resolution.gmRollCompleted
    ? `
      <section class="etc-pool">
        <div class="etc-pool__heading">
          <strong>Pool du MJ</strong>
          <span>${resolution.redPoolSize} dé(s) — ${redSixes} résultat(s) de 6</span>
        </div>
        <div class="etc-dice-row">${renderDice(resolution.redResults, "red")}</div>
      </section>
    `
    : `
      <section class="etc-pool etc-pool--waiting">
        <div class="etc-pool__heading">
          <strong>Pool du MJ</strong>
          <span>${resolution.redPoolSize} dé(s) à lancer</span>
        </div>
        <p>Le MJ doit cliquer sur le bouton Ten Candles.</p>
      </section>
    `;

  return `
    <article class="etc-card" data-etc-resolution-id="${escapeHTML(resolution.id)}">
      <header class="etc-card__header">
        <div>
          <h3>Ten Candles — Résolution</h3>
          <p>${escapeHTML(resolution.playerName)}</p>
        </div>
        <span class="etc-status">${escapeHTML(statusLabel)}</span>
      </header>

      <div class="etc-summary">
        <span><strong>${resolution.litCandlesAtRoll}</strong> bougie(s) allumée(s)</span>
        <span><strong>${resolution.bluePoolSize}</strong> dé(s) joueur</span>
        <span><strong>${resolution.redPoolSize}</strong> dé(s) MJ</span>
      </div>

      <section class="etc-pool">
        <div class="etc-pool__heading">
          <strong>Pool du joueur</strong>
          <span>${blueSixes} résultat(s) de 6 — ${blueOnes} résultat(s) de 1</span>
        </div>
        <div class="etc-dice-row">${renderDice(resolution.blueResults, "blue")}</div>
      </section>

      ${redSection}

      <footer class="etc-card__footer">
        <span>Résolution : ${escapeHTML(resolution.id)}</span>
      </footer>
    </article>
  `;
}

async function createResolutionMessage(resolution) {
  const message = await foundry.documents.ChatMessage.create({
    user: resolution.playerId,
    speaker: {
      alias: resolution.playerName
    },
    content: renderResolutionCard(resolution),
    flags: {
      [MODULE_ID]: {
        resolutionId: resolution.id
      }
    }
  });

  return message;
}

async function updateResolutionMessage(resolution) {
  if (!resolution.chatMessageId) return;

  const message = game.messages.get(resolution.chatMessageId);
  if (!message) {
    console.warn(`${MODULE_ID} | Message de résolution introuvable.`);
    return;
  }

  await message.update({
    content: renderResolutionCard(resolution)
  });
}

function sendNotification(targetId, level, message) {
  game.socket.emit(SOCKET_NAME, {
    type: "notification",
    targetId,
    level,
    message
  });
}

function notifyRequester(requesterId, level, message) {
  if (requesterId === game.user.id) {
    ui.notifications[level]?.(message);
    return;
  }

  sendNotification(requesterId, level, message);
}

async function handlePlayerRoll(requesterId) {
  const requester = game.users.get(requesterId);
  if (!requester || requester.isGM) return;

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

  const blueResults = await rollD6Pool(state.bluePoolRemaining);
  const resolution = {
    id: foundry.utils.randomID(),
    status: "waiting-gm",
    chatMessageId: null,

    playerId: requester.id,
    actorId: null,
    playerName: requester.name,

    litCandlesAtRoll: state.litCandles,

    bluePoolSize: state.bluePoolRemaining,
    blueResults,

    momentUsed: false,
    momentResult: null,

    redPoolSize: TOTAL_CANDLES - state.litCandles,
    redResults: [],
    gmRollCompleted: false,

    rerolls: {
      vice: false,
      virtue: false,
      limit: false
    },

    finalSuccess: null,
    narrator: null,
    blueDiceLost: 0,

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
    `${resolution.bluePoolSize} dé(s) bleu(s) lancé(s).`
  );
}

async function handleGMRoll(requesterId) {
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

  if (resolution.gmRollCompleted) {
    notifyRequester(
      requesterId,
      "warn",
      "Le pool rouge a déjà été lancé pour cette résolution."
    );
    return;
  }

  resolution.redResults = await rollD6Pool(resolution.redPoolSize);
  resolution.gmRollCompleted = true;
  resolution.status = "pending-validation";
  resolution.updatedAt = Date.now();

  state.activeResolution = resolution;
  await saveState(state);
  await updateResolutionMessage(resolution);
}

async function cancelActiveResolution({ updateMessage = true } = {}) {
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

async function openGMSetup() {
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

        <label class="etc-dialog__checkbox">
          <input type="checkbox" name="cancelResolution">
          <span>Annuler la résolution active</span>
        </label>
      </div>
    `,
    ok: {
      label: "Enregistrer"
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
  await saveState(refreshedState);

  ui.notifications.info(
    `Ten Candles : ${litCandles} bougie(s), ${bluePoolRemaining} dé(s) bleu(s).`
  );
}

async function handleGMRequest(data) {
  const requesterId = data.requesterId;

  switch (data.action) {
    case "player-roll":
      return handlePlayerRoll(requesterId);

    case "gm-roll":
      return handleGMRoll(requesterId);

    default:
      console.warn(`${MODULE_ID} | Action socket inconnue :`, data.action);
  }
}

async function onSocketMessage(data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "notification") {
    if (data.targetId !== game.user.id) return;

    const level = ["info", "warn", "error"].includes(data.level)
      ? data.level
      : "info";

    ui.notifications[level]?.(data.message);
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
      "Une erreur est survenue pendant le lancer Ten Candles."
    );
  }
}

async function requestAction(action, payload = {}) {
  const activeGM = game.users.activeGM;

  if (!activeGM) {
    ui.notifications.error(
      "Aucun MJ actif n'est disponible pour traiter le lancer Ten Candles."
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

function registerSceneControlButtons(controls) {
  const tokenControl = controls.tokens;
  if (!tokenControl?.tools) {
    console.warn(`${MODULE_ID} | Le groupe de contrôles Tokens est introuvable.`);
    return;
  }

  tokenControl.tools["evil-tencandles-main-roll"] = {
    name: "evil-tencandles-main-roll",
    title: game.user.isGM
      ? "Ten Candles : lancer le pool rouge"
      : "Ten Candles : lancer le pool bleu",
    icon: "fa-solid fa-dice-d6",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,
    onChange: () =>
      requestAction(game.user.isGM ? "gm-roll" : "player-roll")
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

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STATE_KEY, {
    name: "État interne de Ten Candles",
    hint: "État persistant utilisé par le module.",
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
    requestRoll: () =>
      requestAction(game.user.isGM ? "gm-roll" : "player-roll"),
    cancelActiveResolution,
    resetState: async () => {
      if (!game.user.isGM) {
        ui.notifications.warn("Cette action est réservée au MJ.");
        return;
      }

      await saveState(createDefaultState());
      ui.notifications.info("L'état Ten Candles a été réinitialisé.");
    }
  };

  console.log(`${MODULE_ID} | Prêt.`);
});

Hooks.on("getSceneControlButtons", registerSceneControlButtons);
