## MODIFIED Requirements

### Requirement: Persistance locale continue avec Dexie.js
Le système DOIT persister l'état courant de l'audit et l'ensemble des pièces jointes associées dans la base de données IndexedDB du navigateur via Dexie.js. L'état affiché DOIT être mis à jour immédiatement ; l'écriture en base des saisies textuelles DOIT être différée et regroupée, et seule la session modifiée DOIT être réécrite.

#### Scenario: Sauvegarde automatique lors d'une saisie
- **WHEN** l'utilisateur modifie un statut, coche un item, sélectionne un choix ou ajoute une preuve
- **THEN** la mise à jour est sauvegardée immédiatement dans IndexedDB et un indicateur visuel d'auto-sauvegarde confirme l'enregistrement

#### Scenario: Sauvegarde différée lors d'une saisie textuelle
- **WHEN** l'utilisateur tape un commentaire, un champ additionnel ou une valeur de contexte
- **THEN** l'affichage est mis à jour à chaque frappe, et une seule écriture en base est effectuée 400 ms après la dernière frappe

#### Scenario: Écriture en attente lors d'un départ de la page
- **WHEN** l'utilisateur quitte le runner (navigation interne ou masquage de l'onglet) alors qu'une écriture différée est en attente
- **THEN** l'écriture en attente est exécutée immédiatement

#### Scenario: Pas de rechargement global
- **WHEN** une session est sauvegardée
- **THEN** seule l'entrée correspondante de la liste des sessions en mémoire est remplacée, sans relecture de toutes les sessions en base

#### Scenario: Restauration de session au rechargement
- **WHEN** l'application est rechargée ou rouverte dans le navigateur
- **THEN** la session d'audit en cours est intégralement restaurée avec ses réponses et ses pièces jointes
