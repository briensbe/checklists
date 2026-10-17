# Spécifications : Copie figée du modèle dans la session

## Purpose
Rendre chaque session autonome grâce à une copie figée de son modèle, et permettre l'application manuelle d'une nouvelle version du modèle.

## Requirements

### Requirement: Copie figée du template dans la session
Le système DOIT copier, à la création d'une session, la définition complète du template (métadonnées, schéma de contexte, sections et items) dans la session. L'exécution, les métriques, la validation et l'affichage d'une session DOIVENT reposer exclusivement sur cette copie.

#### Scenario: Création avec copie figée
- **WHEN** l'utilisateur crée une session depuis un template
- **THEN** la session persistée contient une copie complète du template, ainsi que l'identifiant du template d'origine

#### Scenario: Modification ultérieure du template
- **WHEN** l'utilisateur modifie et enregistre le template d'origine après la création de la session
- **THEN** la structure affichée et les métriques de la session restent inchangées tant que la mise à jour n'est pas appliquée

#### Scenario: Suppression du template d'origine
- **WHEN** l'utilisateur supprime le template d'origine d'une session
- **THEN** la session reste entièrement consultable, exécutable et exportable, et affiche le nom du template issu de sa copie

### Requirement: Détection d'une nouvelle version du template
Le système DOIT signaler qu'une version plus récente du template est disponible lorsque le template d'origine existe et que son `updatedAt` est postérieur à celui de la copie figée de la session. Ce signalement NE DOIT PAS apparaître pour une session terminée.

#### Scenario: Badge de mise à jour sur une session en cours
- **WHEN** le template d'origine a été enregistré après la création de la copie d'une session en cours
- **THEN** le dashboard et le runner affichent un badge « Modèle mis à jour » avec une action « Appliquer »

#### Scenario: Pas de badge sur une session terminée
- **WHEN** la même situation concerne une session terminée
- **THEN** aucun badge n'est affiché

#### Scenario: Pas de badge si le template a disparu
- **WHEN** le template d'origine a été supprimé
- **THEN** aucun badge de mise à jour n'est affiché

### Requirement: Application manuelle d'une nouvelle version du template
Le système DOIT permettre de remplacer la copie figée d'une session en cours par la version courante du template, après présentation d'un récapitulatif et confirmation. Les réponses des items dont l'identifiant existe dans les deux versions DOIVENT être conservées, avec leur historique. Les réponses et preuves des items supprimés DOIVENT être purgées. Les nouveaux champs de contexte DOIVENT recevoir leur valeur par défaut. Les portes forcées des sections supprimées DOIVENT être purgées ; celles des sections conservées DOIVENT être gardées.

Le récapitulatif DOIT signaler, en plus des items ajoutés et supprimés, les changements de criticité, de preuve exigée et de consigne de preuve d'un item, les changements de dépendances, de porte et de mode de jonction d'une section, et le changement de politique de clôture du modèle. Il NE DOIT PAS signaler de changement lié au motif N/A obligatoire, option retirée.

#### Scenario: Récapitulatif avant application
- **WHEN** l'utilisateur clique sur « Appliquer »
- **THEN** le système affiche la nouvelle version, la liste des items ajoutés, la liste des items supprimés en signalant ceux qui portent une réponse ou des preuves, et demande confirmation

#### Scenario: Application confirmée
- **WHEN** l'utilisateur confirme l'application
- **THEN** la copie figée est remplacée, les réponses des items conservés sont intactes, les réponses et preuves des items supprimés sont effacées, et le badge disparaît

#### Scenario: Application annulée
- **WHEN** l'utilisateur annule le récapitulatif
- **THEN** la session est inchangée et le badge reste affiché

#### Scenario: Changement de criticité signalé
- **WHEN** un item conservé passe d'optionnel à bloquant dans la nouvelle version
- **THEN** le récapitulatif signale ce changement de criticité pour cet item

#### Scenario: Changement de dépendances signalé
- **WHEN** une section conservée déclare une nouvelle dépendance dans la nouvelle version
- **THEN** le récapitulatif signale le changement de dépendances de cette section en nommant les sections concernées

#### Scenario: Ancien motif N/A ignoré
- **WHEN** la copie figée d'une session porte encore `requireNaReason: true` sur un item et que la nouvelle version ne porte plus ce champ
- **THEN** le récapitulatif ne signale aucun changement pour cet item à ce titre

#### Scenario: Portes forcées après application
- **GIVEN** une session dont les portes souples de deux sections ont été forcées
- **WHEN** l'utilisateur applique une nouvelle version qui supprime l'une de ces sections
- **THEN** le forçage de la section supprimée est purgé et celui de la section conservée est gardé

### Requirement: Session dont la structure est indisponible
Le système DOIT gérer les sessions dont le template d'origine n'existait plus au moment de la migration des données, et pour lesquelles aucune copie de structure n'a pu être constituée.

#### Scenario: Ouverture d'une session sans structure
- **WHEN** l'utilisateur ouvre une session dont la copie de template est marquée indisponible
- **THEN** le runner affiche un message expliquant que la structure du modèle est perdue, conserve les réponses en base et laisse disponibles la suppression et l'export JSON
