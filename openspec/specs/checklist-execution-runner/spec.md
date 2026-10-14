# Spécifications : Moteur d'Exécution de Checklist

## Purpose
Permettre l'évaluation des points de contrôle d'une session (OK / KO / N/A), leur conditionnement par le contexte, les actions groupées et le filtrage.

## Requirements

### Requirement: Évaluation interactive d'un contrôle
Le système DOIT permettre d'affecter un statut d'évaluation parmi `OK`, `KO` ou `N/A` à chaque point de contrôle applicable.

#### Scenario: Sélection d'un statut conforme
- **WHEN** l'utilisateur clique sur le statut `OK` pour un contrôle donné
- **THEN** le contrôle est marqué comme conforme, les compteurs de progression sont actualisés et l'observation demeure facultative

#### Scenario: Sélection d'un statut non conforme
- **WHEN** l'utilisateur clique sur le statut `KO`
- **THEN** le contrôle est marqué en anomalie, le champ de justification devient obligatoire et visuellement mis en évidence

#### Scenario: Déselection d'un statut
- **WHEN** l'utilisateur clique à nouveau sur le statut déjà sélectionné
- **THEN** le statut repasse à l'état non renseigné / à traiter

### Requirement: Conditionnement contextuel des contrôles
Le système DOIT masquer ou afficher dynamiquement les points de contrôle en fonction des valeurs de contexte de la session. Un item peut porter une condition `visibleIf: { fieldId, equals[] }` : il est applicable si et seulement si la valeur du champ de contexte `fieldId` figure dans `equals`. Un item sans condition est toujours applicable. Les items non applicables sont exclus de la vue, des métriques et de la validation de clôture ; leurs réponses éventuelles sont conservées.

#### Scenario: Bascule vers le mode patch
- **WHEN** un item porte `visibleIf: { fieldId: 'mode', equals: ['patch'] }` et que le contexte `mode` passe à `patch`
- **THEN** l'item est visible, intégré au calcul de complétude et évaluable

#### Scenario: Bascule vers le mode complet
- **WHEN** pour ce même item, le contexte `mode` vaut `full` ou est vide
- **THEN** l'item est exclu de la vue et des métriques

#### Scenario: Condition à valeurs multiples
- **WHEN** un item porte `visibleIf: { fieldId: 'type', equals: ['majeure', 'mineure'] }` et que le contexte `type` vaut `mineure`
- **THEN** l'item est applicable

#### Scenario: Réponse conservée sur un item masqué
- **WHEN** l'utilisateur répond à un item puis modifie le contexte de sorte qu'il devienne non applicable, puis rétablit le contexte initial
- **THEN** l'item réapparaît avec sa réponse précédente

### Requirement: Action de passage groupé à OK
Le système DOIT fournir une action permettant de passer en une seule fois tous les contrôles restants à l'état `OK`.

#### Scenario: Exécution du passage groupé
- **WHEN** l'utilisateur clique sur "Passer le reste à OK"
- **THEN** tous les points de contrôle applicables encore non renseignés prennent le statut `OK`, sans écraser les statuts déjà définis (`KO` ou `N/A`)

### Requirement: Filtrage et navigation rapide
Le système DOIT permettre de filtrer l'affichage des contrôles selon leur état (`Tous`, `À traiter`, `KO uniquement`) et d'ouvrir/fermer toutes les sections.

#### Scenario: Filtrage des anomalies
- **WHEN** l'utilisateur sélectionne le filtre "KO uniquement"
- **THEN** seules les sections contenant des contrôles KO et les contrôles KO eux-mêmes sont affichés
