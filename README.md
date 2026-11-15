# Retry RPG

Retry RPG est un RPG textuel jouable dans un navigateur moderne, sans service externe. Une génération commence à 16 ans et chaque activité principale fait avancer l'âge d'une année exactement. La sauvegarde est automatique dans `localStorage` sous la clé `retry-rpg-save-v2`.

## Créer une génération

Le nom, la classe et le métier sont choisis à la naissance. Les classes et métiers déjà découverts par la lignée sont proposés lors des générations suivantes. Les héritages augmentent les statistiques initiales ou accélèrent un apprentissage, mais ne copient pas les niveaux de maîtrise de la génération précédente.

Les statistiques principales sont Force, Magie, Agilité, Constitution, Savoir et Chance. Elles déterminent notamment les dégâts, la défense, le mana, la régénération, les résistances et le risque d'une rencontre en exploration. Les maîtrises utilisent les rangs Débutant, Novice, Apprenti, Initié, Confirmé, Expert et Maître.

## Classes accessibles normalement

| Classe | Condition de découverte |
|---|---|
| Sans classe | Toujours disponible |
| Guerrier | Atteindre 7 Force |
| Mage | Effectuer 4 études générales |
| Voleur | Atteindre 6 XP de maîtrise des dagues |
| Rôdeur | Effectuer 3 explorations |
| Alchimiste | Trouver 4 objets |

Une classe choisie reste celle de la génération. Les techniques de classe apparaissent dans l'entraînement lorsqu'une classe est active.

## Classes cachées

Ces classes existent dans la lignée mais restent masquées jusqu'à leur découverte :

| Classe | Condition |
|---|---|
| Mage de feu | Atteindre 8 XP d'affinité du feu |
| Mage de glace | Atteindre 8 XP d'affinité de la glace |
| Arcaniste primordial | Obtenir un Cœur primordial |

Les classes cachées découvertes sont conservées pour les prochaines générations.

## Actions

### Études

L'onglet Études présente les activités réellement disponibles :

- **Études générales**, accessibles à tous : Savoir et Magie progressent.
- **Étude sur le mana**, accessible aux voies magiques : Magie et Savoir progressent et la compréhension magique peut être transmise.
- **Études élémentaires**, accessibles aux voies magiques : une seule affinité choisie progresse à la fois parmi Feu, Glace, Vent et Terre. Elles débloquent les techniques et les conditions des évolutions correspondantes.

Une étude n'accorde jamais automatiquement de maîtrise dans un autre domaine.

### Entraînement

L'onglet Entraînement regroupe :

- le développement physique (Force, Agilité, Constitution) ;
- les techniques de base (mains nues) ;
- les techniques de combat par arme, qui augmentent la maîtrise de la catégorie et peuvent débloquer une attaque ;
- les techniques de classe ;
- les techniques magiques, dont la concentration de mana, qui augmente la régénération de mana.

Les gains et la maîtrise actuelle sont affichés sur chaque activité. Les activités de classe ou magiques sont masquées tant que la condition n'est pas remplie. Travailler une arme ne donne pas de maîtrise élémentaire.

### Exploration

L'onglet Exploration décrit chaque zone avec sa difficulté, ses ennemis, ses ressources, son butin, ses risques et ses prérequis. Une zone inconnue peut être tentée directement si ses prérequis sont satisfaits. Dès la première entrée, elle devient découverte et reste sélectionnable jusqu'à la fin de la génération.

L'entrée peut déclencher une rencontre aléatoire. La probabilité est centralisée et dépend de la difficulté et de l'Agilité : une Agilité élevée réduit le risque. Une exploration sans combat peut fournir une ressource, un objet ou aucun résultat. Les découvertes sont propres à la génération et sont réinitialisées lors de la création d'une nouvelle vie.

Les autres activités sont le travail, qui rapporte de l'or selon le métier, et le repos, qui récupère des PV et du mana et peut guérir une maladie.

## Zones

Les zones disponibles sont la Forêt ancienne, les Ruines oubliées, la Crypte maudite, les Mines profondes, le Marais toxique, le Sanctuaire gelé, le Volcan ardent, la Tour des arcanes, l'Abîme des titans et le Donjon des origines. Les zones avancées demandent des statistiques ou une maîtrise élémentaire précises. Le Donjon des origines contient le Gardien primordial et peut fournir le Cœur primordial.

## Combat

Les combats sont au tour par tour, en mode Manuel ou Automatique. Les attaques utilisent la précision, les résistances, les coups critiques, les PV et le mana. Les maîtrises d'armes progressent lorsque la catégorie est travaillée et les techniques apprises peuvent être placées dans les quatre emplacements d'attaque.

Un combat terminé compte comme une seule action de vie : les tours internes ne vieillissent pas le personnage. Le journal de combat détaille la zone, l'ennemi, les actions et le résultat.

## Récompenses et journal de vie

Une victoire tire une récompense de la zone puis l'ajoute réellement à l'inventaire. Le journal indique la zone, l'ennemi vaincu, les objets reçus et, le cas échéant, l'expérience ou les déblocages réellement attribués. Une récompense non obtenue n'est jamais affichée.

Le journal de vie est daté uniquement par l'âge, par exemple `16 ans : naissance` ou `18 ans : étude sur le mana`. Il ne contient pas de numéro de séquence.

## Maladies, commerce et équipement

Les maladies ont une gravité et une progression ; elles peuvent empirer avec le temps. Les potions et le repos offrent des moyens de récupération.

Le commerce renouvelle son stock tous les cinq ans. Les équipements occupent neuf emplacements et ajoutent des bonus soumis à des prérequis statistiques. Les objets de valeur, matériaux et consommables peuvent être vendus ou utilisés.

## Héritage et fin de vie

Une mort par vieillissement, maladie ou combat termine la génération, conserve l'historique et peut transmettre des talents d'apprentissage. **Nouvelle vie** abandonne volontairement la génération sans compter une mort. Le menu Héritage affiche les classes, métiers, talents, découvertes et personnages terminés.

## Lancer le jeu

```bash
python3 -m http.server 8080
```

Ouvrir ensuite `http://localhost:8080`.
