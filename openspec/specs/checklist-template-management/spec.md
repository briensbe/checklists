# Spécifications : Gestion des Modèles de Checklists

## Purpose
Définir, charger, normaliser et sélectionner les modèles de checklists, ainsi que les conventions de format partagées (horodatage, tons des choix).

## Requirements

### Requirement: Définition et chargement de modèles JSON
Le système DOIT permettre le chargement et la validation de modèles de checklists conformes à un schéma JSON standardisé.

#### Scenario: Chargement d'un modèle valide
- **WHEN** un utilisateur sélectionne ou importe un fichier de modèle JSON valide
- **THEN** le système charge le modèle, valide ses métadonnées, ses champs de contexte et son arborescence de sections/contrôles, puis rend la checklist disponible à l'exécution

#### Scenario: Échec de validation du modèle
- **WHEN** un utilisateur tente de charger un fichier JSON ne respectant pas la structure attendue
- **THEN** le système rejette le fichier et affiche un message d'erreur clair indiquant l'anomalie de schéma

### Requirement: Sélection du modèle actif
Le système DOIT permettre à l'utilisateur de sélectionner le modèle de checklist à exécuter parmi les modèles disponibles (un seul modèle actif à la fois).

#### Scenario: Choix du modèle au démarrage
- **WHEN** l'utilisateur démarre une session d'audit
- **THEN** l'interface présente la liste des modèles disponibles (ex: Audit Livraison, Déploiement Cloud) et initialise la session avec le modèle sélectionné

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
