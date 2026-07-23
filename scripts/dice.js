/**
 * Lancers de dés et interprétation mathématique d'une résolution.
 */

import { MODULE_ID, SOCKET_NAME, TOTAL_CANDLES } from "./constants.js";
import { clampInteger } from "./utils.js";

function getActiveDieResults(die) {
  return (die?.results ?? [])
    .filter((result) => result.active !== false)
    .map((result) => result.result);
}

let warnedDice3DUnavailable = false;
let warnedDice3DDisabled = false;
let warnedDice3DRejected = false;

function getRollClass() {
  return (
    CONFIG.Dice.rolls?.[0] ??
    foundry.dice.Roll.defaultImplementation ??
    foundry.dice.Roll
  );
}

function serializeRoll(roll) {
  const data = roll.toJSON();
  return typeof data === "string"
    ? data
    : JSON.stringify(data);
}

function deserializeRoll(serializedRoll) {
  const RollClass = getRollClass();
  const json = typeof serializedRoll === "string"
    ? serializedRoll
    : JSON.stringify(serializedRoll);

  if (typeof RollClass.fromJSON === "function") {
    return RollClass.fromJSON(json);
  }

  const data = JSON.parse(json);

  if (typeof RollClass.fromData === "function") {
    return RollClass.fromData(data);
  }

  throw new Error(
    "La classe Roll active ne permet pas de reconstruire un jet sérialisé."
  );
}

/**
 * Affiche localement un Roll avec l'apparence Dice So Nice de l'utilisateur
 * fourni. La synchronisation native de Dice So Nice est volontairement
 * désactivée : le module diffuse lui-même le Roll déjà évalué à tous les
 * clients afin de préserver exactement les mêmes résultats.
 */
async function showRollIn3DLocal(
  roll,
  userId,
  { notify = true } = {}
) {
  const dice3d = game.dice3d;
  const diceSoNiceActive =
    game.modules.get("dice-so-nice")?.active === true;

  if (
    !diceSoNiceActive ||
    typeof dice3d?.showForRoll !== "function"
  ) {
    if (notify && !warnedDice3DUnavailable) {
      warnedDice3DUnavailable = true;
      ui.notifications.warn(
        "Les dés 3D nécessitent que le module Dice So Nice soit installé et activé."
      );
      console.warn(
        `${MODULE_ID} | Dice So Nice est absent ou son API n'est pas disponible.`
      );
    }
    return false;
  }

  if (
    typeof dice3d.isEnabled === "function" &&
    !dice3d.isEnabled()
  ) {
    if (notify && !warnedDice3DDisabled) {
      warnedDice3DDisabled = true;
      ui.notifications.warn(
        "Dice So Nice est actif, mais l'affichage des dés 3D est désactivé dans ses réglages."
      );
      console.warn(
        `${MODULE_ID} | Dice So Nice est actif mais désactivé pour ce client.`
      );
    }
    return false;
  }

  const roller = game.users.get(userId) ?? game.user;

  try {
    const displayed = await dice3d.showForRoll(
      roll,
      roller,
      false,
      null,
      false
    );

    if (
      notify &&
      displayed === false &&
      !warnedDice3DRejected
    ) {
      warnedDice3DRejected = true;
      ui.notifications.warn(
        "Dice So Nice a refusé l'animation du jet. Vérifie ses réglages de visibilité et de combat."
      );
      console.warn(
        `${MODULE_ID} | Dice So Nice a retourné false pour l'animation.`,
        roll
      );
    }

    return displayed !== false;
  } catch (error) {
    console.error(
      `${MODULE_ID} | Impossible d'afficher l'animation 3D du jet.`,
      error
    );

    if (notify) {
      ui.notifications.warn(
        "L'animation 3D a échoué, mais le résultat du conflit reste valide."
      );
    }

    return false;
  }
}

