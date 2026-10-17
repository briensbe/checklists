# ADR 0008 : Icônes Lucide via le paquet officiel `@lucide/angular`

## Statut
Accepté - 2026-10-17

Supersedes: aucun

## Contexte
Les icônes de l'application sont des SVG Heroicons recopiés à la main dans les templates HTML (environ 70 occurrences). Chaque copie fige un tracé, une épaisseur et une taille. Les doublons divergent, et aucune icône n'est nommée : on ne peut pas choisir une icône d'après une donnée, ce qu'exigeront les icônes d'étape (`section.icon`) de la vue chemin et la palette d'icônes du builder.

La vision UX (`docs/design/checklist-ux.md`, section « Écarts retenus ») retient Lucide, plutôt que Tabler utilisé par les maquettes. Le change `quick-check-and-drawer` introduit de nombreuses icônes nouvelles (trombone, note, photo, fichier, lien, N/A, preuve en attente, aide clavier) : c'est le moment d'adopter la bibliothèque.

Deux paquets Angular existent pour Lucide (vérifié sur le registre npm le 17/10/2026) :
- `lucide-angular` (1.0.0) est **déprécié** (« Please use @lucide/angular instead ») et déclare `@angular/core` 13.x à 21.x en dépendance pair : il n'est pas compatible avec Angular 22.
- `@lucide/angular` (1.59.0) est le paquet officiel. Il déclare `@angular/core` et `@angular/common` `>=17.0.0`, n'a que `tslib` comme dépendance, et se présente comme une implémentation autonome (standalone), à base de signals et sans zone. Cela correspond à l'application : Angular 22, composants autonomes, sans `zone.js`.

## Décision
1. **Lucide est la bibliothèque d'icônes de l'application**, via le paquet officiel `@lucide/angular` (plage `^1`), installé avec `pnpm add @lucide/angular`. L'ancien `lucide-angular` est proscrit.
2. **Import statique, icône par icône** : chaque composant importe dans ses `imports` les composants d'icônes qu'il utilise (par exemple `LucidePaperclip`, rendu par `<svg lucidePaperclip></svg>`). Seules les icônes utilisées entrent dans le bundle.
3. **Icônes choisies d'après une donnée** (icône d'étape, palette du builder) : elles passeront par `LucideDynamicIcon` (`<svg [lucideIcon]="nom">`), avec une liste fermée d'icônes enregistrées par `provideLucideIcons(...)`. On n'enregistre jamais toute la bibliothèque.
4. **Accessibilité** : on garde le comportement par défaut du paquet, qui masque les icônes aux technologies d'assistance (`aria-hidden="true"`). Un bouton qui n'a qu'une icône porte toujours un `aria-label`. Le `title` d'une icône n'est utilisé que pour une icône porteuse de sens hors d'un bouton.
5. **Couleur et taille** : la couleur suit `currentColor`, donc les variables CSS des thèmes clair et sombre. La taille est réglée par l'entrée `size` ou par le CSS du composant, jamais par une couleur ou une dimension codée en dur dans le SVG.
6. **Migration progressive** : un composant modifié par un change passe entièrement à Lucide, sans mélange d'icônes Heroicons et Lucide dans un même composant. Les composants non modifiés gardent leurs SVG jusqu'à leur prochaine évolution.

Alternatives écartées :
- **`lucide-angular`** : déprécié et limité à Angular 21.
- **Garder des SVG recopiés, en adoptant les tracés de Lucide** : aucune icône par nom, des copies divergentes, et des mises à jour manuelles.
- **Tabler Icons (maquettes)** : la vision retient Lucide, déjà évoqué par la spec du thème sombre (icônes soleil et lune).
- **Police d'icônes ou sprite SVG global** : chargement de toute la bibliothèque, accessibilité et thème plus difficiles à maîtriser qu'avec des composants.
- **Enregistrer toutes les icônes pour les utiliser par nom** : le bundle contiendrait toute la bibliothèque.

## Conséquences
- **Positives** :
  - des icônes cohérentes (tracé, épaisseur) dans les composants migrés ;
  - un bundle limité aux icônes utilisées ;
  - des icônes nommées, prêtes pour les icônes d'étape et la palette du builder ;
  - une dépendance légère (seulement `tslib`), alignée sur l'architecture autonome, à signals et sans zone de l'application.
- **Négatives / Précautions** :
  - une dépendance de plus, publiée très fréquemment : la version est figée par `pnpm-lock.yaml` et mise à jour volontairement ;
  - pendant la migration progressive, deux styles d'icônes cohabitent d'un écran à l'autre ;
  - les noms d'icônes changent parfois entre versions de Lucide : toute icône utilisée par nom (point 3) doit figurer dans la liste enregistrée, et une donnée qui référence un nom inconnu doit retomber sur une icône par défaut.
