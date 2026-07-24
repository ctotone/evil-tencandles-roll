/**
 * Construction et mise à jour des cartes publiées dans le chat.
 */

import { MODULE_ID } from "./constants.js";
import { countValue, getResolutionAnalysis } from "./dice.js";
import { escapeHTML } from "./utils.js";

const DARKNESS_MESSAGES = Object.freeze({
  9: "Une flamme s’éteint. L’obscurité gagne en présence, encore contenue, mais déjà assez proche pour peser sur chaque souffle.",
  8: "La lumière recule. Les ombres s’épaississent, se resserrent, et leur silence semble attendre la moindre faiblesse.",
  7: "L’obscurité s’étend davantage. Chaque flamme paraît plus fragile, comme si les ténèbres apprenaient à les étouffer.",
  6: "La lumière devient rare. Les ombres avalent les contours et laissent derrière elles une inquiétude sourde, presque tangible.",
  5: "La moitié des flammes a disparu. L’obscurité n’entoure plus seulement le groupe : elle semble désormais l’observer.",
  4: "Les ténèbres prennent toute la place. Chaque lumière vacille sous leur poids, et le moindre souffle paraît menaçant.",
  3: "Il ne reste presque plus rien pour repousser l’obscurité. Les ombres se pressent, épaisses, proches, impossibles à ignorer.",
  2: "Deux flammes seulement résistent encore. L’obscurité se fait totale, lourde, silencieuse, prête à tout engloutir.",
  1: "Une seule flamme demeure. Le Dernier combat commence, tandis que l’obscurité attend, immense, immobile et sans pitié."
});


const CHARACTER_DEPARTURE_MESSAGES = Object.freeze([
  "[PERSONNAGE] atteint le bout de son chemin. Sa lumière s’éloigne doucement, laissant aux autres la force de poursuivre sans lui.",
  "[PERSONNAGE] quitte le cercle des flammes. Son passage demeure pourtant, comme une empreinte discrète que l’obscurité ne peut effacer.",
  "Pour [PERSONNAGE], le voyage s’arrête ici. Son histoire se referme sans bruit, mais ses traces continueront d’accompagner les autres.",
  "[PERSONNAGE] laisse sa place au silence. Ce qu’il a porté reste suspendu dans l’air, prêt à guider ceux qui poursuivent encore.",
  "La route de [PERSONNAGE] s’incline ailleurs. Il disparaît du récit, mais l’écho de ses choix demeure au cœur de ceux qui restent.",
  "[PERSONNAGE] franchit un seuil que les autres ne peuvent suivre. Sa lumière se retire, sans que son souvenir cesse de les accompagner.",
  "Le chapitre de [PERSONNAGE] s’achève. La page se tourne avec douceur, tandis que ce qu’il a semé continue de vivre dans le récit.",
  "[PERSONNAGE] s’éloigne du cercle, porté vers un horizon invisible. Derrière lui demeure une lueur que l’obscurité ne peut reprendre.",
  "Le chemin se sépare pour [PERSONNAGE]. Sa présence s’efface, mais quelque chose de lui reste auprès de ceux qui avancent encore.",
  "[PERSONNAGE] atteint la dernière ligne de son histoire. Le rideau tombe sans fracas, laissant derrière lui une lumière douce et tenace."
]);

