/**
 * Détection du personnage et gestion de Vice, Vertu, Espoir et Limite.
 */

import { ACTOR_RESOURCE_FLAGS, MODULE_ID } from "./constants.js";
import { escapeHTML, readDialogForm } from "./utils.js";

export function actorHasItemType(actor, itemType) {
  return actor.items.some((item) => item.type === itemType);
}

export function getActorResourceState(actor) {
  const hasVice = actorHasItemType(actor, "vice");
  const hasVirtue = actorHasItemType(actor, "virtue");
  const hasLimit = actorHasItemType(actor, "brink");
  const hasMomentItem = actorHasItemType(actor, "moment");

  const hopeEnabled = Boolean(actor.getFlag("tencandles", "hope"));
  const viceUsed = Boolean(actor.getFlag(MODULE_ID, ACTOR_RESOURCE_FLAGS.vice));
  const virtueUsed = Boolean(actor.getFlag(MODULE_ID, ACTOR_RESOURCE_FLAGS.virtue));

  return {
    hasVice,
    hasVirtue,
    hasLimit,
    hasMomentItem,
    hopeEnabled,

    viceUsed,
    virtueUsed,

    canUseVice: hasVice && !viceUsed,
    canUseVirtue: hasVirtue && !virtueUsed,

    // Le dé d'Espoir est permanent tant que la case Hope reste cochée
    // et qu'aucun Item Moment n'existe sur le personnage.
    canUseMoment: hopeEnabled && !hasMomentItem,

    // La Limite est débloquée définitivement pour la partie
    // dès que le Vice et la Vertu ont été consommés.
    // Son utilisation est limitée uniquement à une fois par résolution.
    canUseLimit: viceUsed && virtueUsed
  };
}

export async function getResolutionActor(resolution) {
  if (resolution.actorUuid) {
    const actor = await fromUuid(resolution.actorUuid);
    if (actor?.documentName === "Actor") return actor;
  }

  if (resolution.actorId) {
    return game.actors.get(resolution.actorId) ?? null;
  }

  return null;
}

export async function refreshResolutionResources(resolution) {
  const actor = await getResolutionActor(resolution);

  if (!actor) {
    resolution.resources = {
      canUseVice: false,
      canUseVirtue: false,
      canUseMoment: false,
      canUseLimit: false
    };
    return null;
  }

  resolution.resources = getActorResourceState(actor);
  return actor;
}

export async function consumeActorResource(actor, resource) {
  const flagKey = ACTOR_RESOURCE_FLAGS[resource];
  if (!flagKey) {
    throw new Error(`${MODULE_ID} | Ressource inconnue : ${resource}`);
  }

  await actor.setFlag(MODULE_ID, flagKey, true);
}

export async function resetActorResources(actor, { notify = true } = {}) {
  if (!actor) return false;

  for (const flagKey of Object.values(ACTOR_RESOURCE_FLAGS)) {
    await actor.setFlag(MODULE_ID, flagKey, false);
  }

  // Nettoyage des anciens flags utilisés pendant les premiers tests.
  await actor.unsetFlag(MODULE_ID, "momentUsed");
  await actor.unsetFlag(MODULE_ID, "limitUsed");

  if (notify) {
    ui.notifications.info(
      `Ressources Ten Candles réinitialisées pour ${actor.name}.`
    );
  }

  return true;
}


function getResourceDisplayState({
  present,
  used,
  availableLabel,
  usedLabel,
  absentLabel
}) {
  if (!present) {
    return {
      label: absentLabel,
      cssClass: "etc-resource-status--absent"
    };
  }

  if (used) {
    return {
      label: usedLabel,
      cssClass: "etc-resource-status--used"
    };
  }

  return {
    label: availableLabel,
    cssClass: "etc-resource-status--available"
  };
}

