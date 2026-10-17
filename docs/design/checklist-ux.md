# Conception UX — Checklists visuelles

> Document de référence issu de la phase d'exploration (octobre 2026).
> Il consigne les **décisions prises** pour l'exécution et la création des checklists.
> Les maquettes interactives correspondantes sont dans [`mockups/`](./mockups/) : ouvrir les fichiers HTML dans un navigateur.

## 1. Intention

Rendre le remplissage de checklists de contrôle plus visuel et plus agréable, sans perdre en rigueur. L'idée de départ vient des checklists d'aviation : ne rien oublier avant de « décoller ».

Deux échelles d'usage :

| Échelle | Exemple | Vue principale |
|---|---|---|
| **Petit périmètre** | un process (mise en prod, onboarding, audit ponctuel) | chemin à étapes |
| **Grand périmètre** | un projet complet | carte en régions (phases) + zoom |

L'application (Angular) comporte deux grands modes :
- **Template builder** : création et édition de la structure d'une checklist.
- **Exécution** : remplissage d'une instance de checklist.

## 2. Principes directeurs

1. **Le fun vient du feedback, pas des gadgets.** Micro-animations au cochage, récompense au passage d'une porte, célébration à la fin. Prévoir un mode « discret » pour les contextes pro.
2. **Rendre l'importance visible, pas seulement la quantité.** Un 100 % coché peut cacher un oubli grave : la criticité des items est au cœur du modèle.
3. **N'afficher de l'interface que là où l'on peut agir.** Cases, badges rouges et boutons uniquement sur ce qui est actionnable ; du texte simple ailleurs.
4. **La coche est un geste unique et instantané.** Tout le reste (note, photo, fichier, N/A) est à un niveau secondaire.
5. **On édite une liste, on voit un graphe.** La saisie se fait en liste (rapide, clavier) ; le graphe sert de vérification visuelle immédiate.

## 3. Concepts du domaine

### 3.1 Criticité des items

| Valeur | Effet |
|---|---|
| `blocking` (bloquant) | Verrouille la porte de l'étape suivante tant qu'il n'est pas résolu |
| `important` | Ne bloque pas, mais mis en avant |
| `optional` (optionnel) | Ne bloque pas ; valeur par défaut d'un nouvel item |

Un nouvel item est **optionnel par défaut** : rendre un item bloquant doit être un choix conscient, sinon tout finit bloquant.

### 3.2 États d'un item (exécution)

| État | Signification | Compte comme résolu pour la porte |
|---|---|---|
| `todo` | à faire | non |
| `done` | fait | oui |
| `na` | non applicable — **justification obligatoire** | oui |
| `done_pending_evidence` | fait, preuve à compléter (uniquement si non bloquant) | n/a (jamais sur un bloquant) |
| `at_risk` | (optionnel) signalé à risque | non |

### 3.3 Portes (gates)

- Une étape est **débloquée** quand toutes ses dépendances sont débloquées **et** ont tous leurs items bloquants résolus.
- **Seuls les bloquants verrouillent.** Les optionnels restent cochables plus tard.
- L'état « débloqué » ne se stocke pas : **il se calcule**.
- Porte `hard` (stricte) ou `soft` (franchissable avec justification tracée dans l'historique).
- Le **passage d'une porte** est le moment de récompense (animation du nœud qui s'ouvre). Les confettis sont réservés à la fin du process.

### 3.4 Quatre états visuels d'une étape

1. **Verrouillée** : cadenas, trait d'accès en pointillés gris.
2. **Ouverte** : anneau de progression qui se remplit.
3. **Franchie avec optionnels restants** : porte ouverte, anneau incomplet.
4. **Terminée** : coche, trait plein vert.

### 3.5 Branches parallèles et jonctions

- Le graphe est un **DAG** défini par `dependsOn` sur chaque étape. Linéaire et parallèle sont gérés par le même modèle.
- **Bifurcation implicite** : deux étapes avec la même dépendance s'ouvrent ensemble.
- **Jonction** : étape à plusieurs dépendances. Badge `n/m` indiquant combien de branches sont prêtes.
- `joinMode: 'all' | 'any'` (par défaut `all`).
- Quand une branche finit avant l'autre, le message n'est pas « porte ouverte » mais « attend encore une autre branche ».
- Extension prévue : mettre en évidence la **branche critique** (celle qui retarde la jonction).

## 4. Vues d'exécution

### 4.1 Vue anneaux (vue d'ensemble simple)
Un anneau de progression par catégorie, score global, nombre de bloquants restants. Maquette : `01-anneaux-categories.html`.

Autres vues d'ensemble envisagées (mêmes données, choix de l'utilisateur) : sunburst, heatmap catégories × jalons, radar de maturité.

### 4.2 Vue chemin (petit périmètre)
- Nœuds circulaires reliés par des courbes de Bézier ; panneau de l'étape sélectionnée en dessous.
- Le tracé encode la progression : plein et coloré pour le parcouru, pointillé gris pour le reste.
- Au-delà de 7-8 étapes, passer à la vue carte en régions.
- Mobile : chemin vertical en zigzag, panneau en bottom sheet.
- Maquettes : `02-chemin-lineaire.html`, `03-chemin-branches.html`.

