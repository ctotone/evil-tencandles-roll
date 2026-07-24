/**
 * Installation et réparation de la scène officielle Ten Candles.
 *
 * Fonctionnalités :
 * - sérialisation des appels pour éviter les doubles clics ;
 * - réparation explicite d'une scène officielle déjà importée ;
 * - migration automatique si le monde cible encore une ancienne scène ;
 * - hook de secours lorsqu'une scène officielle est créée depuis le pack.
 */

import {
  MODULE_ID,
  STATE_KEY,
  TOTAL_CANDLES
} from "./constants.js";
import {
  createDefaultState,
  getState,
  normalizeCanvasSync,
  saveState
} from "./state.js";
import { syncCanvasSafely } from "./canvas-sync.js";
import { format, localize } from "./utils.js";

export const SCENE_INSTALLER_BUILD =
  "scene-installer-20260724";

const OFFICIAL_SCENE_SOURCE_NAME =
  "Le monde est sombre...";

export function getOfficialSceneName() {
  return localize("Scene.OfficialName");
}

export const OFFICIAL_SCENE_TEMPLATE_ID =
  "le-monde-est-sombre";

export const OFFICIAL_SCENE_PACK_ID =
  "evil-tencandles-roll.le-monde-est-sombre";

const OFFICIAL_SCENE_TEMPLATE_FLAG =
  "official-canvas";

let lastInstallerStage = "idle";
let lastInstallerError = null;
let activeInstallerPromise = null;

function setInstallerStage(stage, details = {}) {
  lastInstallerStage = stage;

  console.info(
    `${MODULE_ID} | Installateur de scène — ${stage}`,
    details
  );
}

function getModuleFlag(document, key) {
  return (
    document.getFlag?.(MODULE_ID, key)
    ?? document.flags?.[MODULE_ID]?.[key]
    ?? null
  );
}

function isOfficialScene(scene) {
  return (
    getModuleFlag(scene, "template")
      === OFFICIAL_SCENE_TEMPLATE_FLAG
    &&
    getModuleFlag(scene, "templateId")
      === OFFICIAL_SCENE_TEMPLATE_ID
  );
}

function getOfficialWorldScenes() {
  return game.scenes.filter(isOfficialScene);
}

function runSerializedInstaller(task) {
  if (activeInstallerPromise) {
    console.info(
      `${MODULE_ID} | Une installation est déjà en cours.`
    );

    return activeInstallerPromise;
  }

  activeInstallerPromise =
    Promise.resolve()
      .then(task)
      .finally(() => {
        activeInstallerPromise = null;
      });

  return activeInstallerPromise;
}

async function waitForCondition(
  condition,
  {
    timeoutMs = 15000,
    intervalMs = 100,
    errorMessage
  }
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return;

    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(errorMessage);
}

async function getOfficialSceneTemplate() {
  const pack = game.packs.get(
    OFFICIAL_SCENE_PACK_ID
  );

  if (!pack) {
    throw new Error(
      format("SceneInstaller.PackMissing", {
        pack: OFFICIAL_SCENE_PACK_ID
      })
    );
  }

  if (pack.documentName !== "Scene") {
    throw new Error(
      format("SceneInstaller.PackWrongType", {
        pack: OFFICIAL_SCENE_PACK_ID
      })
    );
  }

  const scenes = await pack.getDocuments();

  const template =
    scenes.find(isOfficialScene)
    ?? scenes.find(
      (scene) =>
        scene.name === OFFICIAL_SCENE_SOURCE_NAME ||
        scene.name === getOfficialSceneName()
    )
    ?? null;

  if (!template) {
    throw new Error(
      format("SceneInstaller.TemplateMissing", {
        pack: OFFICIAL_SCENE_PACK_ID
      })
    );
  }

  return {
    pack,
    template
  };
}

async function importOfficialScene() {
  const {
    pack,
    template
  } = await getOfficialSceneTemplate();

  setInstallerStage("import-start", {
    templateId: template.id
  });

  const importedScene =
    await game.scenes.importFromCompendium(
      pack,
      template.id,
      {
        name: getOfficialSceneName(),
        navigation: true,
        active: false,
        folder: null
      }
    );

  if (!importedScene) {
    throw new Error(
      localize("SceneInstaller.ImportFailed")
    );
  }

  const worldScene =
    game.scenes.get(importedScene.id)
    ?? importedScene;

  setInstallerStage("import-complete", {
    sceneId: worldScene.id
  });

  return worldScene;
}

