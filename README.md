# Evilbram Ten Candles Roll

Module Foundry VTT 14 dédié au système `tencandles`.

## Architecture des scripts

Le manifeste charge uniquement `scripts/main.js`. Ce point d’entrée importe ensuite les fichiers spécialisés :

```text
scripts/
├── main.js           # Initialisation, hooks et API publique des macros
├── constants.js      # Identifiants et constantes communes
├── utils.js          # Fonctions génériques et lecture des formulaires
├── state.js          # État persistant de la partie
├── dice.js           # Lancers de d6 et analyse des résultats
├── resources.js      # Actor, Vice, Vertu, Espoir et Limite
├── resolution.js     # Cycle complet d’un conflit
├── chat.js           # Cartes et messages du chat
├── canvas-sync.js    # Bougies, lumières et dés du canevas
├── scene-installer.js    # Import et configuration de la scène officielle
├── fonts.js          # Enregistrement des polices auprès de Foundry
├── dialogs.js        # Fenêtres de configuration
├── socket.js         # Communication joueur → MJ
├── notifications.js  # Notifications entre utilisateurs
└── controls.js       # Boutons Tokens et actions du chat
```

## Repères de lecture

- Pour comprendre **comment un jet est résolu**, commencer par `resolution.js`.
- Pour comprendre **les règles des dés**, lire `dice.js`.
- Pour comprendre **Vice, Vertu, Espoir et Limite**, lire `resources.js`.
- Pour comprendre **les bougies et les dés sur la scène**, lire `canvas-sync.js`.
- Pour modifier **l’affichage du chat**, utiliser `chat.js` et `styles/module.css`.
- `main.js` doit rester court : il assemble le module mais ne contient pas les règles.

## API disponible pour les macros

```js
game.evilTenCandlesRoll.requestPlayerRoll()
game.evilTenCandlesRoll.requestGMRoll()
game.evilTenCandlesRoll.openCanvasSetup()
game.evilTenCandlesRoll.installOfficialScene()
game.evilTenCandlesRoll.syncCanvas()
game.evilTenCandlesRoll.openGMSetup()
game.evilTenCandlesRoll.getSelectedActorResources()
game.evilTenCandlesRoll.resetSelectedActorResources()
game.evilTenCandlesRoll.resetState()
```

## Installation manuelle

Extraire le dossier `evil-tencandles-roll` dans :

```text
Foundry Data/Data/modules/
```

Puis activer **Evilbram Ten Candles Roll** dans un monde utilisant le système `tencandles`.


## Scène officielle

Le module déclare le compendium de scènes :

```text
evil-tencandles-roll.le-monde-est-sombre
```

Le bouton **Installer la scène « Le monde est sombre... »** :

- réutilise la scène officielle si elle existe déjà dans le monde ;
- sinon, l’importe depuis le compendium ;
- l’ajoute à la navigation ;
- l’active et l’affiche pour le MJ, puis y conduit les utilisateurs ;
- configure automatiquement les flammes, lumières et dés en utilisant exclusivement l’ID de la scène importée ;
- initialise la partie avec dix bougies et dix dés bleus.


### Réparation de la scène officielle

Si une scène officielle est déjà présente mais que le monde conserve une ancienne
configuration de canevas, le module répare automatiquement les UUID au démarrage.

Commande manuelle disponible :

```js
game.evilTenCandlesRoll.repairOfficialSceneInstallation()
```
