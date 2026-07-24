English version bellow

# Evilbram Ten Candles Roll

**Evilbram Ten Candles Roll** accompagne les parties de **Ten Candles** sur Foundry VTT 14.

Le module gère les pools de dés des joueurs et du maître du jeu, les résultats des conflits, le Vice, la Vertu, l’Espoir, la Limite et la progression des dix bougies. Il propose également une scène officielle prête à l’emploi.

## Comment utiliser le module

### 1. Installer la scène Ten Candles

Une fois le module activé, le maître du jeu dispose d’un nouveau groupe de contrôles représenté par une flamme.

Clique sur **Installer la scène « Le monde est sombre... »**.

Le module :

- importe la scène depuis le compendium ;
- l’ajoute à la navigation ;
- l’active et l’affiche ;
- dirige les utilisateurs vers cette scène ;
- configure automatiquement les dix flammes, les dix lumières et les pools de dés ;
- initialise la partie avec dix bougies allumées et dix dés joueur.

Si la scène est déjà présente, elle est réutilisée et sa configuration est vérifiée automatiquement.

### 2. Préparer les personnages

Le module fonctionne avec les personnages du système Ten Candles.

Lors de la création d’un nouveau personnage, une **Vertu** et un **Vice** vides sont ajoutés automatiquement à sa fiche. Ils peuvent ensuite être complétés normalement.

Le module reconnaît également :

- l’**Espoir**, lorsqu’il est activé sur le personnage ;
- la **Limite**, lorsqu’elle est présente sur la fiche ;
- le Vice et la Vertu déjà consommés pendant la partie.

Pour lancer les dés d’un personnage, Foundry utilise en priorité :

1. son token sélectionné ;
2. le personnage attribué à l’utilisateur ;
3. un personnage possédé par l’utilisateur ;
4. une fenêtre de choix lorsqu’il reste plusieurs possibilités.

### 3. Lancer un conflit

Le joueur clique sur le bouton flottant **Lancer les dés**, visible en bas de l’écran.

Le module lance automatiquement le pool bleu disponible et ajoute le dé d’Espoir lorsqu’il doit être utilisé. Une carte de conflit apparaît ensuite dans le chat.

Depuis cette carte, le joueur peut utiliser les ressources disponibles :

- **Vice** : relance les résultats de 1 ;
- **Vertu** : relance les résultats de 1 ;
- **Limite** : relance l’ensemble du pool bleu ;
- **Espoir** : ajoute son dé selon l’état du personnage.

Une seule résolution peut être active à la fois.

### 4. Résoudre le conflit côté MJ

Le maître du jeu peut lancer son pool rouge depuis la carte du chat ou depuis la régie MJ.

Ce jet reste facultatif. Le MJ peut également valider directement le conflit sans lancer ses dés.

Après validation, la carte indique :

- la réussite ou l’échec définitif ;
- qui obtient la narration ;
- les conséquences sur le prochain pool joueur ;
- le passage éventuel au Bal des vérités.

### 5. Passer à la scène suivante

Après un échec normal, le bouton **Commencer le bal des vérités** apparaît.

Lorsqu’il est utilisé :

- une bougie s’éteint ;
- une lumière et une flamme disparaissent de la scène ;
- le pool bleu est restauré selon le nombre de bougies restantes ;
- un dé rouge supplémentaire devient visible ;
- un message d’ambiance accompagne la progression de l’obscurité.

À la dernière bougie, un échec fait quitter le personnage concerné au lieu d’éteindre la dernière flamme. La poursuite et la conclusion de la partie restent entre les mains du groupe.

## Outils du maître du jeu

La régie MJ, accessible depuis les contrôles de scène, propose les actions suivantes :

- lancer le pool du maître du jeu ;
- consulter l’état du Vice, de la Vertu et de la Limite d’un personnage ;
- réinitialiser le Vice et la Vertu d’un personnage ;
- installer ou réactiver la scène officielle ;
- configurer manuellement un autre canevas ;
- forcer la synchronisation des flammes, lumières et dés ;
- accéder aux réglages de développement et de remise à zéro de la partie.

