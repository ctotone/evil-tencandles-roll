/**
 * Construction et mise à jour des cartes publiées dans le chat.
 */

import { MODULE_ID } from "./constants.js";
import { countValue, getResolutionAnalysis } from "./dice.js";
import { escapeHTML, format, localize } from "./utils.js";

const DARKNESS_MESSAGE_KEYS = Object.freeze({
  9: "Atmosphere.Darkness9",
  8: "Atmosphere.Darkness8",
  7: "Atmosphere.Darkness7",
  6: "Atmosphere.Darkness6",
  5: "Atmosphere.Darkness5",
  4: "Atmosphere.Darkness4",
  3: "Atmosphere.Darkness3",
  2: "Atmosphere.Darkness2",
  1: "Atmosphere.Darkness1"
});

const CHARACTER_DEPARTURE_MESSAGE_KEYS = Object.freeze(
  Array.from(
    { length: 10 },
    (_value, index) => `Atmosphere.Departure${index + 1}`
  )
);

export function renderDice(results, color) {
  if (!results?.length) {
    return `<span class="etc-empty">${localize("Common.NoDice")}</span>`;
  }

  return results
    .map((result) => {
      const classes = ["etc-die", `etc-die--${color}`];

      if (color === "moment") {
        classes.push(
          result >= 5
            ? "etc-die--hope-success"
            : "etc-die--neutral"
        );
      } else if (result === 6) {
        classes.push("etc-die--success");
      } else if (color === "blue" && result === 1) {
        classes.push("etc-die--danger");
      } else {
        classes.push("etc-die--neutral");
      }

      return `
        <span
          class="${classes.join(" ")}"
          title="${format("Chat.DieTitle", { result })}"
        >${result}</span>
      `;
    })
    .join("");
}

export function renderMomentSection(resolution) {
  if (!resolution.momentUsed) return "";

  return `
    <div class="etc-player-hope">
      <strong>${localize("Chat.Hope")}</strong>
      <div class="etc-dice-row etc-dice-row--hope">
        ${renderDice([resolution.momentResult], "moment")}
      </div>
    </div>
  `;
}

export function renderPlayerActionButtons(resolution) {
  if (["resolved", "cancelled"].includes(resolution.status)) return "";

  const resources = resolution.resources ?? {};
  const viceOrVirtueUsedThisRoll =
    resolution.rerolls.vice || resolution.rerolls.virtue;
  const hasOnes = countValue(resolution.blueResults, 1) > 0;

  const playerButtons = [];

  if (resources.canUseVirtue) {
    playerButtons.push(`
      <button
        type="button"
        class="etc-action etc-action--virtue"
        data-etc-action="use-virtue"
        ${viceOrVirtueUsedThisRoll || !hasOnes ? "disabled" : ""}
        title="${localize("Chat.RerollOnes")}"
        aria-label="${localize("Chat.VirtueAria")}"
      >
        ${localize("Resources.Virtue")}
      </button>
    `);
  }

  if (resources.canUseVice) {
    playerButtons.push(`
      <button
        type="button"
        class="etc-action etc-action--vice"
        data-etc-action="use-vice"
        ${viceOrVirtueUsedThisRoll || !hasOnes ? "disabled" : ""}
        title="${localize("Chat.RerollOnes")}"
        aria-label="${localize("Chat.ViceAria")}"
      >
        ${localize("Resources.Vice")}
      </button>
    `);
  }

  if (resolution.limitAvailableAtStart && !resolution.rerolls.limit) {
    playerButtons.push(`
      <button
        type="button"
        class="etc-action etc-action--limit"
        data-etc-action="use-limit"
        title="${localize("Chat.LimitHelp")}"
        aria-label="${localize("Chat.LimitAria")}"
      >
        ${localize("Resources.Limit")}
      </button>
    `);
  }

  if (!playerButtons.length) return "";

  return `
    <section
      class="etc-actions etc-actions--player"
      aria-label="${localize("Chat.PlayerActions")}"
      data-etc-player-actions
    >
      <div class="etc-actions__player">
        ${playerButtons.join("")}
      </div>
    </section>
  `;
}

export function renderGMValidationButton(resolution) {
  if (["resolved", "cancelled"].includes(resolution.status)) return "";

  return `
    <section
      class="etc-actions etc-actions--gm"
      aria-label="${localize("Chat.GMValidation")}"
      data-etc-gm-actions
    >
      <div class="etc-actions__gm">
        <button
          type="button"
          class="etc-action etc-action--validate"
          data-etc-action="validate-resolution"
          title="${localize("Chat.ValidateHelp")}"
          aria-label="${localize("Chat.ValidateAria")}"
        >
          ${localize("Chat.ValidateConflict")}
        </button>
      </div>
    </section>
  `;
}

