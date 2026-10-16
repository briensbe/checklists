## MODIFIED Requirements

### Requirement: Action de passage groupé à OK
Le système DOIT fournir une action permettant de passer en une seule fois tous les contrôles restants à l'état `OK`, et DOIT permettre d'annuler cette action pendant 6 secondes via une notification toast.

#### Scenario: Exécution du passage groupé
- **WHEN** l'utilisateur clique sur « Passer le reste à OK »
- **THEN** tous les points de contrôle applicables encore non renseignés prennent le statut `OK`, sans écraser les statuts déjà définis (`KO` ou `N/A`), et un toast avec action « Annuler » s'affiche pendant 6 secondes.

#### Scenario: Annulation du passage groupé
- **WHEN** l'utilisateur clique sur « Annuler » dans le toast de passage groupé avant son expiration
- **THEN** les réponses de la session sont immédiatement restaurées dans leur état exact précédant l'action via `mutate()`, et le toast disparaît.

## ADDED Requirements

### Requirement: Réinitialisation sécurisée des réponses de session
Le système DOIT soumettre la réinitialisation de toutes les réponses d'une session à une confirmation explicite via le dialogue modal applicatif (`DialogService`), sans utiliser `window.confirm()`.

#### Scenario: Confirmation de la réinitialisation
- **WHEN** l'utilisateur clique sur « Réinitialiser » dans le runner et confirme son choix dans la modale
- **THEN** toutes les réponses et observations de la session sont effacées via `mutate()` et un toast confirme la réinitialisation.

#### Scenario: Annulation de la réinitialisation
- **WHEN** l'utilisateur clique sur « Annuler » ou ferme la modale de réinitialisation
- **THEN** aucune réponse n'est modifiée et la session reste inchangée.

### Requirement: Notifications d'erreur non bloquantes dans le runner
Le système DOIT notifier les erreurs d'export (Excel, PDF, JSON) et de manipulation de preuves dans le runner à l'aide de toasts d'erreur, sans recourir à `window.alert()`.

#### Scenario: Échec d'export notifié par toast
- **WHEN** une erreur survient lors de la génération d'un export
- **THEN** un toast de ton `danger` s'affiche avec le message d'erreur explicatif, sans bloquer le runner ni l'interaction utilisateur.
