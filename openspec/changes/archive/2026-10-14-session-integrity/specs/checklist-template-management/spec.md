## ADDED Requirements

### Requirement: Horodatage de modification des templates
Le système DOIT maintenir sur chaque template un champ `updatedAt` (date ISO) mis à jour à chaque enregistrement depuis le constructeur et à chaque import.

#### Scenario: Enregistrement depuis le constructeur
- **WHEN** l'utilisateur enregistre un template dans le constructeur
- **THEN** le champ `updatedAt` du template persisté vaut la date et l'heure de l'enregistrement

### Requirement: Normalisation des anciens formats de template
Le système DOIT convertir automatiquement, lors de la migration des données comme à l'import d'un fichier JSON, les templates utilisant l'ancien format vers le format courant, par une fonction de normalisation unique :
- `mode: 'patch'` devient `visibleIf: { fieldId: 'mode', equals: ['patch'] }` ; `mode: 'all'` ou absent ne produit aucune condition ;
- `color` est converti en `tone` : `green`/`emerald` → `success`, `red`/`rose` → `danger`, `amber`/`yellow`/`orange` → `warning`, `blue`/`sky`/`indigo` → `info`, toute autre valeur → `neutral` ;
- un `updatedAt` absent est renseigné.

#### Scenario: Import d'un ancien fichier de template
- **WHEN** l'utilisateur importe un fichier JSON exporté avant cette évolution, contenant des items `mode: 'patch'` et des choix `color: 'yellow'`
- **THEN** le template est accepté et enregistré avec `visibleIf` et `tone: 'warning'`, sans champ `mode` ni `color`

#### Scenario: Template déjà au format courant
- **WHEN** la normalisation est appliquée à un template au format courant
- **THEN** le template est inchangé

### Requirement: Palette de tons des choix d'évaluation
Le système DOIT restreindre le rendu visuel d'un choix d'évaluation à une palette fixe de tons `success`, `danger`, `warning`, `info`, `neutral`, chacun associé à des variables CSS adaptées au thème clair et au thème sombre.

#### Scenario: Rendu d'un choix en thème sombre
- **WHEN** un choix de ton `warning` est affiché en thème sombre
- **THEN** sa pastille et son état sélectionné utilisent les variables de ton du thème sombre, avec un contraste lisible