export function renderDice(results, color) {
  if (!results?.length) {
    return '<span class="etc-empty">Aucun dé</span>';
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
          title="d6 : ${result}"
        >${result}</span>
      `;
    })
    .join("");
}

export function renderMomentSection(resolution) {
  if (!resolution.momentUsed) return "";

  return `
    <div class="etc-player-hope">
      <strong>Espoir</strong>
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
        title="Utiliser pour relancer les 1"
        aria-label="Vertu — Utiliser pour relancer les 1"
      >
        Vertu
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
        title="Utiliser pour relancer les 1"
        aria-label="Vice — Utiliser pour relancer les 1"
      >
        Vice
      </button>
    `);
  }

  if (resolution.limitAvailableAtStart && !resolution.rerolls.limit) {
    playerButtons.push(`
      <button
        type="button"
        class="etc-action etc-action--limit"
        data-etc-action="use-limit"
        title="Accepter le pire pour relancer tous les dés"
        aria-label="Limite — Accepter le pire pour relancer tous les dés"
      >
        Limite
      </button>
    `);
  }

  if (!playerButtons.length) return "";

  return `
    <section
      class="etc-actions etc-actions--player"
      aria-label="Actions du joueur"
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
      aria-label="Validation du maître du jeu"
      data-etc-gm-actions
    >
      <div class="etc-actions__gm">
        <button
          type="button"
          class="etc-action etc-action--validate"
          data-etc-action="validate-resolution"
          title="Valider le conflit avec ou sans jet du MJ et clôturer le jet en cours."
          aria-label="Valider le conflit — Valider le conflit avec ou sans jet du MJ et clôturer le jet en cours."
        >
          Valider le conflit
        </button>
      </div>
    </section>
  `;
}

export function renderResolutionResult(resolution, analysis) {
  if (resolution.status !== "resolved") {
    const provisionalSuccess = analysis.success;
    const provisionalLabel = provisionalSuccess
      ? "Réussite provisoire"
      : "Échec provisoire";
    const provisionalClass = provisionalSuccess
      ? "etc-result--provisional-success"
      : "etc-result--provisional-failure";

    return `
      <section class="etc-result ${provisionalClass}">
        <div class="etc-result__heading">
          <strong>${provisionalLabel}</strong>
        </div>
        <span class="etc-result__note">
          Le résultat ne sera appliqué qu'après validation du MJ.
        </span>
      </section>
    `;
  }

  if (!resolution.finalSuccess) {
    const failureMessage = resolution.characterDeparture
      ? `${escapeHTML(resolution.playerName)} va nous quitter`
      : "Le Bal des vérités commence";

    return `
      <section class="etc-result etc-result--failure">
        <div class="etc-result__heading">
          <strong>Échec définitif</strong>
        </div>
        <span class="etc-result__main">${failureMessage}</span>
      </section>
    `;
  }

  const narratorLabel =
    resolution.narrator === "gm"
      ? "Le MJ obtient la narration."
      : "Le joueur obtient la narration.";

  return `
    <section class="etc-result etc-result--success">
      <div class="etc-result__heading">
        <strong>Réussite définitive</strong>
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
        title="Attente Jet MJ"
        aria-label="Attente Jet MJ"
      >
        <i class="fa-solid fa-dice" aria-hidden="true"></i>
      </span>
    `,
    "pending-validation": `
      <span
        class="etc-status etc-status--pending-validation"
        data-etc-status="pending-validation"
        title="Attente de validation"
        aria-label="Attente de validation"
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
        <span>Jet annulé</span>
      </span>
    `
  }[resolution.status] ?? "";

  const redSection = resolution.redPoolSize <= 0
    ? ""
    : resolution.gmRollCompleted
      ? `
        <section class="etc-pool etc-pool--gm">
          <div class="etc-pool__heading">
            <strong>Maître du jeu</strong>
          </div>
          <div class="etc-dice-row">${renderDice(resolution.redResults, "red")}</div>
        </section>
      `
      : resolution.status === "resolved" && resolution.gmRollSkipped
        ? `
          <section class="etc-pool etc-pool--gm">
            <div class="etc-pool__heading">
              <strong>Maître du jeu</strong>
            </div>
            <div class="etc-empty">Jet non effectué</div>
          </section>
        `
        : `
          <section class="etc-pool etc-pool--gm etc-pool--waiting">
            <div class="etc-pool__heading">
              <strong>Maître du jeu</strong>
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
                title="Facultatif : lancer le pool du MJ"
              >
                <i class="fa-solid fa-dice" aria-hidden="true"></i>
                <span>Jet du MJ</span>
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
        <h3>Conflit</h3>
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
      <strong>Nouvelle scène préparée</strong>
      <span>Une bougie a été éteinte.</span>
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
            Commencer le bal des vérités
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
          <h3>Bal des vérités</h3>
          <p>La résolution de ${escapeHTML(resolution.playerName)} est un échec.</p>
        </div>
        <i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>
      </header>

      <p>
        L'action s'achève. La partie entre dans l'interscène qui suit
        l'extinction d'une bougie. Chacun va pouvoir partager ses vérités...
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
    messageIndex < CHARACTER_DEPARTURE_MESSAGES.length
      ? messageIndex
      : 0;

  const atmosphereText =
    CHARACTER_DEPARTURE_MESSAGES[normalizedIndex]
      .replaceAll("[PERSONNAGE]", safeName);

  return `
    <article
      class="etc-card etc-character-departure"
      data-etc-resolution-id="${escapeHTML(resolution.id)}"
      data-etc-departure-message-index="${normalizedIndex}"
    >
      <header class="etc-character-departure__header">
        <h3 class="etc-character-departure__title">
          ${safeName} va nous quitter
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
  const atmosphereText = DARKNESS_MESSAGES[candleCount];

  if (!atmosphereText) return "";

  const title = candleCount === 1
    ? "1 bougie restante"
    : `${candleCount} bougies restantes`;

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
    Math.random() * CHARACTER_DEPARTURE_MESSAGES.length
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