async function getOrImportOfficialScene() {
  const installedScenes =
    getOfficialWorldScenes();

  if (installedScenes.length > 1) {
    throw new Error(
      [
        localize("SceneInstaller.MultipleScenes"),
        localize("SceneInstaller.DeleteDuplicates")
      ].join(" ")
    );
  }

  if (installedScenes.length === 1) {
    setInstallerStage("scene-reused", {
      sceneId: installedScenes[0].id
    });

    return {
      scene: installedScenes[0],
      alreadyInstalled: true
    };
  }

  return {
    scene: await importOfficialScene(),
    alreadyInstalled: false
  };
}

async function activateAndViewScene(scene) {
  setInstallerStage("activation-start", {
    sceneId: scene.id,
    currentActiveSceneId:
      game.scenes.active?.id ?? null
  });

  const activatedScene = await scene.activate({
    pullUsers: true,
    updateData: {
      navigation: true
    }
  });

  scene =
    game.scenes.get(activatedScene.id)
    ?? activatedScene;

  await scene.view();

  await waitForCondition(
    () => {
      return (
        game.scenes.active?.id === scene.id
        &&
        game.scenes.viewed?.id === scene.id
        &&
        canvas.scene?.id === scene.id
      );
    },
    {
      errorMessage: [
        format("SceneInstaller.ActivationFailed", {
          expected: scene.id,
          active: game.scenes.active?.id ?? localize("Common.None"),
          viewed: game.scenes.viewed?.id ?? localize("Common.None"),
          canvas: canvas.scene?.id ?? localize("Common.None")
        })
      ].join(" ")
    }
  );

  setInstallerStage("activation-complete", {
    sceneId: scene.id,
    activeSceneId:
      game.scenes.active?.id ?? null,
    viewedSceneId:
      game.scenes.viewed?.id ?? null,
    canvasSceneId:
      canvas.scene?.id ?? null
  });

  return scene;
}

function extractIndexedDocuments(
  documents,
  {
    label,
    role,
    namePattern
  }
) {
  const indexed = new Map();

  for (const document of documents) {
    const roleFlag =
      getModuleFlag(document, "role");

    const indexFlag =
      Number(
        getModuleFlag(document, "index")
      );

    if (
      roleFlag === role
      &&
      Number.isInteger(indexFlag)
      &&
      indexFlag >= 1
      &&
      indexFlag <= TOTAL_CANDLES
    ) {
      indexed.set(indexFlag, document);
      continue;
    }

    const name = String(
      document.name ?? ""
    ).trim();

    const match = namePattern.exec(name);

    if (!match) continue;

    const index = Number(match[1]);

    if (
      Number.isInteger(index)
      &&
      index >= 1
      &&
      index <= TOTAL_CANDLES
    ) {
      indexed.set(index, document);
    }
  }

  const missing = [];

  for (
    let index = 1;
    index <= TOTAL_CANDLES;
    index += 1
  ) {
    if (!indexed.has(index)) {
      missing.push(index);
    }
  }

  if (missing.length) {
    throw new Error(
      format("SceneInstaller.ElementsMissing", {
        label,
        missing: missing.join(", ")
      })
    );
  }

  return Array.from(
    { length: TOTAL_CANDLES },
    (_value, index) =>
      indexed.get(index + 1)
  );
}

function findSceneDocuments(scene) {
  return {
    candleFlames: extractIndexedDocuments(
      [...scene.tiles],
      {
        label: localize("SceneInstaller.Flames"),
        role: "candle-flame",
        namePattern: /^Flamme\s+(\d+)$/i
      }
    ),

    candleLights: extractIndexedDocuments(
      [...scene.lights],
      {
        label: localize("SceneInstaller.CandleLights"),
        role: "candle-light",
        namePattern: /^Lumière\s+(\d+)$/i
      }
    ),

    blueDice: extractIndexedDocuments(
      [...scene.tiles],
      {
        label: localize("SceneInstaller.BlueDice"),
        role: "blue-die",
        namePattern: /^D bleu\s+(\d+)$/i
      }
    ),

    redDice: extractIndexedDocuments(
      [...scene.tiles],
      {
        label: localize("SceneInstaller.RedDice"),
        role: "red-die",
        namePattern: /^D rouge\s+(\d+)$/i
      }
    )
  };
}

