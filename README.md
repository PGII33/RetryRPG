# Retry RPG

Retry RPG est un RPG textuel jouable dans un navigateur moderne. Il ne dépend d'aucun asset ni service externe : les fichiers peuvent être ouverts localement ou servis par n'importe quel serveur statique. L'interface est responsive pour Windows 10/11, Debian et Android.

## Lancer le jeu

Depuis le dossier du projet :

```bash
python3 -m http.server 8080
```

Puis ouvrir <http://localhost:8080>. Les sauvegardes sont stockées dans `localStorage` du navigateur.

## Règles principales

- Une nouvelle vie commence à **16 ans** avec six statistiques entre 2 et 5 : Force, Magie, Agilité, Constitution, Savoir et Chance.
- Chaque action améliore les statistiques associées. Toutes les **5 actions**, le personnage vieillit d'un an.
- Les maladies dépendent de la Constitution. La vieillesse devient dangereuse après 70 ans. Les combats automatiques peuvent tuer.
- À la mort, une nouvelle vie est créée manuellement. Les déblocages permanents et certains talents peuvent être hérités.
- Les équipements utilisent trois emplacements (arme, armure, accessoire). Leurs prérequis sont exclusivement statistiques, jamais la classe ou le métier.
- Les potions sont des consommables achetés au marché puis utilisés depuis le menu **Commerce**.

## Classes

La première vie propose **Sans classe**. Les autres classes sont débloquées définitivement par la lignée :

| Classe | Condition de déblocage |
| --- | --- |
| Guerrier | Avoir terminé au moins une vie (une mort) |
| Mage | Atteindre 8 en Magie au meilleur moment d'une vie |
| Voleur | Atteindre 7 en Agilité |
| Rôdeur | Atteindre 25 ans |
| Alchimiste | Avoir gagné 250 or cumulés |

Une classe ajoute un bonus initial caché à sa statistique associée et possède un talent de vie.

## Métiers

La première vie propose **Sans métier**. Les métiers déverrouillés restent disponibles :

| Métier | Condition de déblocage |
| --- | --- |
| Fermier | Effectuer 5 actions cumulées |
| Marchand | Gagner 100 or cumulés |
| Érudit | Atteindre 7 en Savoir |

Le métier donne une progression accélérée cachée pendant les actions concernées.

## Héritage

Les talents de classe et de métier, ainsi que le premier talent non encore transmis du personnage mort, deviennent des passifs permanents. Le personnage suivant reçoit ces bonus dès sa création. Le menu **Héritage** affiche les statistiques de l'ensemble de la lignée et les déblocages.

## Menus

- **Résumé** : identité, âge, richesse, statistiques finales, équipements et passifs.
- **Actions** : entraînement, étude, exploration, travail et repos.
- **Commerce** : équipements et consommables avec prérequis.
- **Équipement** : équiper ou retirer les objets possédés.
- **Combat** : résolution automatique et risque de mort.
- **Héritage** : progression permanente de la lignée.
