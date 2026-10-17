# Spécifications : Exécution Interactive des Checklists

## Purpose
Offrir une interface d'exécution adaptée aux types variés de points de contrôle (cases à cocher avec horodatage optionnel ou choix d'évaluation personnalisés).

## Requirements

### Requirement: Exécution interactive multi-types d'items
Le système DOIT exécuter les contrôles de checklist en adaptant dynamiquement l'interface au type configuré pour chaque item (case à cocher simple avec horodatage optionnel, choix personnalisés ou statut). Une case à cocher se coche et se décoche par un clic n'importe où sur sa ligne (capacité `quick-check`). Un choix personnalisé se sélectionne par ses boutons, et une option marquée `isBlocking` s'affiche comme « anomalie ». Le système DOIT permettre de mettre tout contrôle au statut `N/A` depuis son tiroir, quel que soit son type, et ce `N/A` DOIT compter comme une réponse pour la progression, les filtres, les portes et la clôture.

#### Scenario: Coche d'un item avec horodatage activé
- **GIVEN** un item configuré avec le type "case à cocher" et l'option d'horodatage activée
- **WHEN** l'utilisateur clique sur la ligne de l'item
- **THEN** le système enregistre l'état coché, capture la date et l'heure courante (ISO), affiche un badge horodaté (ex: "Coché le JJ/MM à HH:mm") et persiste immédiatement l'état.

#### Scenario: Décochage d'un item horodaté
- **GIVEN** un item précédemment coché avec horodatage
- **WHEN** l'utilisateur clique à nouveau sur sa ligne
- **THEN** l'état coché et l'horodatage sont réinitialisés et le badge d'horodatage disparaît.

#### Scenario: Sélection d'un choix d'évaluation personnalisé
- **GIVEN** un item configuré avec des choix personnalisés (ex: "Bleu", "Jaune")
- **WHEN** l'utilisateur clique sur l'une des options proposées
- **THEN** l'option sélectionnée est surlignée avec la couleur configurée et enregistrée dans la réponse de l'item.

#### Scenario: Re-clic pour désélectionner un choix
- **GIVEN** un choix d'évaluation actif sur un item
- **WHEN** l'utilisateur clique à nouveau sur ce même choix actif
- **THEN** le choix est désactivé et l'item repasse en attente.

#### Scenario: Option en anomalie
- **GIVEN** un item de type choix dont l'option « Non conforme » est marquée `isBlocking`
- **WHEN** l'item est affiché
- **THEN** le bouton « Non conforme » est signalé « anomalie »

#### Scenario: N/A sur un item de type choix
- **GIVEN** un item de type choix sans réponse
- **WHEN** l'utilisateur le met au statut `N/A` depuis son tiroir
- **THEN** l'item compte comme répondu dans la progression, n'apparaît plus dans le filtre « À traiter » et résout la porte s'il est bloquant