Dans une utilisation normale, l’installation de la scène officielle suffit : aucune saisie manuelle d’UUID n’est nécessaire.

## Fonctionnalités principales

- gestion d’un pool joueur de dix dés maximum ;
- gestion du pool rouge du maître du jeu ;
- réussite sur un résultat de 6 ;
- perte temporaire des dés joueur ayant obtenu 1 ;
- comparaison des réussites pour déterminer la narration ;
- jet du maître du jeu facultatif ;
- gestion du Vice, de la Vertu, de l’Espoir et de la Limite ;
- validation finale des conflits par le maître du jeu ;
- Bal des vérités et extinction progressive des bougies ;
- gestion particulière du dernier conflit d’un personnage ;
- cartes de chat dédiées et messages d’ambiance ;
- synchronisation visuelle des bougies et des pools de dés ;
- scène officielle incluse dans un compendium ;
- interface multilingue.

## Dice So Nice

Le module est compatible avec **Dice So Nice** et utilise ses animations de dés en 3D lorsqu’il est installé et activé.

Tous les participants voient les mêmes résultats, avec l’apparence de dés configurée pour l’utilisateur ayant effectué le jet.

Dice So Nice reste optionnel : les conflits continuent de fonctionner sans animation 3D.

## Installation

### Depuis Foundry VTT

Installe le module depuis le catalogue Foundry lorsqu’il y est disponible, puis active **Evilbram Ten Candles Roll** dans ton monde.

### Installation manuelle

Télécharge l’archive de la dernière version, puis extrais le dossier :

```text
evil-tencandles-roll
```

dans :

```text
Foundry Data/Data/modules/
```

Redémarre Foundry VTT, ouvre ton monde et active le module depuis la gestion des modules.

## Compatibilité

- **Foundry VTT :** version 14
- **Système prévu :** Ten Candles
- **Dice So Nice :** facultatif, recommandé pour les animations 3D

## Langues disponibles

Le module est disponible dans les langues suivantes :

- français ;
- anglais ;
- allemand ;
- espagnol ;
- italien ;
- portugais du Brésil ;
- japonais ;
- coréen.

La langue affichée dépend des réglages de langue de Foundry VTT.

## Assistance et signalement de problème

Les problèmes, suggestions et retours peuvent être signalés sur le dépôt GitHub du module :

- dépôt : https://github.com/ctotone/evil-tencandles-roll
- problèmes : https://github.com/ctotone/evil-tencandles-roll/issues

Lors d’un signalement, précise autant que possible :

- la version de Foundry VTT ;
- la version du système Ten Candles ;
- les autres modules actifs ;
- les étapes permettant de reproduire le problème ;
- les éventuels messages visibles dans la console F12.

## Auteur

Module créé par **Evilbram**.

---

# Evilbram Ten Candles Roll

**Evilbram Ten Candles Roll** supports **Ten Candles** sessions on Foundry VTT 14.

The module manages player and Game Master dice pools, conflict results, Vice, Virtue, Hope, Brink, and the progression of the ten candles. It also includes an official ready-to-use scene.

## How to use the module

### 1. Install the Ten Candles scene

Once the module is enabled, the Game Master gains access to a new scene control group represented by a flame icon.

Click **Install the “The world is dark...” scene**.

The module will:

- import the scene from the compendium;
- add it to the scene navigation;
- activate and display it;
- move users to that scene;
- automatically configure the ten flames, ten lights, and dice pools;
- initialize the game with ten lit candles and ten player dice.

If the scene is already present, it is reused and its configuration is checked automatically.

### 2. Prepare the characters

The module works with characters from the Ten Candles system.

When a new character is created, an empty **Virtue** and **Vice** are automatically added to the character sheet. They can then be filled in normally.

The module also recognizes:

- **Hope**, when enabled on the character;
- the **Brink**, when present on the character sheet;
- Vice and Virtue that have already been used during the game.

