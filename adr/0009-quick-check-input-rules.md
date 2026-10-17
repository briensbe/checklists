# ADR 0009 : Règles de saisie rapide : N/A sur tout contrôle, preuve exigée au geste, lien sur la réponse

## Statut
Accepté - 2026-10-17

Supersedes: aucun (prolonge ADR 0004 et ADR 0007)

## Contexte
Le change `quick-check-and-drawer` remplace les boutons OK, KO et N/A par un geste unique sur la ligne, et place le reste (note, preuves, N/A) dans un tiroir. Trois questions de modèle se posent, qui engagent aussi les données échangées par fichier (ADR 0004) et les changes suivants (`runner-path-view`, `builder-flow-editor`) :

1. **Le N/A sur une case à cocher ou un choix.** La vision UX place « Non applicable » dans le tiroir pour tous les types de contrôle. Or la règle « répondu » (`isAnswered`) ne connaît le N/A que pour un contrôle de type statut.
2. **La garantie de la preuve exigée** (`evidenceRequired`), introduite par l'ADR 0007. Les preuves vivent dans une table Dexie séparée (`evidences`), lue de façon asynchrone, alors que les états d'étape et la clôture sont calculés par des fonctions pures à partir de la session seule.
3. **Le stockage d'une preuve de type lien**, question laissée ouverte par `step-flow-model`.

## Décision
1. **Un N/A s'écrit `status: 'NA'` sur la réponse, quel que soit le type du contrôle**, et compte comme une réponse pour la progression, les filtres, les portes et la clôture. Poser un N/A retire la coche, le choix et l'indicateur de preuve en attente. Le N/A se retire explicitement, et tant qu'il est posé, le geste principal et les choix sont sans effet. On n'ajoute aucun champ : le statut `NA` existe déjà sur toutes les réponses.
2. **La preuve exigée est garantie au moment du geste, jamais par les règles de résolution ou de clôture.**
   - Le geste qui donne une réponse conforme demande la preuve si elle manque.
   - Un contrôle bloquant ne peut pas recevoir cette réponse sans preuve. Un non bloquant peut la recevoir avec l'indicateur `evidencePending`.
   - Les états d'étape et la validation de clôture ne lisent jamais la table `evidences`.
   - Une preuve supprimée après la validation ne modifie pas la réponse : l'interface la signale comme « preuve manquante ».
3. **Une preuve de type lien est un champ de la réponse** (`evidenceLink`, une seule adresse `http` ou `https`). Sa validation et son retrait sont historisés par un événement dédié (`evidence-link`). Les fichiers et les photos restent dans la table `evidences`.
4. **Ces ajouts sont optionnels** : `formatVersion` du fichier d'échange reste à 1, et aucune nouvelle version de base Dexie n'est créée.

Alternatives écartées :
- **Un champ `na` distinct du statut** : deux sources de vérité pour un contrôle de type statut, et une conversion des réponses existantes.
- **Vérifier la preuve exigée dans la résolution des bloquants et la clôture** : règles impures ou dépendantes d'une lecture asynchrone. De plus, la suppression tardive d'un fichier bloquerait une porte ou une clôture sans explication.
- **Défaire automatiquement la réponse quand la preuve disparaît** : comportement surprenant, et l'annulation d'une suppression devrait aussi rétablir la réponse.
- **Le lien comme preuve de la table `evidences`** : il serait perdu à l'export sans pièces jointes, et imposerait un nouveau type de preuve aux rapports et à l'annexe PDF.
- **Le lien dans la note** : il ne serait ni structuré ni validable.

## Conséquences
- **Positives** :
  - un N/A uniforme pour tous les types ;
  - des règles d'étapes et de clôture qui restent pures et synchrones ;
  - un lien de preuve qui voyage avec la session dans tout export ;
  - aucune migration.
- **Négatives / Précautions** :
  - une version antérieure de l'application lit une case à cocher ou un choix N/A comme « sans réponse ». La donnée est conservée, seul l'affichage est dégradé ;
  - un bloquant validé peut perdre sa preuve après coup, ce que l'interface doit signaler. Un éventuel blocage de la clôture dans ce cas ferait l'objet d'un nouvel ADR ;
  - toute action groupée, comme « Passer le reste à OK » aujourd'hui ou ses futures variantes par étape, doit respecter les mêmes règles : ne jamais écraser un N/A, ne jamais répondre à un bloquant sans sa preuve, et poser `evidencePending` sur un non bloquant ;
  - un lien affiché doit toujours être vérifié (`http` ou `https`) avant d'en faire un lien cliquable, y compris pour une session importée.