### 4.3 Étape verrouillée : ce qu'on affiche
1. **D'abord le « pourquoi »** : la liste de ses prérequis avec leur état (`prête` / `bloquants en cours` / `pas encore ouverte`).
2. **Puis les items en simple liste à puces, texte discret**, sans case, sans badge de criticité.

> Décision explicite : pas de cases en pointillés ni de pastilles sur une étape non saisissable (trop de surcharge visuelle). Une simple liste suffit.

### 4.4 Vue grand périmètre : carte en régions
- **Deux niveaux de lecture** :
  - **Carte du projet** : 3 indicateurs (avancement, phase(s) en cours, bloquants restants), une tuile par phase (anneau, nom, rangée de points = ses étapes, statut).
  - **Zoom sur une phase** : fil d'Ariane, mini-chemin de ses étapes, panneau de l'étape.
- Les portes fonctionnent aux deux échelles avec la même mécanique.
- Les phases peuvent être **parallèles** (ex. Réalisation Front ∥ Réalisation Back → Recette), et les étapes d'une phase aussi (ex. Socle → API ∥ Migration → Intégration).
- Bloc **« Laissés en route »** : items optionnels non faits dans les phases déjà franchies, cliquables pour y retourner. C'est l'élément à plus forte valeur sur un gros projet.
- Points des tuiles : vert = étape franchie, violet = ouverte, vide = verrouillée.
- Maquette : `04-grand-perimetre-branches.html`.

## 5. Remplissage d'un item

### 5.1 Comportement retenu (par défaut)
Maquette : `07-coche-rapide-ajouts.html`.

- **Toute la ligne est la case à cocher.** Un clic/tap = coché, avec une petite animation. Aucun panneau, aucune question.
- **Un seul point d'entrée secondaire** : trombone en bout de ligne, invisible au repos sur desktop (visible au survol), discret en permanence sur mobile (`@media (hover: none)`).
- Le trombone ouvre un **tiroir sous la ligne** : `Note`, `Photo`, `Fichier`, `Non applicable`.
- **Suggestion douce** : juste après avoir coché un item sans pièce jointe, le trombone s'allume ~2 s puis s'efface.
- **Compteurs** sur la ligne une fois le tiroir fermé (notes, photos, fichiers).
- **Clavier** : ↑/↓ naviguer, Espace cocher, A ouvrir les ajouts, Entrée enregistrer une note, Échap annuler.
- Piste mobile : swipe gauche pour révéler Note / Photo / N/A.

### 5.2 Preuve obligatoire (option du template, cas particulier)
Maquette : `06-preuve-obligatoire.html`.

Réservée aux quelques items qui l'exigent vraiment (ex. rapport de tests d'un bloquant).

- La preuve est demandée **au moment du cochage**, inline (pas de modale), avec une consigne rédigée dans le template.
- Types : `photo`, `comment`, `link`, (`file`).
- **Bloquant** : impossible de valider sans preuve.
- **Important / optionnel** : bouton « Plus tard » → état `done_pending_evidence` (orange), remonté dans le pied d'étape et dans « Laissés en route ».
- Une fois fait : la preuve remplace l'icône (miniature, extrait, lien) + qui/quand.

### 5.3 Non applicable
Toujours **justifié** (texte obligatoire), compte comme résolu pour la porte, tracé (qui/quand). Accessible via le niveau secondaire, jamais en concurrence avec la coche.

## 6. Template builder

Maquette : `05-template-builder.html`.

- **Éditeur en liste** (une carte par étape) + **aperçu du graphe en direct** au-dessus.
- Dépendances en langage naturel : **« Après : API, Migration »** sous forme de puces cliquables.
- **Anti-cycle à la saisie** : les puces qui créeraient une boucle sont grisées et désactivées.
- Bandeau de validation : nombre de départs, de fins, étapes sans item, absence de cycle.
- Saisie clavier : Entrée crée l'item suivant ; clic sur la criticité pour la faire tourner (bloquant → important → optionnel) ; icône de preuve qui tourne (aucune → commentaire → photo).
- Aperçu : icône drapeau (départ), fusion (jonction), drapeau à damier (fin) ; sous chaque nœud « n items · m bloq. ».
- **Même éditeur aux deux niveaux** (phases et étapes) : un seul composant.

Évolutions prévues :
- Collage d'une liste à puces → un item par ligne.
- Bibliothèque de blocs réutilisables (ex. étape « RGPD »).
- Bouton « Tester » : exécution à blanc du template.
- **Versionnage** : une exécution reste sur la version du template avec laquelle elle a démarré.
- Flag `canAnticipate` sur un item : cochable par anticipation dans une étape encore verrouillée (marqué comme tel).

## 7. Modèle de données

