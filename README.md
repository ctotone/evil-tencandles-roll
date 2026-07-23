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
