## ADDED Requirements

### Requirement: Confirmation de clôture avec des preuves manquantes
Le système NE DOIT pas refuser la clôture d'une session parce qu'une preuve exigée a disparu après la validation d'un contrôle (ADR 0009) : la validation de clôture ne lit jamais les preuves. En revanche, lorsque l'utilisateur termine une session qui satisfait toutes les règles de clôture et qu'au moins un contrôle applicable est signalé « preuve manquante » (réponse conforme donnée, preuve exigée plus fournie, sans indicateur « preuve à compléter »), le système DOIT demander une confirmation par le dialogue applicatif (`DialogService`), en indiquant le nombre de contrôles concernés et combien sont bloquants. Cette vérification DOIT être faite après l'exécution des suppressions de preuves en attente. Confirmer DOIT terminer la session ; annuler DOIT la laisser en cours, sans autre modification.

#### Scenario: Clôture confirmée malgré une preuve manquante
- **GIVEN** une session conforme aux règles de clôture, dont le contrôle bloquant « Tests automatisés au vert » est coché alors que sa photo exigée a été supprimée
- **WHEN** l'utilisateur clique sur « Terminer » puis confirme
- **THEN** la session passe au statut `completed`

#### Scenario: Clôture annulée
- **WHEN** l'utilisateur clique sur « Terminer » sur la même session puis annule la confirmation
- **THEN** la session reste `in_progress` et aucune réponse n'est modifiée

#### Scenario: Aucune preuve manquante
- **WHEN** l'utilisateur termine une session conforme dont aucun contrôle n'est signalé « preuve manquante »
- **THEN** la session passe au statut `completed` sans demande de confirmation