function createFlagUpdates(
  documents,
  role
) {
  return documents.map(
    (document, position) => {
      return {
        _id: document.id,
        [`flags.${MODULE_ID}.role`]:
          role,
        [`flags.${MODULE_ID}.index`]:
          position + 1
      };
    }
  );
}

async function repairImportedSceneFlags(scene) {
  setInstallerStage("flag-repair-start", {
    sceneId: scene.id
  });

  const documents =
    findSceneDocuments(scene);

  await scene.updateEmbeddedDocuments(
    "Tile",
    [
      ...createFlagUpdates(
        documents.candleFlames,
        "candle-flame"
      ),
      ...createFlagUpdates(
        documents.blueDice,
        "blue-die"
      ),
      ...createFlagUpdates(
        documents.redDice,
        "red-die"
      )
    ],
    {
      diff: true,
      render: false
    }
  );

  await scene.updateEmbeddedDocuments(
    "AmbientLight",
    createFlagUpdates(
      documents.candleLights,
      "candle-light"
    ),
    {
      diff: true,
      render: false
    }
  );

  scene =
    game.scenes.get(scene.id)
    ?? scene;

  const repairedDocuments =
    findSceneDocuments(scene);

  setInstallerStage("flag-repair-complete", {
    sceneId: scene.id,
    candleFlames:
      repairedDocuments.candleFlames.length,
    candleLights:
      repairedDocuments.candleLights.length,
    blueDice:
      repairedDocuments.blueDice.length,
    redDice:
      repairedDocuments.redDice.length
  });

  return {
    scene,
    documents: repairedDocuments
  };
}

function toEmbeddedUuid(
  scene,
  embeddedName,
  document
) {
  return [
    "Scene",
    scene.id,
    embeddedName,
    document.id
  ].join(".");
}

function buildCanvasConfiguration(
  scene,
  documents
) {
  return normalizeCanvasSync({
    enabled: true,
    sceneId: scene.id,

    candleFlameUuids:
      documents.candleFlames.map(
        (document) =>
          toEmbeddedUuid(
            scene,
            "Tile",
            document
          )
      ),

    candleLightUuids:
      documents.candleLights.map(
        (document) =>
          toEmbeddedUuid(
            scene,
            "AmbientLight",
            document
          )
      ),

    blueDieUuids:
      documents.blueDice.map(
        (document) =>
          toEmbeddedUuid(
            scene,
            "Tile",
            document
          )
      ),

    redDieUuids:
      documents.redDice.map(
        (document) =>
          toEmbeddedUuid(
            scene,
            "Tile",
            document
          )
      )
  });
}

function assertCanvasConfiguration(
  canvasSync,
  sceneId
) {
  if (canvasSync.sceneId !== sceneId) {
    throw new Error(
      [
        format("SceneInstaller.WrongTarget", {
          expected: sceneId,
          configured: canvasSync.sceneId ?? localize("Common.None")
        })
      ].join(" ")
    );
  }

  const expectedPrefix =
    `Scene.${sceneId}.`;

  const allUuids = [
    ...canvasSync.candleFlameUuids,
    ...canvasSync.candleLightUuids,
    ...canvasSync.blueDieUuids,
    ...canvasSync.redDieUuids
  ];

  if (
    allUuids.length
    !== TOTAL_CANDLES * 4
  ) {
    throw new Error(
      format("SceneInstaller.UuidCount", {
        expected: TOTAL_CANDLES * 4,
        found: allUuids.length
      })
    );
  }

  const invalidUuid = allUuids.find(
    (uuid) =>
      !String(uuid).startsWith(
        expectedPrefix
      )
  );

  if (invalidUuid) {
    throw new Error(
      format("SceneInstaller.ExternalUuid", {
        uuid: invalidUuid
      })
    );
  }
}

