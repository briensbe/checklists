# Spécifications : Échange de sessions par fichier

## Purpose
Exporter une session dans un fichier JSON unique, autoportant et versionné (preuves en base64 optionnelles), et la réimporter depuis le tableau de bord en acceptant les anciens formats et en faisant trancher explicitement les conflits d'identifiant (voir ADR 0004).

## Requirements

### Requirement: Fichier d'échange de session autoportant
Le système DOIT exporter une session dans un fichier JSON unique, autoportant et ré-importable, constitué d'une enveloppe versionnée contenant : l'identifiant de format `checklist-session`, un numéro de version de format, la date d'export, la session complète (identifiant, titre, `templateId`, copie figée `templateSnapshot`, statut, historique `closures`, valeurs de contexte, réponses, dates de création et de modification, indicateur `structureUnavailable` le cas échéant) et un bloc de synthèse lisible (métriques d'avancement). Le bloc de synthèse NE DOIT PAS être utilisé à l'import.

#### Scenario: Export d'une session sans pièces jointes
- **WHEN** l'utilisateur exporte une session en laissant décochée la case « Inclure les pièces jointes »
- **THEN** un fichier `.json` est téléchargé, contenant l'enveloppe et la session complète, sans bloc de preuves

#### Scenario: Export d'une session terminée
- **WHEN** l'utilisateur exporte une session au statut `completed`
- **THEN** le fichier contient le statut `completed` et l'historique complet des clôtures et réouvertures

#### Scenario: Aperçu avant téléchargement
- **WHEN** l'utilisateur ouvre la fenêtre d'export JSON depuis le runner
- **THEN** l'aperçu affiche le contenu du fichier d'échange, les preuves éventuelles y étant représentées par leurs seules métadonnées (nom, type, taille) sans le contenu encodé

### Requirement: Inclusion optionnelle des pièces jointes en base64
Le système DOIT proposer, dans la fenêtre d'export, une case « Inclure les pièces jointes » décochée par défaut, accompagnée du nombre et de la taille totale des preuves de la session. Lorsqu'elle est cochée, chaque preuve DOIT être embarquée dans le même fichier avec son identifiant d'item, son nom, son type, son type MIME, sa taille, sa date de création et son contenu encodé en base64. Aucune archive ni fichier annexe NE DOIT être produit.

#### Scenario: Export avec pièces jointes
- **WHEN** l'utilisateur coche « Inclure les pièces jointes » puis télécharge le fichier
- **THEN** le fichier contient un bloc de preuves listant chaque preuve de la session avec son contenu en base64

#### Scenario: Session sans preuve
- **WHEN** la session ne possède aucune preuve
- **THEN** la case « Inclure les pièces jointes » est désactivée et indique « Aucune pièce jointe »

#### Scenario: Distinction entre « non incluses » et « aucune »
- **WHEN** le fichier est exporté avec la case décochée
- **THEN** le bloc de preuves est absent du fichier, alors qu'un export avec la case cochée d'une session sans preuve produirait un bloc de preuves vide

### Requirement: Import d'une session depuis le dashboard
Le système DOIT permettre d'importer un fichier de session depuis le tableau de bord. Le fichier DOIT être validé et normalisé avant toute écriture : la copie figée est normalisée par la fonction commune de normalisation des templates et la session par la migration de format de session, de sorte que les fichiers d'anciens formats restent acceptés. L'écriture de la session et de ses preuves DOIT être atomique. La session importée DOIT conserver son statut, ses clôtures et ses réponses, et ne DOIT PAS modifier la bibliothèque de templates.

#### Scenario: Import d'un fichier valide
- **WHEN** l'utilisateur clique sur « Importer une session » et sélectionne un fichier d'échange valide dont l'identifiant n'existe pas en base
- **THEN** la session est enregistrée avec le même identifiant, apparaît dans le tableau de bord et un message confirme l'import

#### Scenario: Import avec pièces jointes
- **WHEN** le fichier importé contient un bloc de preuves
- **THEN** chaque preuve est décodée en Blob et enregistrée, rattachée à la session importée et à son item, sous un nouvel identifiant de preuve

#### Scenario: Import d'une session terminée
- **WHEN** le fichier importé contient une session au statut `completed`
- **THEN** la session importée est terminée et s'ouvre en lecture seule

#### Scenario: Import d'un ancien brouillon JSON
- **WHEN** l'utilisateur importe un brouillon JSON exporté avant ce change (sans enveloppe ni copie figée)
- **THEN** la session est reconstruite : copie figée prise dans la bibliothèque si le template d'origine y existe, sinon structure vide signalée « structure indisponible » ; statut `in_progress` ; les champs d'enrichissement du brouillon (libellés, compteurs de preuves) sont ignorés

#### Scenario: Copie figée à l'ancien format
- **WHEN** la copie figée du fichier contient des champs d'un ancien format de template (`mode`, `color`)
- **THEN** elle est convertie au format courant (`visibleIf`, `tone`) avant l'enregistrement

#### Scenario: Rejet d'un fichier invalide
- **WHEN** le fichier n'est pas un JSON valide, déclare un identifiant de format inconnu, une version de format supérieure à celle supportée, ou une session dépourvue d'identifiant
- **THEN** l'import est refusé sans aucune écriture en base et un message explique la cause

#### Scenario: Pièce jointe corrompue
- **WHEN** le contenu base64 d'une preuve ne peut pas être décodé
- **THEN** l'import est refusé dans son ensemble, sans écriture partielle, et le message nomme la preuve en cause

#### Scenario: Pas de modification de la bibliothèque
- **WHEN** une session est importée alors que son template d'origine est absent de la bibliothèque
- **THEN** aucun template n'est ajouté à la bibliothèque ; la session s'exécute à partir de sa copie figée

### Requirement: Résolution des conflits d'identifiant à l'import de session
Lorsque l'identifiant de la session importée existe déjà en base, le système DOIT présenter une boîte de dialogue modale unique à trois choix explicites (« Remplacer l'existante », « Importer comme copie », « Annuler »), sans recourir à des boîtes de confirmation natives enchaînées.

#### Scenario: Remplacement de la session existante
- **WHEN** l'utilisateur sélectionne l'option « Remplacer l'existante » dans la boîte de dialogue de conflit
- **THEN** la boîte se ferme, la session en base est remplacée par celle du fichier avec le même identifiant, et un toast confirme le remplacement.

#### Scenario: Remplacement avec pièces jointes incluses
- **WHEN** l'utilisateur remplace une session et que le fichier contient un bloc de preuves
- **THEN** toutes les preuves existantes de la session sont supprimées et remplacées par celles du fichier.

#### Scenario: Remplacement sans pièces jointes incluses
- **WHEN** l'utilisateur remplace une session et que le fichier ne contient pas de bloc de preuves
- **THEN** les preuves existantes de la session sont conservées, sauf celles rattachées à des items absents de la copie figée importée, qui sont supprimées.

#### Scenario: Import comme copie
- **WHEN** l'utilisateur sélectionne l'option « Importer comme copie » dans la boîte de dialogue de conflit
- **THEN** la boîte se ferme, une nouvelle session est créée avec un nouvel UUID et le titre suffixé de « (import) », ses preuves éventuelles y étant rattachées ; la session existante est inchangée.

#### Scenario: Annulation
- **WHEN** l'utilisateur clique sur « Annuler », clique sur l'arrière-plan ou appuie sur `Échap`
- **THEN** la boîte se ferme et aucune donnée n'est modifiée ou importée.
