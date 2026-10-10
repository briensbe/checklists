# Spécifications : Gestion des Modèles de Checklists

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
