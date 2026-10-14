## MODIFIED Requirements

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