async function persistConfiguration(
  scene,
  documents
) {
  setInstallerStage(
    "configuration-start",
    {
      sceneId: scene.id
    }
  );

  const state = createDefaultState();

  state.stage = "scene";
  state.litCandles = TOTAL_CANDLES;
  state.bluePoolRemaining =
    TOTAL_CANDLES;
  state.activeResolution = null;
  state.lastResolution = null;

  state.canvasSync =
    buildCanvasConfiguration(
      scene,
      documents
    );

  assertCanvasConfiguration(
    state.canvasSync,
    scene.id
  );

  await saveState(state);

  await waitForCondition(
    () => {
      const rawSetting =
        game.settings.get(
          MODULE_ID,
          STATE_KEY
        );

      return (
        rawSetting?.canvasSync?.sceneId
        === scene.id
      );
    },
    {
      errorMessage: [
        format("SceneInstaller.ConfigNotSaved", {
          expected: scene.id,
          read: game.settings.get(
            MODULE_ID,
            STATE_KEY
          )?.canvasSync?.sceneId
            ?? localize("Common.None")
        })
      ].join(" ")
    }
  );

  const persistedState = getState();

  assertCanvasConfiguration(
    persistedState.canvasSync,
    scene.id
  );

  setInstallerStage(
    "configuration-complete",
    {
      sceneId: scene.id,
      configuredSceneId:
        persistedState.canvasSync.sceneId,
      firstConfiguredUuid:
        persistedState
          .canvasSync
          .candleFlameUuids[0]
    }
  );

  return persistedState;
}

async function finalizeOfficialScene(
  scene,
  {
    activate = true,
    notify = true,
    reason = "manual"
  } = {}
) {
  setInstallerStage("finalization-start", {
    sceneId: scene.id,
    activate,
    reason
  });

  if (activate) {
    scene =
      await activateAndViewScene(scene);
  } else if (!scene.navigation) {
    await scene.update({
      navigation: true
    });

    scene =
      game.scenes.get(scene.id)
      ?? scene;
  }

  const repaired =
    await repairImportedSceneFlags(scene);

  scene = repaired.scene;

  const state =
    await persistConfiguration(
      scene,
      repaired.documents
    );

  const report =
    await syncCanvasSafely(
      state,
      {
        notify: false
      }
    );

  if (!report) {
    throw new Error(
      localize("SceneInstaller.NoSyncReport")
    );
  }

  if (
    report.invalid.length
    ||
    report.missing.length
    ||
    report.errors.length
  ) {
    throw new Error(
      format("SceneInstaller.SyncIncomplete", {
        invalid: report.invalid.length,
        missing: report.missing.length,
        errors: report.errors.length
      })
    );
  }

  setInstallerStage(
    "complete",
    {
      sceneId: scene.id,
      configuredSceneId:
        getState().canvasSync.sceneId,
      reason
    }
  );

  if (notify) {
    ui.notifications.info(
      activate
        ? format("SceneInstaller.ActivatedConfigured", {
            name: getOfficialSceneName()
          })
        : format("SceneInstaller.Configured", {
            name: getOfficialSceneName()
          })
    );
  }

  return scene;
}

function getRoleCounts(scene) {
  const counts = {
    candleFlames: 0,
    candleLights: 0,
    blueDice: 0,
    redDice: 0
  };

  for (const tile of scene?.tiles ?? []) {
    const role =
      getModuleFlag(tile, "role");

    if (role === "candle-flame") {
      counts.candleFlames += 1;
    }

    if (role === "blue-die") {
      counts.blueDice += 1;
    }

    if (role === "red-die") {
      counts.redDice += 1;
    }
  }

  for (const light of scene?.lights ?? []) {
    if (
      getModuleFlag(light, "role")
      === "candle-light"
    ) {
      counts.candleLights += 1;
    }
  }

  return counts;
}

