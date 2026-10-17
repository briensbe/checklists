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
- `requireNaReason` est retiré des items ;
- un `updatedAt` absent est renseigné.

Les champs d'enchaînement et de criticité (`dependsOn`, `joinMode`, `gate`, `criticality`, `evidenceRequired`, `evidenceHint`, `completionPolicy`) DOIVENT être conservés tels quels par la normalisation.

#### Scenario: Import d'un ancien fichier de template
- **WHEN** l'utilisateur importe un fichier JSON exporté avant cette évolution, contenant des items `mode: 'patch'`, des choix `color: 'yellow'` et des items `requireNaReason: true`
- **THEN** le template est accepté et enregistré avec `visibleIf` et `tone: 'warning'`, sans champ `mode`, `color` ni `requireNaReason`

#### Scenario: Template déjà au format courant
- **WHEN** la normalisation est appliquée à un template au format courant
- **THEN** le template est inchangé

#### Scenario: Conservation des champs d'enchaînement
- **WHEN** la normalisation est appliquée à un template dont les sections déclarent des dépendances et dont les items déclarent une criticité
- **THEN** ces champs sont conservés à l'identique

### Requirement: Palette de tons des choix d'évaluation
Le système DOIT restreindre le rendu visuel d'un choix d'évaluation à une palette fixe de tons `success`, `danger`, `warning`, `info`, `neutral`, chacun associé à des variables CSS adaptées au thème clair et au thème sombre.

#### Scenario: Rendu d'un choix en thème sombre
- **WHEN** un choix de ton `warning` est affiché en thème sombre
- **THEN** sa pastille et son état sélectionné utilisent les variables de ton du thème sombre, avec un contraste lisible

### Requirement: Validation des champs d'enchaînement et de criticité
Le système DOIT rejeter, à l'import d'un template comme à l'import d'une session (copie figée), tout template dont :
- une section dépend d'elle-même ou d'une section absente du template ;
- les dépendances entre sections forment une boucle ;
- les identifiants de sections ne sont pas uniques ;
- `joinMode`, `gate`, `criticality`, `evidenceRequired` ou `completionPolicy` portent une valeur hors de leurs valeurs autorisées.

Le message d'erreur DOIT nommer la section ou l'item concerné.

#### Scenario: Import d'un template avec une boucle
- **WHEN** l'utilisateur importe un template dont la section « A » dépend de « B » et « B » de « A »
- **THEN** l'import est refusé avec un message qui nomme les sections de la boucle

#### Scenario: Dépendance vers une section absente
- **WHEN** l'utilisateur importe un template dont une section dépend d'un identifiant inconnu
- **THEN** l'import est refusé avec un message qui nomme la section et l'identifiant inconnu

#### Scenario: Valeur de criticité inconnue
- **WHEN** l'utilisateur importe un template dont un item déclare `criticality: 'critique'`
- **THEN** l'import est refusé avec un message qui nomme l'item

### Requirement: Modèles d'exemple fournis
Le système DOIT ajouter à la bibliothèque les modèles d'exemple livrés avec l'application, dont un modèle « Mise en production » à étapes, branches parallèles et jonction. Chaque modèle d'exemple DOIT être ajouté une seule fois : un modèle d'exemple supprimé par l'utilisateur NE DOIT PAS réapparaître, et un modèle déjà présent (même identifiant) NE DOIT PAS être écrasé.

#### Scenario: Première utilisation
- **WHEN** l'application démarre avec une bibliothèque vide
- **THEN** tous les modèles d'exemple sont ajoutés à la bibliothèque

#### Scenario: Bibliothèque existante
- **WHEN** l'application démarre avec une bibliothèque qui contient déjà des modèles, mais pas le modèle « Mise en production »
- **THEN** le modèle « Mise en production » est ajouté, et le modèle d'audit de livraison n'est pas ajouté à nouveau s'il a été supprimé

#### Scenario: Modèle d'exemple supprimé
- **WHEN** l'utilisateur supprime le modèle « Mise en production » puis relance l'application
- **THEN** le modèle n'est pas ajouté à nouveau