export async function openSelectedActorResourceStatus() {
  if (!game.user.isGM) {
    ui.notifications.warn("Cette action est réservée au MJ.");
    return false;
  }

  const actor = await chooseCharacterActorForRoll();
  if (!actor) return false;

  const resources = getActorResourceState(actor);

  const virtue = getResourceDisplayState({
    present: resources.hasVirtue,
    used: resources.virtueUsed,
    availableLabel: "Disponible",
    usedLabel: "Utilisée",
    absentLabel: "Absente"
  });

  const vice = getResourceDisplayState({
    present: resources.hasVice,
    used: resources.viceUsed,
    availableLabel: "Disponible",
    usedLabel: "Utilisé",
    absentLabel: "Absent"
  });

  const limit = !resources.hasLimit
    ? {
        label: "Absente",
        cssClass: "etc-resource-status--absent"
      }
    : resources.canUseLimit
      ? {
          label: "Débloquée",
          cssClass: "etc-resource-status--available"
        }
      : {
          label: "Verrouillée",
          cssClass: "etc-resource-status--locked"
        };

  await foundry.applications.api.DialogV2.input({
    window: {
      title: `Ten Candles — Ressources de ${actor.name}`
    },
    content: `
      <div class="etc-dialog etc-resource-control">
        <p class="etc-resource-control__actor">
          ${escapeHTML(actor.name)}
        </p>

        <div class="etc-resource-control__row">
          <strong>Vertu</strong>
          <span class="etc-resource-status ${virtue.cssClass}">
            ${virtue.label}
          </span>
        </div>

        <div class="etc-resource-control__row">
          <strong>Vice</strong>
          <span class="etc-resource-status ${vice.cssClass}">
            ${vice.label}
          </span>
        </div>

        <div class="etc-resource-control__row">
          <strong>Limite</strong>
          <span class="etc-resource-status ${limit.cssClass}">
            ${limit.label}
          </span>
        </div>
      </div>
    `,
    ok: {
      label: "Fermer",
      callback: () => true
    },
    rejectClose: false,
    modal: true
  });

  return true;
}

export function getControlledCharacterActors() {
  const actors = (canvas.tokens?.controlled ?? [])
    .map((token) => token.actor)
    .filter((actor) => actor?.type === "character");

  return [...new Map(actors.map((actor) => [actor.uuid, actor])).values()];
}

export function getOwnedCharacterActors(user) {
  return game.actors.filter((actor) => {
    if (actor.type !== "character") return false;
    return actor.testUserPermission(user, "OWNER");
  });
}

export async function chooseCharacterActorForRoll() {
  const controlledActors = getControlledCharacterActors();

  if (controlledActors.length === 1) {
    return controlledActors[0];
  }

  if (controlledActors.length > 1) {
    ui.notifications.warn(
      "Sélectionne un seul token de personnage avant de lancer le pool joueur."
    );
    return null;
  }

  if (game.user.character?.type === "character") {
    return game.user.character;
  }

  const candidates = game.user.isGM
    ? game.actors.filter((actor) => actor.type === "character")
    : getOwnedCharacterActors(game.user);

  if (candidates.length === 0) {
    ui.notifications.warn(
      "Aucun personnage Ten Candles utilisable n'a été trouvé."
    );
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const options = candidates
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map(
      (actor) =>
        `<option value="${escapeHTML(actor.uuid)}">${escapeHTML(actor.name)}</option>`
    )
    .join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Ten Candles — Choisir le personnage"
    },
    content: `
      <div class="etc-dialog">
        <label>
          <span>Personnage concerné par le lancer</span>
          <select name="actorUuid">
            ${options}
          </select>
        </label>
      </div>
    `,
    ok: {
      label: "Choisir",
      callback: (_event, button) => {
        const fields = readDialogForm(button);
        return {
          actorUuid: fields.getValue("actorUuid")
        };
      }
    },
    rejectClose: false,
    modal: true
  });

  if (!result?.actorUuid) return null;

  const actor = await fromUuid(result.actorUuid);
  return actor?.documentName === "Actor" ? actor : null;
}
