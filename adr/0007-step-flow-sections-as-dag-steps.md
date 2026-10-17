# ADR 0007 : Sections enchaînées en étapes, portes calculées et historique des contrôles

## Statut
Accepté - 2026-10-17

Supersedes: aucun (prolonge ADR 0003 et ADR 0004)

## Contexte
Les checklists sont des listes de sections sans ordre ni criticité : tout est accessible en même temps et chaque contrôle pèse autant. La vision UX de `docs/design/checklist-ux.md` introduit des checklists à étapes « façon aviation » : des étapes reliées en graphe, des portes qui ne s'ouvrent qu'une fois les contrôles bloquants résolus, des branches parallèles qui se rejoignent, et un historique des changements d'état.

Ce document de vision propose son propre modèle de données (phases, étapes, `ItemState`), conçu sans connaître l'application. L'adopter imposerait une migration Dexie, un nouveau format du fichier d'échange et la réécriture des règles, des rapports et du builder, alors que les réponses par identifiant d'item et la copie figée (ADR 0003) couvrent déjà une partie de ses besoins.

## Décision
1. **Une section est une étape** d'un graphe orienté sans cycle. Elle déclare ses prérequis dans un champ optionnel `dependsOn`, avec un mode de jonction (`all` ou `any`) et une porte stricte ou souple. Les contrôles reçoivent une criticité optionnelle (`blocking`, `important`, `optional`). Le modèle existant est étendu, pas remplacé.
2. **Règle « absent = ancien comportement »** : tous les nouveaux champs sont optionnels, et leur absence reproduit le comportement antérieur. Un modèle sans dépendance n'a aucun verrou, un contrôle sans criticité est optionnel, un modèle sans politique de clôture exige une réponse partout. Les nouvelles valeurs par défaut sont écrites explicitement par le builder et par les nouveaux modèles, jamais par une migration. Il n'y a donc ni nouvelle version de base Dexie ni nouvelle version du fichier d'échange.
3. **Les états d'étape sont calculés, jamais stockés.** Ils sont calculés par une fonction pure à partir de la copie figée, du contexte (conditions d'affichage comprises) et des réponses : débloquée, franchie, état visuel, progression des jonctions, contrôles laissés en route. La seule donnée stockée est le forçage d'une porte souple, avec sa justification et sa date, parce que c'est une décision de l'utilisateur. Un forçage n'agit que tant que la porte reste souple dans la copie figée.
4. **Un modèle invalide n'enferme jamais l'utilisateur.** L'import et le builder refusent les boucles et les dépendances inconnues. Si une copie figée en contient malgré tout, les sections concernées sont traitées comme débloquées.
5. **L'historique des contrôles n'écrase rien.** Chaque réponse porte une liste d'événements datés, à laquelle on ne fait qu'ajouter, pour les changements d'état (statut, coche, choix, preuves), à l'exclusion des saisies de texte. Seules une réinitialisation confirmée de la session et l'annulation de l'action qui a produit un événement peuvent en retirer.

Alternatives écartées :
- **Adopter le modèle du document de vision** (phases, étapes, `ItemState`) : migration Dexie et nouveau format d'échange, réécriture transversale, sans gain fonctionnel par rapport à l'extension.
- **Stocker l'état « débloqué » des étapes** : il deviendrait faux dès qu'une réponse, le contexte ou la copie figée change, et il faudrait le resynchroniser partout.
- **Migrer les données pour écrire les valeurs par défaut** : réécriture de tous les modèles et copies figées, et faux changements dans la comparaison de versions entre anciens clichés et modèles récents.
- **Verrouiller ou rejeter une session dont le modèle est invalide** : la session deviendrait impossible à terminer.

## Conséquences
- **Positives** : les modèles et sessions existants fonctionnent sans changement ; les règles d'enchaînement sont testables sans Angular ; tous les écrans lisent le même calcul ; les fichiers d'échange restent lisibles dans les deux sens de version.
- **Négatives / Précautions** :
  - Les identifiants de sections deviennent des références, comme ceux des items. Ils doivent rester non modifiables, et supprimer une section impose de nettoyer les `dependsOn`.
  - Toute nouvelle règle doit respecter la convention « absent = ancien comportement ». Par exemple, `controlType` absent reste `status`, même si le builder crée désormais des cases à cocher.
  - La comparaison de versions doit connaître chaque nouveau champ structurel pour le signaler.
  - Le motif N/A obligatoire (`requireNaReason`) est retiré : un N/A n'exige plus de justification, et l'historique en garde la trace.
