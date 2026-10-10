# Spécifications : Moteur d'Exécution de Checklist

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
Le système DOIT masquer ou afficher dynamiquement les points de contrôle en fonction des paramètres de contexte de la livraison (ex: mode `patch` vs `full`).

#### Scenario: Bascule vers le mode patch
- **WHEN** le contexte passe au mode `patch`
- **THEN** les contrôles spécifiques aux patches deviennent visibles, intégrés au calcul de complétude et évaluables

#### Scenario: Bascule vers le mode complet
- **WHEN** le contexte est en mode `full`
- **THEN** les contrôles réservés au mode `patch` sont exclus de la vue et des métriques

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
