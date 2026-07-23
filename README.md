# Evil Ten Candles Roll — 0.1.0

Première base technique de la phase 1.

## Fonctionnalités présentes

- Bouton temporaire dans les contrôles de scène, groupe **Tokens**.
- Clic d’un joueur : création d’une résolution et lancer du pool bleu.
- Clic du MJ : lancer du pool rouge rattaché à la résolution active.
- Une seule résolution active à la fois.
- Carte de chat commune aux deux jets.
- État persistant dans un réglage de monde.
- Réglage MJ temporaire du nombre de bougies et du pool bleu restant.
- Communication joueur → MJ sans dépendance externe.

## Installation manuelle

Extraire le dossier `evil-tencandles-roll` dans :

`Foundry Data/Data/modules/`

Puis activer **Evil Ten Candles Roll** dans le monde.

## État interne

```js
{
  schemaVersion: 1,
  stage: "scene",
  litCandles: 10,
  bluePoolRemaining: 10,
  activeResolution: null,
  lastResolution: null
}
```

La résolution active contient l’instantané des bougies, les pools et les résultats.

## Outils de développement

Dans la console Foundry :

```js
game.evilTenCandlesRoll.getState()
game.evilTenCandlesRoll.openGMSetup()
game.evilTenCandlesRoll.cancelActiveResolution()
game.evilTenCandlesRoll.resetState()
```

## Étape suivante

Ajouter dans la carte de chat :

- Vice
- Vertu
- Moment
- Limite
- Validation réservée au MJ
- Interprétation finale