```ts
// ---------- Template ----------
type Criticality = 'blocking' | 'important' | 'optional';
type EvidenceType = 'none' | 'comment' | 'photo' | 'link' | 'file';

interface ChecklistTemplate {
  id: string;
  name: string;
  version: number;
  phases: PhaseTemplate[];        // un seul élément pour un petit périmètre
}

interface PhaseTemplate {
  id: string;
  label: string;
  icon: string;
  dependsOn: string[];            // ids de phases ; vide = départ
  joinMode?: 'all' | 'any';       // défaut 'all'
  steps: StepTemplate[];
}

interface StepTemplate {
  id: string;
  label: string;
  icon?: string;
  dependsOn: string[];            // ids d'étapes de la même phase
  joinMode?: 'all' | 'any';
  gate: 'hard' | 'soft';
  items: ItemTemplate[];
}

interface ItemTemplate {
  id: string;
  label: string;
  criticality: Criticality;       // défaut 'optional'
  weight?: number;
  evidenceRequired?: EvidenceType; // défaut 'none' (ajouts libres toujours possibles)
  evidenceHint?: string;           // consigne affichée au moment de la preuve
  canAnticipate?: boolean;
}

// ---------- Exécution ----------
type ItemStatus = 'todo' | 'done' | 'na' | 'done_pending_evidence' | 'at_risk';

interface ChecklistRun {
  id: string;
  templateId: string;
  templateVersion: number;        // figée au démarrage
  items: Record<string, ItemState>; // clé = item id
}

interface ItemState {
  status: ItemStatus;
  naJustification?: string;
  attachments: Attachment[];      // notes, photos, fichiers, liens — plusieurs possibles
  doneBy?: string;
  doneAt?: string;
  history: ItemEvent[];           // on historise, on n'écrase pas
}

interface Attachment {
  id: string;
  type: 'comment' | 'photo' | 'file' | 'link';
  value: string;                  // texte, URL ou référence de stockage
  fileName?: string;
  size?: number;
  createdBy: string;
  createdAt: string;
}

interface ItemEvent {
  at: string;
  by: string;
  kind: 'checked' | 'unchecked' | 'na' | 'attachment_added' | 'attachment_removed' | 'gate_forced';
  detail?: string;
}
```

## 8. Règles de calcul (à implémenter en `computed`)

```ts
// étape : tous les bloquants résolus ?
blockingResolved(step) = step.items
  .filter(i => i.criticality === 'blocking')
  .every(i => ['done', 'na'].includes(state[i.id].status));

// étape débloquée ?
unlocked(step) = phaseUnlocked(step.phase) &&
  (joinMode === 'any'
     ? step.dependsOn.length === 0 || step.dependsOn.some(d => unlocked(d) && blockingResolved(d))
     : step.dependsOn.every(d => unlocked(d) && blockingResolved(d)));

// phase : mêmes règles au niveau supérieur ; une phase est "franchie" quand toutes ses étapes ont leurs bloquants résolus.

// "Laissés en route" : items non bloquants, non faits (ou preuve en attente), dans des phases franchies.
```

## 9. Layout du graphe

- **Colonne** d'un nœud = longueur du plus long chemin depuis un départ.
- Nœuds d'une même colonne répartis verticalement autour du centre.
- Abscisse = `(colonne + 0.5) / nbColonnes × largeur`.
- Graphes touffus : utiliser `dagre` pour calculer les positions, garder notre propre rendu SVG.

> ⚠️ **Leçon apprise (bug de maquette)** : les nœuds et les liens doivent partager **exactement le même système de coordonnées**. Ne jamais mélanger des pourcentages CSS pour les nœuds avec un `viewBox` SVG pour les liens.
> Deux options sûres :
> 1. **Tout en SVG** (nœuds + liens dans le même `<svg>`), positions en pixels — le plus robuste, zoom/pan triviaux.
> 2. **HTML + SVG superposés** : positions calculées une seule fois en pixels à partir de la largeur mesurée du conteneur, recalculées via `ResizeObserver`.

## 10. Implémentation Angular — orientations

- **Signals** : un `signal` pour l'état des items ; des `computed` pour la progression, les étapes/phases débloquées, l'étape courante, les jonctions, « Laissés en route ».
- **Un seul composant de graphe** réutilisé aux deux niveaux (phases et étapes) et dans l'aperçu du template builder.
- Rendu SVG fait main ; animations via transitions CSS ou `@angular/animations`.
- Vues de synthèse (sunburst, radar, heatmap) : `ngx-echarts`.
- Célébration finale : `canvas-confetti`.
- **Photos** : `<input type="file" accept="image/*" capture="environment">` ; compression côté client avant envoi (`browser-image-compression` ou canvas).
- **Hors ligne** (usage terrain) : pièces jointes en IndexedDB, synchronisation ultérieure.
- **Validation du graphe dans le builder** : tri topologique (échec = cycle), au moins un départ et une fin.

## 11. Pistes non encore explorées

- Dimension collective : avatars par étape/phase, vue Kanban, assignation par branche.
- Statistiques sur les exécutions répétées : items le plus souvent oubliés (heatmap sous les tuiles) pour améliorer le template.
- Badges / séries pour les checklists récurrentes.
- Mode « discret » sans animations.
