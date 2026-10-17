## MODIFIED Requirements

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
