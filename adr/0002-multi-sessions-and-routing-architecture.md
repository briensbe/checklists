# ADR 0002 : Architecture multi-sessions et routage Angular pour checklists autonomes

## Statut
Accepté - 2026-10-10

## Contexte
L'application utilisait initialement une session singleton ('current') et aucune route Angular. Ce modèle empêchait l'exécution concurrente de plusieurs checklists (ex: un utilisateur menant de front plusieurs vérifications de déploiements ou des tests d'environnements différents) et ne permettait pas de naviguer directement vers un modèle ou un constructeur de templates.

## Décision
1. **Routage Angular explicite** : Activation de `@angular/router` avec découpage par pages distinctes (`/checklists`, `/checklists/:id`, `/templates`, `/templates/builder`, `/templates/:id/edit`).
2. **Identifiants UUID pour les sessions** : Chaque checklist créée génère un identifiant unique universel (UUID) et stocke ses réponses et son horodatage de façon isolée dans la table Dexie `sessions`.
3. **Contrôles polymorphiques** : Évolution du modèle d'item pour supporter des types de saisie configurables (case à cocher avec horodatage optionnel, choix d'évaluation libres avec libellés et couleurs sur-mesure, ou mode statut historique).

## Conséquences
- **Positives** : Possibilité d'ouvrir plusieurs checklists dans différents onglets du navigateur, navigation historique fluide (retour/suivant), flexibilité maximale pour la création de modèles sur-mesure.
- **Précautions** : Migration nécessaire de l'éventuelle session 'current' existante vers un UUID lors du premier chargement après montée de version.
