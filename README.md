# Retry RPG — itération 2

RPG textuel jouable localement dans un navigateur moderne, sans assets ni service externe. L'interface est responsive pour Windows 10/11, Debian et Android. La sauvegarde v2 est stockée dans `localStorage`; elle utilise la clé `retry-rpg-save-v2` et réinitialise volontairement les anciennes sauvegardes.

## Lancer

```bash
python3 -m http.server 8080
```

Ouvrir ensuite <http://localhost:8080>.

## Cycle de vie

- Chaque run commence à 16 ans.
- Chaque action principale (entraînement, étude, exploration, travail, repos) fait avancer exactement d'un an et ajoute une entrée datée dans le journal.
- Les tours internes d'un combat ne font jamais vieillir le personnage. La fin du combat compte comme une seule action principale.
- L'espérance de vie moyenne de départ est de 30 ans (décès naturel probabiliste autour de cet âge, donc environ 14 actions après 16 ans). La Constitution et les héritages de Constitution peuvent l'améliorer légèrement.
- Une mort de maladie, de vieillesse ou de combat termine la run. « Nouvelle vie » abandonne volontairement la run sans la compter comme une mort, puis ouvre la création.

## Statistiques

Les six statistiques principales sont Force, Magie, Agilité, Constitution, Savoir et Chance. Les gains d'actions sont fractionnaires et lents (`0,15` à `0,25`), pour rendre les choix et les maîtrises importants.

Les statistiques secondaires calculées sont : Précision, Esquive, Coup critique, Dégâts critiques, Vitesse d'attaque, Défense physique, Régénération de vie, Mana maximal, Régénération de mana, Puissance magique, Résistance magique, puis résistances tranchante, perforante, contondante, feu, glace, vent et terre. Elles utilisent les statistiques principales et les bonus d'équipement.

## Classes et métiers

Une classe ou un métier déverrouillé pendant la run est immédiatement sélectionnable depuis **Classes / métiers** si le personnage est encore « Sans classe » ou « Sans métier ». Un choix effectué ne peut pas être changé durant la run.

### Classes

| Classe | Condition de déblocage pendant une run |
|---|---|
| Guerrier | Atteindre 7 Force |
| Mage | Cumuler 10 XP de maîtrises élémentaires |
| Voleur | Atteindre 6 XP en maîtrise des dagues |
| Rôdeur | Effectuer 3 explorations |
| Alchimiste | Trouver 4 objets |
| Arcaniste primordial | Obtenir le Cœur primordial |

La classe ajoute un bonus initial à sa statistique associée et transmet une connaissance à la mort.

### Métiers

| Métier | Condition de déblocage pendant une run |
|---|---|
| Fermier | Effectuer 3 travaux |
| Marchand | Gagner 90 or par le travail |
| Érudit | Effectuer 3 études |
| Forgeron | Trouver 3 matériaux |

Les niveaux de maîtrise sont Débutant, Intermédiaire, Avancé, Expert et Maître. Le métier donne un revenu et un effet de travail distincts; la maîtrise monte lentement avec le travail.

## Héritage

À la mort, le meilleur historique de chaque statistique est conservé. La classe et le métier de la run transmettent une connaissance d'apprentissage (`+0,25` dans la statistique liée) aux générations suivantes. Les classes, métiers et Arcaniste primordial débloqués restent disponibles définitivement. L'héritage accélère donc l'apprentissage sans donner automatiquement un niveau complet.

## Actions, maladies et santé

- **Entraînement** : Force et Constitution.
- **Étude** : Savoir, Magie et affinité élémentaire feu.
- **Exploration** : Agilité, Chance, objets, matériaux, gemmes et potions avec raretés différentes.
- **Travail** : seule source d'argent directe, avec revenu dépendant du métier.
- **Repos** : PV, mana et chance de guérison.

Les maladies sont des statuts indépendants des statistiques principales. Elles ont un nom, une gravité (Légère, Modérée, Grave, Critique), une progression et un risque d'aggravation/de décès. Une potion de soin peut parfois aider; le repos est le traitement principal, sans garantie automatique.

## Commerce et inventaire

Le marché affiche un stock partiel et se renouvelle tous les cinq ans d'âge. Les objets communs peuvent revenir, tandis que les équipements rares et objets de valeur sont tirés aléatoirement. Les objets sont empilables par quantité.

Les catégories sont :

- équipements permanents (neuf emplacements : arme principale, arme secondaire, casque, plastron, jambières, bottes, gants, accessoire 1, accessoire 2) ;
- consommables (potions de soin, mana et tonique coûteux) ;
- objets de valeur (gemme ancienne) ;
- matériaux (minerai, braise élémentaire).

Chaque objet affiche son prix d'achat et de revente. Les prix de revente sont inférieurs et le Marchand obtient un petit bonus. Les prérequis d'équipement sont toujours statistiques, jamais liés à la classe ou au métier. Les raretés présentes sont Commun, Inhabituel, Rare et Mythique; aucun affixe aléatoire n'est utilisé.

## Combat

Le menu **Combat** contient dix zones : Forêt ancienne, Ruines oubliées, Crypte maudite, Mines profondes, Marais toxique, Sanctuaire gelé, Volcan ardent, Tour des arcanes, Abîme des titans et Donjon des origines. Chaque zone a une difficulté, des ennemis, un prérequis, un butin et un journal de combat.

Le combat est au tour par tour. Le mode **Manuel** propose les attaques équipées; le mode **Automatique** choisit une attaque selon le mana restant, les soins, la puissance et les résistances de l'ennemi. Le choix du mode est mémorisé.

Les attaques présentes couvrent tranchant, perforant, contondant, distance, magie élémentaire, soin et protection. Chaque attaque possède puissance, précision, coût de mana, type et effets éventuels. Le mana maximal, sa régénération et la puissance magique sont affichés dans le résumé. Les résistances ennemies sont appliquées dans le journal, avec les coups critiques et les dégâts.

Les maîtrises d'armes suivies sont Épées, Haches, Masses et marteaux, Lances, Arcs et arbalètes, Dagues, Mains nues et Catalyseurs. Les maîtrises élémentaires suivies sont Feu, Glace, Vent et Terre. Elles gagnent de l'XP par utilisation et atteignent les cinq niveaux de maîtrise. Le menu **Stats combat** affiche aussi les talents conditionnels : Berserker augmente les dégâts lorsque les PV sont faibles, Prédateur augmente les dégâts contre un ennemi presque vaincu, Instinct élémentaire accompagne les sorts, et Dernier souffle donne une chance de survivre à une attaque mortelle. Riposte est affiché comme talent de combat réservé à une extension du blocage.

## Donjon des origines

Le Donjon des origines est la zone 10, avec le boss **Gardien primordial**. Sa récompense peut être le **Cœur primordial**. L'obtenir débloque définitivement et immédiatement la classe **Arcaniste primordial**, qui ajoute une affinité de progression avec les quatre éléments via son identité de classe.

## Menus

Résumé, Actions, Classes / métiers, Commerce, Inventaire, Équipement, Combat, Stats combat et Héritage sont tous reliés au modèle de jeu et sauvegardés automatiquement. Le journal de vie utilise toujours l'âge (`16 ans : naissance`, `17 ans : ...`) plutôt qu'une numérotation de run.
