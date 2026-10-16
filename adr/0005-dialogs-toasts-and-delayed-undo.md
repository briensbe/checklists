# ADR 0005 : Dialogues modaux, toasts et annulation par persistance différée

## Statut
Accepté - 2026-10-16

Supersedes: aucun

## Contexte
L'application est une SPA locale sans backend (ADR 0001, ADR 0002). Plusieurs interactions destructives ou informatives (suppression de session ou de preuve, réinitialisation, confirmation d'import, alertes de validation) utilisaient les fonctions natives du navigateur (`window.alert`, `window.confirm`, `window.prompt`). Ces fonctions bloquent l'interface, ignorent le thème sombre, varient selon l'OS/navigateur, ne permettent pas de choix complexes (ex: 3 options) et rendent les suppressions immédiatement irréversibles sans droit à l'erreur.

Les chantiers futurs (`template-builder-v2` et `runner-and-dashboard-productivity`) ont besoin d'un socle d'interaction cohérent, accessible et testable pour les confirmations, les retours d'état et l'annulation d'actions destructives.

## Décision
1. **Élimination complète des fenêtres natives** :
   - Proscription totale de `alert()`, `confirm()` et `prompt()` dans le code applicatif.
   - Utilisation d'un service de dialogue modal interne (`DialogService`) basé sur des Promesses (`confirm(): Promise<boolean>`, `choice(): Promise<string | null>`), autonome et sans dépendance externe (pas de bibliothèque tierce).
   - Prise en charge stricte de l'accessibilité : piégeage du focus clavier (`focus trap`), fermeture par la touche `Échap`, restitution du focus à l'élément déclencheur.

2. **Système de Toasts empilables** :
   - Service réactif (`ToastService`) basé sur les Signals Angular pilotant un conteneur d'affichage (`ToastContainerComponent`) pour les notifications informatives, de succès, d'avertissement et d'erreur.

3. **Modèle d'annulation par persistance différée (Undo 6s)** :
   - Pour les actions destructives réversibles (suppression de session, de preuve, d'élément de template, ou action groupée « Passer le reste à OK »), l'application applique un retour visuel optimiste immédiat (retrait du signal de vue), tout en différant l'écriture réelle en base Dexie pendant une fenêtre d'exposition de 6 secondes via un toast avec bouton « Annuler ».
   - Si l'utilisateur clique sur « Annuler », l'état antérieur en mémoire est restauré sans écriture disque.
   - Si le délai expire, l'écriture destructive définitive est exécutée en base.
   - **Garantie de vidage (Flush)** : Pour éviter toute incohérence ou perte d'action lors d'un changement de route ou d'une fermeture d'onglet pendant le compte à rebours, toutes les suppressions en attente sont immédiatement exécutées lors de la destruction du composant (`ngOnDestroy`) et lors du changement de visibilité de l'onglet (`visibilitychange` / `beforeunload`).

Alternatives écartées :
- **Bibliothèque tierce de composants (Angular Material, PrimeNG)** : ajout de dizaines de dépendances lourdes pour un besoin ciblé, rompant la légèreté du projet.
- **Confirmation systématique préalable par boîte modale pour toutes les actions** : alourdit considérablement l'usage quotidien ; le paradigme « Supprimer + Annuler (Undo) » offre une meilleure fluidité pour les actions fréquentes.
- **Annulation par corbeille persistée en base (soft-delete)** : nécessiterait une migration de schéma Dexie (v4), un marquage `deletedAt`, et une gestion du cycle de vie de purge en base ; la persistance différée en mémoire avec flush résout le besoin sans altérer le schéma.

## Conséquences
- **Positives** : expérience utilisateur fluide et homogène en thèmes clair et sombre ; actions destructives sécurisées avec 6 secondes de rétractation ; zéro nouvelle dépendance npm ; architecture réactive purement découplée et aisément mockable dans les tests Vitest.
- **Négatives / Précautions** : le développeur doit systématiquement enregistrer les suppressions différées dans le gestionnaire de flush pour garantir la persistance lors de la sortie de vue ; les tests unitaires manipulant des timers doivent utiliser des durées adaptées ou des timers simulés (`vi.useFakeTimers()`).
