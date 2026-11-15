# Retry RPG

Retry RPG est un RPG textuel jouable dans un navigateur moderne, sans asset ni service externe. Il fonctionne localement sur Windows 10/11, Debian et Android.

## Lancer et sauvegarder

```bash
python3 -m http.server 8080
```

Ouvrir ensuite `http://localhost:8080`. La sauvegarde est stockée automatiquement dans `localStorage` sous la clé `retry-rpg-save-v2`.

## Cycle de vie

Une run commence à 16 ans. Chaque action principale fait avancer l'âge exactement d'une année, puis applique ses conséquences. Les tours internes d'un combat ne vieillissent jamais le personnage; la fin du combat compte comme une seule action. Le journal est toujours daté par âge : `16 ans : naissance`, puis `17 ans : entraînement`.

L'espérance moyenne initiale est de 30 ans, sans limite fixe. Le risque naturel augmente progressivement autour de cet âge : certains personnages meurent avant 30 ans et d'autres le dépassent. La Constitution et les héritages associés peuvent améliorer raisonnablement l'estimation affichée. Une mort de vieillesse, de maladie ou de combat termine la run. **Nouvelle vie** abandonne volontairement la run sans la compter comme une mort.

## Statistiques et maîtrise

Les statistiques principales sont Force, Magie, Agilité, Constitution, Savoir et Chance. Les gains des actions sont fractionnaires et lents : les choix ont donc plus d'importance que la répétition automatique.

Les statistiques secondaires sont calculées depuis les caractéristiques et l'équipement : Précision, Esquive, Coup critique, Dégâts critiques, Vitesse d'attaque, Défense physique, Régénération de vie, Mana maximal, Régénération de mana, Puissance magique, Résistance magique, résistances tranchante, perforante, contondante, feu, glace, vent et terre. Les valeurs sont affichées près de leurs barres de PV et de mana.

Tous les domaines utilisent sept rangs, avec une courbe d'expérience non linéaire : **Débutant, Novice, Apprenti, Initié, Confirmé, Expert, Maître**. La maîtrise de la run actuelle commence à Débutant et n'est jamais copiée directement dans une nouvelle génération. Le meilleur niveau historique, lui, est conservé.

## Héritage et historique

À la mort, les connaissances deviennent des talents permanents d'apprentissage. Une vocation de classe, des connaissances de métier, une affinité élémentaire ou une connaissance d'arme ajoutent un petit bonus cumulable à la vitesse de progression; elles ne donnent jamais automatiquement un rang.

Le menu **Héritage** affiche les classes, évolutions, métiers, talents, sources et bonus permanents, ainsi que l'historique des personnages terminés : nom, classe, métier, âge final, maîtrises de la run, techniques apprises et découvertes. Les générations précédentes ne transmettent pas leurs niveaux temporaires.

## Classes

Une classe sélectionnée ne peut pas être changée durant la run. Une classe débloquée pendant une run est immédiatement sélectionnable si le personnage est encore sans classe et reste disponible aux générations suivantes.

| Classe | Déblocage |
|---|---|
| Guerrier | Atteindre 7 Force |
| Mage | Effectuer 4 actions d'étude générale |
| Voleur | Atteindre 6 XP de maîtrise des dagues |
| Rôdeur | Effectuer 3 explorations |
| Alchimiste | Trouver 4 objets |
| Mage de feu* | Atteindre 8 XP de maîtrise du feu |
| Mage de glace* | Atteindre 8 XP de maîtrise de la glace |
| Arcaniste primordial* | Obtenir le Cœur primordial |

Les classes marquées `*` sont cachées avant leur découverte. Les évolutions Mage de feu et Mage de glace sont des classes distinctes, avec leur propre maîtrise et identité; elles ne demandent pas d'avoir maîtrisé Mage. Les évolutions vent et terre sont prévues par la même architecture de données.

## Métiers

Un métier choisi ne peut pas être changé durant la run. Les niveaux de métier utilisent les sept rangs de maîtrise.

