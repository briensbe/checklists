## ADDED Requirements

### Requirement: Saisie réservée aux étapes débloquées
Le système NE DOIT changer l'état de la réponse d'un contrôle (statut `OK`, `KO` ou `N/A`, coche, choix, réponse conforme donnée avec sa preuve ou avec « preuve à compléter ») que si la section de ce contrôle est débloquée. Cette garde DOIT s'appliquer au niveau du service, quelle que soit la vue du runner, comme la garde de lecture seule d'une session terminée. Elle NE DOIT pas s'appliquer :
- aux saisies de texte déjà en cours (note, champ additionnel), pour ne jamais perdre une frappe ;
- à l'annulation d'une action (restauration des réponses après « Passer le reste à OK », retrait de l'événement de suppression d'une preuve), à la réinitialisation confirmée de la session et à l'application d'une nouvelle version du modèle.

Les réponses déjà données dans une étape qui se verrouille DOIVENT être conservées. Un modèle sans dépendance n'est pas concerné, puisque toutes ses sections sont débloquées en permanence.

#### Scenario: Réponse refusée dans une étape verrouillée
- **GIVEN** l'étape « Tests » est verrouillée
- **WHEN** une opération de coche est invoquée sur le contrôle « Recette métier validée », par exemple depuis un raccourci clavier
- **THEN** la réponse du contrôle n'est pas modifiée et aucun événement d'historique n'est ajouté

#### Scenario: Annulation d'un passage groupé après un reverrouillage
- **GIVEN** l'utilisateur a utilisé « Passer le reste à OK », ce qui a débloqué l'étape « Tests »
- **WHEN** il clique sur « Annuler » dans le toast
- **THEN** les réponses sont restaurées exactement comme avant l'action, y compris dans les étapes qui redeviennent verrouillées

#### Scenario: Modèle sans dépendance
- **WHEN** l'utilisateur coche un contrôle d'un modèle sans dépendance dont des bloquants ne sont pas résolus
- **THEN** le contrôle est coché
