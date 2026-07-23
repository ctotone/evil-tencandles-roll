/**
 * Synchronisation des flammes, lumières et dés affichés sur la scène.
 */

import {
  MODULE_ID,
  SUPPORTED_VISUAL_DOCUMENTS,
  TOTAL_CANDLES
} from "./constants.js";
import { extractUuid } from "./utils.js";
import { getState, normalizeState } from "./state.js";

export function parseSceneEmbeddedUuid(value) {
  const uuid = extractUuid(value);
  const match = uuid.match(
    /^Scene\.([^.]+)\.(Tile|Token|AmbientLight)\.([^.]+)$/i
  );

  if (!match) return null;

  const typeMap = {
    tile: "Tile",
    token: "Token",
    ambientlight: "AmbientLight"
  };

  return {
    uuid,
    sceneId: match[1],
    documentName: typeMap[match[2].toLowerCase()],
    documentId: match[3]
  };
}

export function getExpectedDocumentTypes(groupName) {
  if (groupName === "candleLightUuids") return new Set(["AmbientLight"]);
  return SUPPORTED_VISUAL_DOCUMENTS;
}

export function resolveConfiguredDocument(uuid) {
  const parsed = parseSceneEmbeddedUuid(uuid);

  if (!parsed) {
    return {
      error: `${uuid} (format attendu : Scene.ID.Type.ID)`
    };
  }

  const scene = game.scenes.get(parsed.sceneId);
  if (!scene) {
    return {
      error: `${uuid} (scène ${parsed.sceneId} introuvable)`
    };
  }

  const document = scene.getEmbeddedDocument(
    parsed.documentName,
    parsed.documentId
  );

  if (!document) {
    return {
      error: `${uuid} (${parsed.documentName} ${parsed.documentId} introuvable)`
    };
  }

  return {
    parsed,
    scene,
    document
  };
}

export async function synchronizeDocumentGroup({
  uuids,
  visibleCount,
  groupName,
  configuredSceneId,
  config,
  report
}) {
  const expectedTypes = getExpectedDocumentTypes(groupName);

  for (let index = 0; index < uuids.length; index += 1) {
    const uuid = extractUuid(uuids[index]);
    const shouldBeVisible = index < visibleCount;

    try {
      const resolved = resolveConfiguredDocument(uuid);

      if (resolved.error) {
        report.invalid.push(resolved.error);
        continue;
      }

      const { parsed, scene, document } = resolved;
      report.found += 1;

      if (!expectedTypes.has(parsed.documentName)) {
        report.invalid.push(
          `${uuid} (${parsed.documentName}, type attendu : ${[...expectedTypes].join(" ou ")})`
        );
        continue;
      }

      if (configuredSceneId && scene.id !== configuredSceneId) {
        report.invalid.push(
          `${uuid} (scène ${scene.id}, scène configurée ${configuredSceneId})`
        );
        continue;
      }

      let updateData;

      if (parsed.documentName === "AmbientLight") {
        const targetHidden = !shouldBeVisible;
        const currentHidden = Boolean(document.hidden);

        if (currentHidden === targetHidden) {
          report.unchanged += 1;
          report.details.push({
            group: groupName,
            index: index + 1,
            uuid,
            type: parsed.documentName,
            visible: shouldBeVisible,
            current: `hidden=${currentHidden}`,
            action: "aucune"
          });
          continue;
        }

        updateData = { hidden: targetHidden };
      } else {
        // Pour les Tiles/Tokens du module :
        // visible = alpha 1 ; masqué = alpha 0.
        // On ne mémorise pas l'alpha courant, car un test manuel à alpha 0
        // ne doit jamais devenir le nouvel état "visible".
        const targetAlpha = shouldBeVisible ? 1 : 0;
        const currentAlpha = Number(document.alpha ?? 1);
        const currentHidden = Boolean(document.hidden);

        if (currentAlpha === targetAlpha && currentHidden === false) {
          report.unchanged += 1;
          report.details.push({
            group: groupName,
            index: index + 1,
            uuid,
            type: parsed.documentName,
            visible: shouldBeVisible,
            current: `alpha=${currentAlpha}, hidden=${currentHidden}`,
            action: "aucune"
          });
          continue;
        }

        updateData = {
          alpha: targetAlpha,
          hidden: false
        };
      }

      const updatedDocument = await document.update(updateData, {
        animate: false,
        diff: true,
        render: true
      });

      report.updated += 1;
      report.details.push({
        group: groupName,
        index: index + 1,
        uuid,
        type: parsed.documentName,
        visible: shouldBeVisible,
        current: parsed.documentName === "AmbientLight"
          ? `hidden=${Boolean(updatedDocument.hidden)}`
          : `alpha=${Number(updatedDocument.alpha)}, hidden=${Boolean(updatedDocument.hidden)}`,
        action: JSON.stringify(updateData)
      });
    } catch (error) {
      console.error(`${MODULE_ID} | UUID impossible à synchroniser : ${uuid}`, error);
      report.errors.push(`${uuid}: ${error.message}`);
    }
  }
}