| Métier | Déblocage | Effet principal |
|---|---|---|
| Fermier | Effectuer 3 travaux | 28 or de base, Constitution |
| Marchand | Gagner 90 or de travail | 38 or de base, bonus de revente |
| Érudit | Effectuer 3 études | Savoir et progression magique |
| Forgeron | Trouver 3 matériaux | 32 or de base et progression de forge |

Sans métier, le travail reste possible mais rapporte seulement 12 or de base. L'aperçu du menu Actions utilise exactement la même formule que l'exécution.

## Actions

**Entraînement physique** travaille lentement Force et Constitution. **Étude générale** travaille Savoir et Magie sans augmenter automatiquement un élément. Des études ciblées séparées permettent de travailler activement Feu, Glace, Vent ou Terre; aucune maîtrise élémentaire ne progresse autrement. **Exploration générale** propose un résultat incertain : statistiques limitées, matériaux, objets revendables, consommables ou découvertes rares. **Travail** est la source directe d'argent principale. **Repos** récupère PV/mana et peut guérir une maladie sans garantie.

## Techniques et attaques

Un nouveau personnage connaît uniquement **Frappe tranchante** et peut laisser trois emplacements d'attaque vides. Les attaques équipées sont donc comprises entre zéro et quatre, et le combat automatique utilise seulement celles qui existent; à défaut, une attaque de base gratuite est utilisée.

Les techniques élémentaires ne sont jamais données au départ. Les étudier activement augmente l'affinité et débloque progressivement les sorts correspondants. Les techniques d'armes se débloquent de la même façon avec l'utilisation réelle de la catégorie : épées, haches, masses et marteaux, lances, arcs et arbalètes, dagues, mains nues et catalyseurs. Les techniques de la run ne sont pas copiées aux générations suivantes, seuls les talents d'apprentissage sont transmis.

Chaque technique possède nom, catégorie, puissance, précision sans symbole `%` dans l'interface, coût de mana, description et effets éventuels. Le menu Stats combat permet de remplacer une attaque équipée par une technique apprise.

## Combat

Les combats sont au tour par tour, en mode **Manuel** ou **Automatique**. Le mode automatique choisit en fonction des PV, du mana disponible, de la puissance et des résistances ennemies, sans vieillir à chaque tour. Les dégâts différencient tranchant, perforant, contondant, feu, glace, vent et terre. Le journal de combat détaille attaque, précision, dégâts, critiques, résistances, statuts, soins et résultat.

Les talents conditionnels présents sont Berserker (PV faibles), Prédateur (ennemi presque vaincu), Instinct élémentaire et Dernier souffle. La maîtrise d'arme progresse lors de l'utilisation réelle des attaques.

## Maladies

Les maladies sont des statuts indépendants des statistiques principales. Elles possèdent un nom, une gravité (Légère, Modérée, Grave ou Critique), une progression et un risque d'aggravation. Le repos peut les soigner; certaines potions aident également. Une maladie critique non traitée peut être mortelle.

## Commerce, objets et équipement

Le commerce renouvelle une partie de son stock tous les cinq ans d'âge. Les objets sont empilables et possèdent un prix d'achat et un prix de revente inférieur. Le joueur peut acheter, vendre et consulter les quantités.

Les catégories sont équipements, consommables, objets de valeur et matériaux. Les équipements ont les raretés Commun, Inhabituel, Rare et Mythique, sans affixes aléatoires. Les neuf emplacements sont : arme principale, arme secondaire, casque, plastron, jambières, bottes, gants, accessoire 1 et accessoire 2. Les prérequis sont exclusivement statistiques.

## Zones et découvertes

Les dix zones sont Forêt ancienne, Ruines oubliées, Crypte maudite, Mines profondes, Marais toxique, Sanctuaire gelé, Volcan ardent, Tour des arcanes, Abîme des titans et Donjon des origines. Leur difficulté, leurs prérequis, leurs ennemis et leur butin sont distincts. Le Donjon des origines contient le boss Gardien primordial. Son butin rare, le Cœur primordial, débloque définitivement l'Arcaniste primordial et le rend sélectionnable immédiatement pour un personnage sans classe.