When rolling for a character, Foundry selects, in order of priority:

1. the selected token;
2. the character assigned to the user;
3. a character owned by the user;
4. a selection dialog when several possibilities remain.

### 3. Start a conflict

The player clicks the floating **Roll the dice** button displayed near the bottom of the screen.

The module automatically rolls the available blue dice pool and adds the Hope die when it should be used. A conflict card then appears in the chat.

From this card, the player can use any available resources:

- **Vice**: rerolls all results of 1;
- **Virtue**: rerolls all results of 1;
- **Brink**: rerolls the entire blue dice pool;
- **Hope**: adds its die according to the character’s current state.

Only one resolution can be active at a time.

### 4. Resolve the conflict as Game Master

The Game Master can roll the red dice pool from the chat card or from the GM controls.

This roll is optional. The GM may also validate the conflict directly without rolling.

After validation, the card displays:

- the final success or failure;
- who gains narration;
- the consequences for the next player dice pool;
- whether the Brink of Truths begins.

### 5. Move to the next scene

After a normal failure, the **Begin the Brink of Truths** button appears.

When used:

- one candle is extinguished;
- one light and one flame disappear from the scene;
- the blue dice pool is restored according to the number of remaining candles;
- one additional red die becomes visible;
- an atmospheric message accompanies the growing darkness.

At the final candle, a failure causes the affected character to leave instead of extinguishing the last flame. The continuation and conclusion of the game remain in the hands of the group.

## Game Master tools

The GM controls, available from the scene controls, provide the following actions:

- roll the Game Master dice pool;
- check the status of a character’s Vice, Virtue, and Brink;
- reset a character’s Vice and Virtue;
- install or reactivate the official scene;
- manually configure another canvas;
- force synchronization of flames, lights, and dice;
- access development and game reset options.

For normal use, installing the official scene is sufficient: no manual UUID entry is required.

## Main features

- management of a player pool of up to ten dice;
- management of the Game Master’s red dice pool;
- success on a result of 6;
- temporary loss of player dice that rolled 1;
- comparison of successes to determine narration;
- optional Game Master roll;
- management of Vice, Virtue, Hope, and Brink;
- final conflict validation by the Game Master;
- Brink of Truths and progressive candle extinction;
- special handling of a character’s final conflict;
- dedicated chat cards and atmospheric messages;
- visual synchronization of candles and dice pools;
- official scene included in a compendium;
- multilingual interface.

## Dice So Nice

The module is compatible with **Dice So Nice** and uses its 3D dice animations when it is installed and enabled.

All participants see the same results, using the dice appearance configured by the user who made the roll.

Dice So Nice remains optional: conflicts continue to work without 3D animations.

## Installation

### From Foundry VTT

Install the module from the Foundry package browser when available, then enable **Evilbram Ten Candles Roll** in your world.

### Manual installation

Download the latest release archive, then extract the folder:

```text
evil-tencandles-roll
```

into:

```text
Foundry Data/Data/modules/
```

Restart Foundry VTT, open your world, and enable the module from the module management screen.

## Compatibility

- **Foundry VTT:** version 14
- **Intended system:** Ten Candles
- **Dice So Nice:** optional, recommended for 3D animations

## Available languages

The module is available in the following languages:

- French;
- English;
- German;
- Spanish;
- Italian;
- Brazilian Portuguese;
- Japanese;
- Korean.

The displayed language follows the language configured in Foundry VTT.

## Support and issue reporting

Problems, suggestions, and feedback can be submitted through the module’s GitHub repository:

- repository: https://github.com/ctotone/evil-tencandles-roll
- issues: https://github.com/ctotone/evil-tencandles-roll/issues

When reporting an issue, include as much of the following information as possible:

- Foundry VTT version;
- Ten Candles system version;
- other enabled modules;
- steps required to reproduce the issue;
- any messages shown in the F12 developer console.

## Author

Module created by **Evilbram**.
