## MODIFIED Requirements

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

## ADDED Requirements

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
