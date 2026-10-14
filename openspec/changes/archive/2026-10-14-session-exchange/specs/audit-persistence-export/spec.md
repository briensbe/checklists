## MODIFIED Requirements

### Requirement: Export de rapports d'audit (Excel et PDF)
Le système DOIT générer des rapports de traçabilité formels aux formats Excel (.xlsx) et PDF (A4 formel), indépendants du template utilisé : toute information de structure DOIT provenir de la copie figée de la session. Le cartouche DOIT comporter le titre, le nom et la version du modèle, le statut de la session (« En cours » ou « Terminée »), la date de la dernière clôture lorsque la session est terminée, un champ par entrée du schéma de contexte de la copie figée (libellé du schéma et valeur saisie) et la synthèse d'avancement. Aucune clé de contexte NE DOIT être codée en dur.

#### Scenario: Export du rapport Excel
- **WHEN** l'utilisateur clique sur "Export Excel"
- **THEN** une feuille de calcul structurée avec cartouche (modèle, version, statut, clôture, contexte), synthèse et tableau des contrôles applicables est générée et téléchargée

#### Scenario: Export du rapport PDF formel
- **WHEN** l'utilisateur clique sur "Export Audit PDF"
- **THEN** un document PDF normé (en-tête, cartouche de métadonnées, tableau paginé avec mise en évidence des statuts OK/KO/NA et observations) est produit

#### Scenario: Contexte d'un template quelconque
- **WHEN** la copie figée de la session définit des champs de contexte autres que ceux du modèle « Audit de livraison »
- **THEN** le cartouche Excel et PDF affiche ces champs, dans l'ordre du schéma, avec leurs libellés

#### Scenario: Valeurs de contexte typées
- **WHEN** un champ de contexte est une liste de choix ou une date
- **THEN** le rapport affiche le libellé de l'option choisie (et non sa valeur technique) ou la date au format français ; un champ vide est affiché « Non renseigné »

#### Scenario: Session terminée
- **WHEN** la session exportée est au statut `completed`
- **THEN** le cartouche indique « Terminée » et la date et l'heure de la dernière clôture

#### Scenario: Libellé des choix personnalisés
- **WHEN** un item de type choix a une option sélectionnée
- **THEN** la colonne d'état affiche le libellé de l'option et non son identifiant

## ADDED Requirements

### Requirement: Annexe des preuves dans le rapport PDF
Le rapport PDF DOIT se terminer par une annexe des preuves de la session, groupées par item applicable dans l'ordre de la checklist. Les preuves images DOIVENT y être reproduites en miniatures ; les autres fichiers DOIVENT être listés par nom, type et taille.

#### Scenario: Preuves images
- **WHEN** un item possède une ou plusieurs preuves de type image
- **THEN** l'annexe affiche, sous le libellé de l'item et le titre de sa section, une miniature de chaque image avec son nom

#### Scenario: Preuves non images
- **WHEN** un item possède des preuves de type fichier ou log
- **THEN** l'annexe liste chacune par son nom, son type et sa taille, sans en reproduire le contenu

#### Scenario: Image non décodable
- **WHEN** une preuve déclarée image ne peut pas être décodée par le navigateur
- **THEN** elle est listée par son nom comme un fichier, et le rapport est tout de même produit

#### Scenario: Session sans preuve
- **WHEN** la session ne possède aucune preuve
- **THEN** le rapport ne comporte pas d'annexe

## REMOVED Requirements

### Requirement: Export et Import JSON de session
**Reason**: Le brouillon JSON enrichi n'était pas ré-importable et ne portait ni la structure ni les preuves. L'échange de session est désormais couvert par la capacité dédiée `session-exchange` (fichier autoportant versionné, preuves base64 optionnelles, import depuis le dashboard avec gestion des conflits).
**Migration**: Utiliser l'export JSON du runner (nouveau format d'échange) et le bouton « Importer une session » du dashboard. Les brouillons JSON déjà exportés restent importables.
