## 1. Modèle de données et Couche de Persistance

- [ ] 1.1 Enrichir le modèle `ChecklistItemTemplate` avec les types de contrôles (`controlType`, `withTimestamp`, `customChoices`) et `ItemAnswer` avec `checked`, `checkedAt`, `selectedChoice`
- [ ] 1.2 Mettre à jour `ChecklistSession` avec un titre explicite et un identifiant UUID
- [ ] 1.3 Implémenter la migration Dexie pour convertir l'ancienne session `current` en session UUID si elle existe
- [ ] 1.4 Refactoriser `ChecklistSessionService` pour gérer les opérations CRUD multi-sessions (lister, créer, charger par id, supprimer)

## 2. Routage et Navigation Principale

- [ ] 2.1 Configurer les routes dans `app.routes.ts` (`/checklists`, `/checklists/:id`, `/templates`, `/templates/builder`, `/templates/:id/edit`)
- [ ] 2.2 Refactoriser `app.html` et `app.ts` pour intégrer la barre de navigation globale et le `<router-outlet>`
- [ ] 2.3 Créer la vue Tableau de bord des checklists (`ChecklistsDashboardComponent`) listant les sessions actives avec métriques et actions de reprise/suppression

## 3. Bibliothèque et Constructeur Visuel de Modèles

- [ ] 3.1 Créer la vue Bibliothèque des modèles (`TemplatesListComponent`) avec arborescence dépliable, import JSON et export JSON
- [ ] 3.2 Implémenter le composant constructeur visuel (`TemplateBuilderComponent`) permettant d'éditer sections, items et types de réponses
- [ ] 3.3 Intégrer dans le constructeur l'option de bascule d'horodatage pour les cases à cocher et l'éditeur de choix personnalisés (libellés et couleurs)
- [ ] 3.4 Ajouter l'action "Lancer une checklist" depuis la fiche d'un modèle pour instancier directement une session

## 4. Exécution Interactive de la Checklist

- [ ] 4.1 Adapter `ChecklistRunnerComponent` pour charger la session active depuis l'ID d'URL
- [ ] 4.2 Mettre à jour `ChecklistItemComponent` pour afficher les cases à cocher (avec tag horodaté automatique si activé) et les boutons de choix personnalisés
- [ ] 4.3 Adapter le calcul des métriques et de la barre de progression pour refléter fidèlement les items validés selon leurs types respectifs
- [ ] 4.4 Valider le fonctionnement simultané de plusieurs checklists (tests croisés dans des onglets/fenêtres séparés)
