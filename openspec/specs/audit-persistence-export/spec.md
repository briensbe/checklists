# Spécifications : Persistance Locale et Export d'Audit

## Purpose
Persister localement l'état des audits et leurs preuves, et produire des rapports Excel et PDF génériques pour la traçabilité. L'échange de sessions par fichier JSON relève de la capacité `session-exchange`.

## Requirements

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

### Requirement: Export de rapports d'audit (Excel et PDF)
Le système DOIT générer des rapports de traçabilité formels aux formats Excel (.xlsx) et PDF (A4 formel), indépendants du template utilisé : toute information de structure DOIT provenir de la copie figée de la session. Le cartouche DOIT comporter le titre, le nom et la version du modèle, le statut de la session (« En cours » ou « Terminée »), la date de la dernière clôture lorsque la session est terminée, un champ par entrée du schéma de contexte de la copie figée (libellé du schéma et valeur saisie) et la synthèse d'avancement. Aucune clé de contexte NE DOIT être codée en dur. La colonne d'état DOIT afficher `N/A` pour un contrôle non applicable quel que soit son type, et signaler une preuve à compléter ; la colonne des observations DOIT reprendre le lien de preuve lorsqu'il existe.

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

#### Scenario: Contrôle non applicable d'un type quelconque
- **WHEN** un item de type case à cocher ou choix est au statut `N/A`
- **THEN** la colonne d'état affiche `N/A`, et non « NON FAIT » ou « NON SÉLECTIONNÉ »

#### Scenario: Preuve à compléter
- **WHEN** un item coché porte l'indicateur « preuve à compléter »
- **THEN** la colonne d'état affiche l'état de l'item suivi de la mention « preuve à compléter »

#### Scenario: Lien de preuve
- **WHEN** un item a un commentaire et un lien de preuve
- **THEN** la colonne des observations affiche le commentaire, puis le lien de preuve précédé de « Lien de preuve : »

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