export async function syncCanvasFromState(
  rawState = getState(),
  { notify = true } = {}
) {
  if (!game.user.isGM) {
    if (notify) ui.notifications.warn("La synchronisation du canevas est réservée au MJ.");
    return null;
  }

  const state = normalizeState(rawState);
  const config = state.canvasSync;

  if (!config.enabled) {
    if (notify) {
      ui.notifications.warn(
        "La synchronisation du canevas n'est pas activée dans la configuration."
      );
    }
    return null;
  }

  const report = {
    configured: 0,
    found: 0,
    updated: 0,
    unchanged: 0,
    missing: [],
    invalid: [],
    errors: [],
    details: []
  };

  const redPoolSize = TOTAL_CANDLES - state.litCandles;
  const groups = [
    ["candleFlameUuids", config.candleFlameUuids, state.litCandles],
    ["candleLightUuids", config.candleLightUuids, state.litCandles],
    ["blueDieUuids", config.blueDieUuids, state.bluePoolRemaining],
    ["redDieUuids", config.redDieUuids, redPoolSize]
  ];

  report.configured = groups.reduce((total, [, uuids]) => total + uuids.length, 0);

  for (const [groupName, uuids, visibleCount] of groups) {
    await synchronizeDocumentGroup({
      uuids,
      visibleCount,
      groupName,
      configuredSceneId: config.sceneId,
      config,
      report
    });
  }

  console.groupCollapsed(`${MODULE_ID} | Rapport de synchronisation du canevas`);
  console.log({
    sceneId: config.sceneId,
    litCandles: state.litCandles,
    bluePoolRemaining: state.bluePoolRemaining,
    redPoolSize,
    configured: report.configured,
    found: report.found,
    updated: report.updated,
    unchanged: report.unchanged,
    missing: report.missing.length,
    invalid: report.invalid.length,
    errors: report.errors.length
  });
  if (report.details.length) console.table(report.details);
  if (report.missing.length) console.warn("UUID introuvables :", report.missing);
  if (report.invalid.length) console.warn("UUID invalides :", report.invalid);
  if (report.errors.length) console.error("Erreurs :", report.errors);
  console.groupEnd();

  if (notify) {
    const summary = [
      `${report.found}/${report.configured} objet(s) trouvé(s)`,
      `${report.updated} modifié(s)`,
      `${report.unchanged} déjà correct(s)`
    ].join(" — ");

    if (report.errors.length) {
      ui.notifications.error(`Synchronisation partielle : ${summary}.`);
    } else {
      ui.notifications.info(`Canevas synchronisé : ${summary}.`);
    }

    if (report.missing.length || report.invalid.length) {
      ui.notifications.warn(
        "Certains UUID n'ont pas pu être utilisés. Consulte la console F12."
      );
    }
  }

  return report;
}

export async function syncCanvasSafely(state, { notify = false } = {}) {
  try {
    return await syncCanvasFromState(state, { notify });
  } catch (error) {
    console.error(`${MODULE_ID} | Erreur imprévue de synchronisation.`, error);

    if (notify) {
      ui.notifications.error(
        "La synchronisation du canevas a rencontré une erreur."
      );
    }

    return null;
  }
}