/**
 * Diffuse un Roll déjà évalué à tous les clients, puis l'affiche localement.
 * Chaque client le joue avec le même userId : Dice So Nice utilise donc la
 * couleur et le thème de dés enregistrés pour cet utilisateur.
 */
async function showRollIn3D(roll, userId = game.user.id) {
  game.socket.emit(SOCKET_NAME, {
    type: "dice3d-roll",
    animationId: foundry.utils.randomID(),
    sourceId: game.user.id,
    userId,
    serializedRoll: serializeRoll(roll)
  });

  return showRollIn3DLocal(
    roll,
    userId,
    { notify: true }
  );
}

/**
 * Traite sur chaque client une animation 3D reçue par le socket du module.
 */
export async function handleDice3DRollMessage(data) {
  if (!data || data.type !== "dice3d-roll") return false;

  // Certains serveurs peuvent renvoyer le message à son émetteur.
  // L'animation locale a déjà été lancée directement dans showRollIn3D.
  if (data.sourceId === game.user.id) return false;

  if (!data.serializedRoll || !data.userId) return false;

  try {
    const roll = deserializeRoll(data.serializedRoll);

    return showRollIn3DLocal(
      roll,
      data.userId,
      { notify: false }
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Impossible de reconstruire le jet 3D reçu.`,
      error
    );
    return false;
  }
}

function createD6Roll(formula, actorId = null) {
  const data = actorId ? { actorId } : {};
  const RollClass = getRollClass();

  if (typeof RollClass.create === "function") {
    return RollClass.create(formula, data);
  }

  return new RollClass(formula, data);
}

export async function rollD6Pool(
  numberOfDice,
  { userId = null, actorId = null } = {}
) {
  const count = clampInteger(numberOfDice, 0, TOTAL_CANDLES);
  if (count === 0) return [];

  const roll = createD6Roll(`${count}d6`, actorId);
  await roll.evaluate({ allowInteractive: false });
  await showRollIn3D(roll, userId ?? game.user.id);

  return roll.dice.flatMap(getActiveDieResults);
}

/**
 * Lance le pool joueur et, lorsqu'il est disponible, le dé d'Espoir dans
 * une seule animation 3D. Les résultats restent séparés pour la résolution.
 */
export async function rollPlayerD6Pool(
  numberOfDice,
  {
    includeHope = false,
    userId = null,
    actorId = null
  } = {}
) {
  const count = clampInteger(numberOfDice, 0, TOTAL_CANDLES);
  if (count === 0) {
    return {
      blueResults: [],
      hopeResult: null
    };
  }

  const formula = includeHope
    ? `${count}d6 + 1d6`
    : `${count}d6`;

  const roll = createD6Roll(formula, actorId);
  await roll.evaluate({ allowInteractive: false });
  await showRollIn3D(roll, userId ?? game.user.id);

  const blueResults = getActiveDieResults(roll.dice[0]);
  const hopeResult = includeHope
    ? (getActiveDieResults(roll.dice[1])[0] ?? null)
    : null;

  return {
    blueResults,
    hopeResult
  };
}

export function countValue(results, value) {
  return (results ?? []).filter((result) => result === value).length;
}

export function getResolutionAnalysis(resolution) {
  const blueSixes = countValue(resolution.blueResults, 6);
  const blueOnes = countValue(resolution.blueResults, 1);
  const redSixes = countValue(resolution.redResults, 6);

  const momentSuccess =
    resolution.momentUsed &&
    [5, 6].includes(resolution.momentResult);

  const momentSixes =
    resolution.momentUsed && resolution.momentResult === 6 ? 1 : 0;

  const playerSixes = blueSixes + momentSixes;
  const success = blueSixes > 0 || momentSuccess;
  const narrator = success
    ? (redSixes > playerSixes ? "gm" : "player")
    : null;

  return {
    blueSixes,
    blueOnes,
    redSixes,
    momentSuccess,
    momentSixes,
    playerSixes,
    success,
    narrator
  };
}
