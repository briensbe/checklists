## Why

L'application utilise actuellement les boîtes de dialogue natives du navigateur (`alert`, `confirm`, `prompt`) à plusieurs endroits clés (suppression de sessions, réinitialisation, alertes d'erreurs, résolution de conflits d'import, validation de formulaires). Ces boîtes natives bloquent l'interface utilisateur, ne respectent pas le thème sombre de l'application, varient d'un navigateur à l'autre et ne permettent aucun recours après une action destructive. De plus, plusieurs éléments d'interface manquent de repères d'accessibilité (navigation clavier, attributs ARIA, contraste).

Il est nécessaire d'introduire des dialogues modaux intégrés au thème sombre, un système de notifications (« toasts ») empilables avec annulation différée (pendant 6 secondes), et d'établir un socle d'accessibilité solide qui servira de fondation aux futurs chantiers (`template-builder-v2` et `runner-and-dashboard-productivity`).

## What Changes

- **Suppression intégrale des dialogues natifs** : Remplacement de tous les appels `window.alert()`, `window.confirm()` et `window.prompt()` par des composants applicatifs intégrés.
- **Service et composants de dialogue maison (`DialogService`)** :
  - Boîte de confirmation accessible renvoyant une `Promise<boolean>`.
  - Dialogue modal à choix multiples (3 choix pour la résolution des conflits d'import : « Remplacer », « Importer comme copie », « Annuler »).
  - Gestion de l'accessibilité : piégeage du focus (`focus trap`), fermeture avec la touche `Échap`, restitution du focus à l'élément déclencheur.
- **Système de Toasts empilables avec annulation** :
  - Notifications temporaires en coin d'écran pour les messages d'information, de succès et d'erreur.
  - Support d'une action d'annulation (« Annuler ») pendant 6 secondes pour les actions destructives réversibles :
    - Suppression d'une session depuis le tableau de bord.
    - Suppression d'une preuve attachée à un contrôle.
    - Suppression d'une section ou d'un item dans le constructeur de modèles.
    - Action « Passer le reste à OK » dans le runner.
  - Mécanisme de suppression différée : retrait visuel immédiat, différé en base Dexie avec exécution garantie à l'expiration ou en cas de déchargement de page (`ngOnDestroy`, `visibilitychange`).
- **Confirmation préalable pour les actions non différables** :
  - Réinitialisation complète des réponses d'une session.
  - Suppression définitive d'un modèle de checklist.
  - Réouverture d'une session terminée.
- **Remplacement du `prompt()` de création** : Redirection vers le tableau de bord avec présélection du modèle (`/checklists?new=<templateId>`) ouvrant la modale existante « Nouvelle checklist ».
- **Socle d'accessibilité** :
  - En-têtes de sections accordéons convertis en éléments interactifs explicites (`<button aria-expanded>`).
  - Ajout systématique d'`aria-label` sur tous les boutons à icône seule.
  - Indicateurs de focus visibles et contrastes vérifiés en thèmes clair et sombre.

## Capabilities

### New Capabilities
- `ui-dialogs-and-undo`: Service de dialogues modaux accessibles (`confirm`, choix multiples), notifications toast empilables avec temporisation et action d'annulation (6s), gestion des suppressions différées avec vidage de file (`flush`), et socle d'accessibilité interactif (focus trap, ARIA, navigation clavier).

### Modified Capabilities
- `checklist-sessions-management`: Suppression d'une session rendue annulable pendant 6s via un toast sans confirmation préalable bloquante ; création d'une session depuis la bibliothèque via la modale du dashboard sans `prompt()`.
- `checklist-execution-runner`: Action « Passer le reste à OK » annulable pendant 6s via un toast avec restauration intégrale des réponses ; réinitialisation et réouverture basculées sur le `DialogService` modal ; erreurs d'export et d'évaluation affichées en toasts.
- `evidence-attachment`: Suppression d'une preuve rendue annulable pendant 6s via un toast ; dépassement de taille limite (50 Mo) notifié via un toast d'avertissement au lieu de `alert()`.
- `session-exchange`: Résolution des conflits d'identifiant à l'import de session réalisée via un dialogue modal unifié à 3 choix (« Remplacer », « Importer comme copie », « Annuler »).
- `template-builder`: Suppression de section ou d'item rendue annulable pendant 6s via un toast ; erreurs de validation affichées par toast ou messages en ligne au lieu de `alert()`.

## Impact

- **Code applicatif** :
  - Création de `DialogService`, `ToastService`, et de leurs composants visuels associés (`dialog-modal`, `toast-container`).
  - Mise à jour de `src/app/pages/checklists-dashboard/`, `src/app/pages/checklist-runner/`, `src/app/pages/template-builder/`, `src/app/pages/templates-list/`, `src/app/components/evidence-attachment/` et `src/app/services/import-conflict.ts`.
- **Dépendances** : Aucune dépendance externe ajoutée (conception 100% Angular native avec Signals et composants standalone).
- **Tests** : Nouveaux tests unitaires pour `DialogService`, `ToastService`, la mécanique d'annulation et le flush des actions différées. Adaptation des tests existants simulant les dialogues.