export function renderResolutionResult(resolution, analysis) {
  if (resolution.status !== "resolved") {
    const provisionalSuccess = analysis.success;
    const provisionalLabel = provisionalSuccess
      ? localize("Chat.ProvisionalSuccess")
      : localize("Chat.ProvisionalFailure");
    const provisionalClass = provisionalSuccess
      ? "etc-result--provisional-success"
      : "etc-result--provisional-failure";

    return `
      <section class="etc-result ${provisionalClass}">
        <div class="etc-result__heading">
          <strong>${provisionalLabel}</strong>
        </div>
        <span class="etc-result__note">
          ${localize("Chat.PendingNote")}
        </span>
      </section>
    `;
  }

  if (!resolution.finalSuccess) {
    const failureMessage = resolution.characterDeparture
      ? format("Chat.CharacterWillLeave", {
          name: escapeHTML(resolution.playerName)
        })
      : localize("Chat.BallBegins");

    return `
      <section class="etc-result etc-result--failure">
        <div class="etc-result__heading">
          <strong>${localize("Chat.FinalFailure")}</strong>
        </div>
        <span class="etc-result__main">${failureMessage}</span>
      </section>
    `;
  }

  const narratorLabel =
    resolution.narrator === "gm"
      ? localize("Chat.GMNarrates")
      : localize("Chat.PlayerNarrates");

  return `
    <section class="etc-result etc-result--success">
      <div class="etc-result__heading">
        <strong>${localize("Chat.FinalSuccess")}</strong>
      </div>
      <span class="etc-result__main">${narratorLabel}</span>
    </section>
  `;
}

export function renderResolutionCard(resolution) {
  const analysis = getResolutionAnalysis(resolution);

  const statusMarkup = {
    "waiting-gm": `
      <span
        class="etc-status etc-status--waiting-gm"
        data-etc-status="waiting-gm"
        title="${localize("Chat.WaitingGMRoll")}"
        aria-label="${localize("Chat.WaitingGMRoll")}"
      >
        <i class="fa-solid fa-dice" aria-hidden="true"></i>
      </span>
    `,
    "pending-validation": `
      <span
        class="etc-status etc-status--pending-validation"
        data-etc-status="pending-validation"
        title="${localize("Chat.WaitingValidation")}"
        aria-label="${localize("Chat.WaitingValidation")}"
      >
        <i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
      </span>
    `,
    resolved: "",
    cancelled: `
      <span
        class="etc-status etc-status--cancelled"
        data-etc-status="cancelled"
      >
        <span>${localize("Chat.RollCancelled")}</span>
      </span>
    `
  }[resolution.status] ?? "";

  const redSection = resolution.redPoolSize <= 0
    ? ""
    : resolution.gmRollCompleted
      ? `
        <section class="etc-pool etc-pool--gm">
          <div class="etc-pool__heading">
            <strong>${localize("Chat.GMName")}</strong>
          </div>
          <div class="etc-dice-row">${renderDice(resolution.redResults, "red")}</div>
        </section>
      `
      : resolution.status === "resolved" && resolution.gmRollSkipped
        ? `
          <section class="etc-pool etc-pool--gm">
            <div class="etc-pool__heading">
              <strong>${localize("Chat.GMName")}</strong>
            </div>
            <div class="etc-empty">${localize("Chat.RollSkipped")}</div>
          </section>
        `
        : `
          <section class="etc-pool etc-pool--gm etc-pool--waiting">
            <div class="etc-pool__heading">
              <strong>${localize("Chat.GMName")}</strong>
            </div>

            <div class="etc-gm-roll-reserved-space">
              <div
                class="etc-dice-row etc-dice-row--sizer"
                aria-hidden="true"
              >
                ${renderDice(
                  Array.from({ length: resolution.redPoolSize }, () => 6),
                  "red"
                )}
              </div>

              <button
                type="button"
                class="etc-action etc-action--gm-roll"
                data-etc-action="gm-roll"
                data-etc-gm-roll-trigger
                title="${localize("Chat.OptionalGMRoll")}"
              >
                <i class="fa-solid fa-dice" aria-hidden="true"></i>
                <span>${localize("Chat.GMRoll")}</span>
              </button>
            </div>
          </section>
        `;

  const gmValidationButton = renderGMValidationButton(resolution);

  const gmRow = redSection
    ? `
      <div class="etc-gm-row">
        ${redSection}
      </div>
    `
    : "";

  return `
    <article
      class="etc-card etc-conflict-card${resolution.status === "cancelled" ? " etc-card--cancelled" : ""}"
      data-etc-resolution-id="${escapeHTML(resolution.id)}"
      data-etc-player-id="${escapeHTML(resolution.playerId)}"
    >
      <header class="etc-card__header">
        <h3>${localize("Chat.Conflict")}</h3>
        ${statusMarkup}
      </header>

      <div class="etc-player-row">
        <section class="etc-pool etc-pool--player">
          <div class="etc-player-content">
            <div class="etc-pool__heading">
              <strong>${escapeHTML(resolution.playerName)}</strong>
            </div>
            <div class="etc-dice-row">${renderDice(resolution.blueResults, "blue")}</div>
            ${renderMomentSection(resolution)}
          </div>
        </section>

        ${renderPlayerActionButtons(resolution)}
      </div>

      ${gmRow}
      ${renderResolutionResult(resolution, analysis)}
      ${gmValidationButton}

    </article>
  `;
}

