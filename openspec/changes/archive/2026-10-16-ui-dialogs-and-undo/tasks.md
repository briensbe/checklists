## 1. Services et composants transverses (Dialogs et Toasts)

- [x] 1.1 Créer `DialogService` avec méthodes `confirm()` et `choice()`, gestion de l'état réactif et Promesses associées
- [x] 1.2 Créer le composant `DialogModalComponent` (3 fichiers séparés : `.ts`, `.html`, `.css`) avec piégeage de focus (`focus trap`), support de la touche `Échap` et restitution du focus
- [x] 1.3 Créer `ToastService` gérant une file de notifications réactives (Signals), temporisation automatique et actions personnalisées (`actionLabel`, `onAction`)
- [x] 1.4 Créer le composant `ToastContainerComponent` (3 fichiers : `.ts`, `.html`, `.css`) avec affichage empilé et styles adaptés aux thèmes clair/sombre
- [x] 1.5 Monter `DialogModalComponent` et `ToastContainerComponent` dans la racine `AppComponent` (`app.component.html`)
- [x] 1.6 Écrire les tests unitaires pour `DialogService`, `ToastService` et leurs composants associés


## 2. Conflits d'importation et bibliothèque de modèles

- [x] 2.1 Mettre à jour `src/app/services/import-conflict.ts` pour utiliser le dialogue modal à 3 choix de `DialogService` au lieu des deux `confirm()` natifs
- [x] 2.2 Remplacer le `prompt()` de `templates-list.component.ts` par une redirection vers `/checklists?new=<templateId>` ouvrant la modale existante « Nouvelle checklist »
- [x] 2.3 Remplacer le `confirm()` de suppression de modèle dans `templates-list.component.ts` par `DialogService.confirm()`
- [x] 2.4 Valider le comportement par tests unitaires

## 3. Annulation et suppression différée sur le tableau de bord

- [x] 3.1 Implémenter la suppression optimiste d'une session dans `checklists-dashboard.component.ts` avec notification toast d'annulation (6 secondes)
- [x] 3.2 Implémenter la suppression différée en base Dexie (session et preuves) à l'expiration du délai
- [x] 3.3 Implémenter la purge garantie (`flush`) des suppressions en attente lors de `ngOnDestroy` et de l'événement `visibilitychange`
- [x] 3.4 Écrire les tests unitaires vérifiant l'annulation de suppression et l'exécution du flush lors du déchargement


## 4. Runner : annulation, dialogues et retours d'état

- [x] 4.1 Implémenter l'annulation pendant 6s de l'action « Passer le reste à OK » via toast avec snapshot et restauration des réponses via `mutate()`
- [x] 4.2 Remplacer `confirm()` par `DialogService.confirm()` pour la réinitialisation des réponses d'une session
- [x] 4.3 Remplacer `confirm()` par `DialogService.confirm()` pour la réouverture d'une session terminée
- [x] 4.4 Remplacer les `alert()` d'échec d'export (Excel, PDF, JSON) et d'erreurs par des toasts d'erreur
- [x] 4.5 Écrire les tests unitaires pour l'annulation de « Passer le reste à OK » et les dialogues modaux dans le runner


## 5. Pièces jointes et constructeur de modèles

- [x] 5.1 Remplacer l'`alert()` de dépassement de limite de 50 Mo par un toast d'avertissement dans `evidence-attachment.component.ts`
- [x] 5.2 Remplacer la suppression immédiate de preuve par une suppression différée avec toast d'annulation (6s)
- [x] 5.3 Remplacer le `confirm()` de suppression de section dans `template-builder.component.ts` par une annulation par toast (6s)
- [x] 5.4 Remplacer les `alert()` de validation (nom manquant, section manquante) dans `template-builder.component.ts` par des toasts d'avertissement
- [x] 5.5 Écrire les tests unitaires pour l'annulation de suppression de preuve et de section


## 6. Socle d'accessibilité et vérifications finales

- [x] 6.1 Remplacer les en-têtes de sections pliables par des éléments `<button type="button" [attr.aria-expanded]="isOpen">` stylisés
- [x] 6.2 Ajouter des attributs `aria-label` descriptifs sur tous les boutons à icône seule
- [x] 6.3 Vérifier la visibilité de l'indicateur de focus (`:focus-visible`) et le contraste sur les deux thèmes
- [x] 6.4 Vérifier par analyse statique (`rg "\b(confirm|alert|prompt)\(" src/app -g "*.ts"`) l'absence totale de dialogues natifs du navigateur
- [x] 6.5 Valider la compilation (`pnpm build`) et l'exécution sans régression des tests Vitest (`pnpm ng test --watch=false`)

