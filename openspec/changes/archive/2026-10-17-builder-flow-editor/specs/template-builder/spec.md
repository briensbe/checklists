## MODIFIED Requirements

### Requirement: Garde contre les modifications non enregistrées
Le système DOIT intégrer une garde de navigation (`CanDeactivate`) et une écoute de l'événement navigateur `beforeunload` sur les vues du constructeur (`/templates/builder` et `/templates/:id/edit`). Si des modifications ont été apportées par rapport à l'état initial sans être enregistrées, le système DOIT interrompre la navigation et demander confirmation à l'utilisateur via le dialogue modal applicatif (`DialogService`). Toute modification du modèle DOIT être détectée, y compris celle d'un champ imbriqué (libellé ou aide d'un contrôle, option de choix, options avancées, champ de contexte et ses options, titre ou icône d'une section), et un retour manuel à l'état initial DOIT faire disparaître l'indication de modifications non enregistrées.

#### Scenario: Navigation interne avec formulaire modifié
- **WHEN** le concepteur modifie un élément du formulaire et clique sur un lien de navigation vers une autre page de l'application
- **THEN** la navigation est suspendue et une modale de confirmation demande à l'utilisateur s'il souhaite quitter la page en abandonnant ses modifications.

#### Scenario: Modification d'un champ imbriqué
- **WHEN** le concepteur modifie seulement le libellé d'un contrôle existant, puis clique sur un lien de navigation vers une autre page de l'application
- **THEN** la navigation est suspendue et la modale de confirmation est affichée

#### Scenario: Retour à l'état initial
- **WHEN** le concepteur modifie le libellé d'un contrôle puis lui redonne sa valeur d'origine
- **THEN** le modèle n'est plus signalé comme modifié et la navigation n'est pas suspendue

#### Scenario: Abandon confirmé
- **WHEN** le concepteur confirme l'abandon dans la boîte de dialogue
- **THEN** la navigation s'exécute vers la route demandée et les modifications non enregistrées sont écartées.

#### Scenario: Annulation de la navigation
- **WHEN** le concepteur annule la boîte de dialogue de confirmation
- **THEN** le concepteur reste sur le constructeur avec son formulaire et ses modifications intacts.

#### Scenario: Fermeture de l'onglet ou rafraîchissement navigateur
- **WHEN** le concepteur ferme l'onglet ou rafraîchit la page alors que des modifications non enregistrées existent
- **THEN** l'événement `beforeunload` du navigateur est intercepté pour inviter l'utilisateur à confirmer la fermeture.