export function renderBallOfTruthsCard(
  resolution,
  { completed = false, litCandles = null } = {}
) {
  const nextLitCandles = completed
    ? litCandles
    : Math.max(0, Number(resolution.litCandlesAtRoll ?? 1) - 1);

  const completedContent = `
    <section class="etc-result etc-result--success etc-ball-transition__completed">
      <strong>${localize("Chat.NewSceneReady")}</strong>
      <span>${localize("Chat.CandleExtinguished")}</span>
    </section>
  `;

  const transitionContent = completed
    ? completedContent
    : `
      <div class="etc-ball-transition-reserved-space">
        <div
          class="etc-ball-transition__sizer"
          aria-hidden="true"
        >
          ${completedContent}
        </div>

        <div class="etc-actions__gm" data-etc-gm-actions>
          <button
            type="button"
            class="etc-action etc-action--validate etc-action--next-scene"
            data-etc-action="start-next-scene"
          >
            ${localize("Chat.StartBall")}
          </button>
        </div>
      </div>
    `;

  return `
    <article
      class="etc-card etc-ball-of-truths"
      data-etc-resolution-id="${escapeHTML(resolution.id)}"
    >
      <header class="etc-card__header">
        <div>
          <h3>${localize("Common.BallOfTruths")}</h3>
          <p>${format("Chat.BallFailure", {
            name: escapeHTML(resolution.playerName)
          })}</p>
        </div>
        <i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>
      </header>

      <p>
        ${localize("Chat.BallBody")}
      </p>

      ${transitionContent}
    </article>
  `;
}


export function renderCharacterDepartureCard(
  resolution,
  messageIndex = 0
) {
  const safeName = escapeHTML(resolution.playerName);
  const normalizedIndex =
    Number.isInteger(messageIndex) &&
    messageIndex >= 0 &&
    messageIndex < CHARACTER_DEPARTURE_MESSAGE_KEYS.length
      ? messageIndex
      : 0;

  const atmosphereText = format(
    CHARACTER_DEPARTURE_MESSAGE_KEYS[normalizedIndex],
    { name: safeName }
  );

  return `
    <article
      class="etc-card etc-character-departure"
      data-etc-resolution-id="${escapeHTML(resolution.id)}"
      data-etc-departure-message-index="${normalizedIndex}"
    >
      <header class="etc-character-departure__header">
        <h3 class="etc-character-departure__title">
          ${format("Chat.CharacterWillLeave", { name: safeName })}
        </h3>
      </header>

      <p class="etc-character-departure__text">
        ${atmosphereText}
      </p>
    </article>
  `;
}

export function renderDarknessProgressionCard(litCandles) {
  const candleCount = Number(litCandles);
  const atmosphereKey = DARKNESS_MESSAGE_KEYS[candleCount];

  if (!atmosphereKey) return "";

  const atmosphereText = localize(atmosphereKey);

  const title = candleCount === 1
    ? localize("Chat.OneCandleRemaining")
    : format("Chat.ManyCandlesRemaining", { count: candleCount });

  return `
    <article
      class="etc-card etc-darkness-card"
      data-etc-lit-candles="${candleCount}"
    >
      <header class="etc-darkness-card__header">
        <h3 class="etc-darkness-card__title">${title}</h3>
      </header>

      <p class="etc-darkness-card__text">
        ${escapeHTML(atmosphereText)}
      </p>
    </article>
  `;
}

export async function createDarknessProgressionMessage(litCandles) {
  const content = renderDarknessProgressionCard(litCandles);
  if (!content) return null;

  return foundry.documents.ChatMessage.create({
    speaker: {
      alias: "Ten Candles"
    },
    content,
    flags: {
      [MODULE_ID]: {
        type: "darkness-progression",
        litCandles
      }
    }
  });
}

export async function createCharacterDepartureMessage(resolution) {
  const messageIndex = Math.floor(
    Math.random() * CHARACTER_DEPARTURE_MESSAGE_KEYS.length
  );

  return foundry.documents.ChatMessage.create({
    speaker: {
      alias: "Ten Candles"
    },
    content: renderCharacterDepartureCard(resolution, messageIndex),
    flags: {
      [MODULE_ID]: {
        type: "character-departure",
        resolutionId: resolution.id,
        actorUuid: resolution.actorUuid,
        messageIndex
      }
    }
  });
}

export async function createResolutionMessage(resolution) {
  return foundry.documents.ChatMessage.create({
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
}

export async function createBallOfTruthsMessage(resolution) {
  return foundry.documents.ChatMessage.create({
    speaker: {
      alias: "Ten Candles"
    },
    content: renderBallOfTruthsCard(resolution),
    flags: {
      [MODULE_ID]: {
        type: "ball-of-truths",
        resolutionId: resolution.id
      }
    }
  });
}

export async function updateResolutionMessage(resolution) {
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
