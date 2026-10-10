## ADDED Requirements

### Requirement: Exécution interactive multi-types d'items
Le système DOIT exécuter les contrôles de checklist en adaptant dynamiquement l'interface au type configuré pour chaque item (case à cocher simple avec horodatage optionnel ou choix personnalisés).

#### Scenario: Coche d'un item avec horodatage activé
- **GIVEN** un item configuré avec le type "case à cocher" et l'option d'horodatage activée
- **WHEN** l'utilisateur coche la case de l'item
- **THEN** le système enregistre l'état coché, capture la date et l'heure courante (ISO), affiche un badge horodaté (ex: "Coché le JJ/MM à HH:mm") et persiste immédiatement l'état.

#### Scenario: Décochage d'un item horodaté
- **GIVEN** un item précédemment coché avec horodatage
- **WHEN** l'utilisateur décoche la case
- **THEN** l'état coché et l'horodatage sont réinitialisés et le badge d'horodatage disparaît.

#### Scenario: Sélection d'un choix d'évaluation personnalisé
- **GIVEN** un item configuré avec des choix personnalisés (ex: "Bleu", "Jaune")
- **WHEN** l'utilisateur clique sur l'une des options proposées
- **THEN** l'option sélectionnée est surlignée avec la couleur configurée et enregistrée dans la réponse de l'item.

#### Scenario: Re-clic pour désélectionner un choix
- **GIVEN** un choix d'évaluation actif sur un item
- **WHEN** l'utilisateur clique à nouveau sur ce même choix actif
- **THEN** le choix est désactivé et l'item repasse en attente.
