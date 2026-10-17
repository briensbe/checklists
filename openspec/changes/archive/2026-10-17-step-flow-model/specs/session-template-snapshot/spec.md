## MODIFIED Requirements

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
