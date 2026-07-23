/**
 * Lancers de dés et interprétation mathématique d'une résolution.
 */

import { TOTAL_CANDLES } from "./constants.js";
import { clampInteger } from "./utils.js";

export async function rollD6Pool(numberOfDice) {
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