export function getSceneInstallerDiagnostics() {
  const officialScenes =
    getOfficialWorldScenes();

  const officialScene =
    officialScenes[0] ?? null;

  const state = getState();

  const diagnostics = {
    build: SCENE_INSTALLER_BUILD,
    lastInstallerStage,
    lastInstallerError:
      lastInstallerError?.message ?? null,

    officialSceneIds:
      officialScenes.map(
        (scene) => scene.id
      ),

    officialSceneRoleCounts:
      getRoleCounts(officialScene),

    activeSceneId:
      game.scenes.active?.id ?? null,

    viewedSceneId:
      game.scenes.viewed?.id ?? null,

    canvasSceneId:
      canvas.scene?.id ?? null,

    configuredSceneId:
      state.canvasSync.sceneId ?? null,

    firstConfiguredUuid:
      state.canvasSync
        .candleFlameUuids[0]
        ?? null
  };

  console.info(
    `${MODULE_ID} | Diagnostic installateur de scène.`,
    diagnostics
  );

  return diagnostics;
}

export function repairOfficialSceneInstallation({
  activate = true,
  notify = true,
  reason = "manual-repair"
} = {}) {
  return runSerializedInstaller(
    async () => {
      lastInstallerError = null;

      setInstallerStage("repair-start", {
        activate,
        reason
      });

      try {
        const officialScenes =
          getOfficialWorldScenes();

        if (officialScenes.length !== 1) {
          throw new Error(
            [
              localize("SceneInstaller.OneOfficialScene"),
              format("SceneInstaller.SceneCount", {
                count: officialScenes.length
              })
            ].join(" ")
          );
        }

        return await finalizeOfficialScene(
          officialScenes[0],
          {
            activate,
            notify,
            reason
          }
        );
      } catch (error) {
        lastInstallerError = error;

        setInstallerStage("error", {
          message: error.message,
          reason
        });

        console.error(
          `${MODULE_ID} | Réparation impossible.`,
          error,
          getSceneInstallerDiagnostics()
        );

        if (notify) {
          ui.notifications.error(
            [
              localize("SceneInstaller.RepairFailed"),
              error.message,
              localize("SceneInstaller.CheckConsole")
            ].join(" ")
          );
        }

        return null;
      }
    }
  );
}

export function installOfficialScene() {
  return runSerializedInstaller(
    async () => {
      lastInstallerError = null;

      setInstallerStage("start", {
        build: SCENE_INSTALLER_BUILD
      });

      ui.notifications.info(
        format("SceneInstaller.Loaded", {
          build: SCENE_INSTALLER_BUILD
        })
      );

      try {
        const {
          scene,
          alreadyInstalled
        } = await getOrImportOfficialScene();

        const finalizedScene =
          await finalizeOfficialScene(
            scene,
            {
              activate: true,
              notify: false,
              reason: alreadyInstalled
                ? "button-reuse"
                : "button-import"
            }
          );

        ui.notifications.info(
          alreadyInstalled
            ? localize("SceneInstaller.Reused")
            : localize("SceneInstaller.Imported")
        );

        return finalizedScene;
      } catch (error) {
        lastInstallerError = error;

        setInstallerStage("error", {
          message: error.message
        });

        console.error(
          `${MODULE_ID} | Échec de l’installateur de scène.`,
          error,
          getSceneInstallerDiagnostics()
        );

        ui.notifications.error(
          [
            localize("SceneInstaller.InstallFailed"),
            error.message,
            localize("SceneInstaller.CheckConsole")
          ].join(" ")
        );

        return null;
      }
    }
  );
}

export async function repairOfficialSceneConfigurationOnReady() {
  if (!game.user.isGM) return null;

  const officialScenes =
    getOfficialWorldScenes();

  if (officialScenes.length !== 1) {
    return null;
  }

  const officialScene =
    officialScenes[0];

  const configuredSceneId =
    getState().canvasSync.sceneId;

  if (
    configuredSceneId
    === officialScene.id
  ) {
    return officialScene;
  }

  console.warn(
    `${MODULE_ID} | La scène officielle existe mais la configuration cible encore ${configuredSceneId ?? "aucune scène"}. Réparation automatique.`
  );

  return repairOfficialSceneInstallation({
    activate: false,
    notify: true,
    reason: "ready-migration"
  });
}

export function handleOfficialSceneCreated(
  scene,
  _options,
  userId
) {
  if (!game.user.isGM) return;
  if (userId !== game.user.id) return;
  if (!isOfficialScene(scene)) return;

  globalThis.setTimeout(() => {
    repairOfficialSceneInstallation({
      activate: true,
      notify: true,
      reason: "create-scene-hook"
    });
  }, 250);
}
