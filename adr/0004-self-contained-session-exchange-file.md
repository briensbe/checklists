# ADR 0004 : Fichier d'échange de session autoportant et versionné

## Statut
Accepté - 2026-10-14

Supersedes: aucun (prolonge ADR 0003)

## Contexte
L'application est locale et mono-utilisateur (ADR 0001) : partager un audit, l'archiver hors du navigateur ou le reprendre sur un autre poste passe exclusivement par des fichiers. Jusqu'ici, l'export JSON d'une session était un rapport enrichi non ré-importable, sans structure ni preuves. Depuis l'ADR 0003, chaque session embarque une copie figée de son template, ce qui la rend exportable comme un document autonome. Il faut fixer un format durable : une fois des fichiers diffusés, chaque évolution de l'application devra continuer à les lire.

## Décision
Une session s'échange sous la forme d'**un seul fichier JSON** constitué d'une **enveloppe versionnée** :
- `format: "checklist-session"` identifie le type de fichier ; `formatVersion` (entier, 1 à l'introduction) est incrémenté à chaque évolution incompatible ;
- `session` contient la session telle que stockée, copie figée du template comprise ; c'est la seule partie relue à l'import ;
- `summary` est une synthèse lisible recalculable, jamais relue ;
- `evidences`, optionnel, embarque les preuves encodées en **base64** dans le même fichier ; son absence signifie « non incluses », un tableau vide « aucune preuve ».

À l'import, toute donnée passe par les fonctions de normalisation communes (`normalizeTemplate`, migration de session) : l'import DOIT accepter toutes les versions de format antérieures ainsi que les brouillons JSON produits avant ce format. Les identifiants de preuve sont régénérés à l'import ; un conflit d'identifiant de session (ou de template) est toujours tranché explicitement par l'utilisateur (remplacer ou importer comme copie), jamais par écrasement silencieux.

Alternatives écartées :
- **Archive ZIP** (JSON + fichiers de preuves) : format plus compact pour les gros volumes, mais nouvelle dépendance (jszip) et fichier illisible sans outil.
- **Fichiers séparés** (JSON + dossier de preuves) : impossibles à produire et relire de façon fiable depuis une page web sans API File System Access, et sources d'erreurs de manipulation.
- **Session « nue » sans enveloppe** : indiscernable d'un ancien brouillon et sans point d'ancrage pour versionner le format.

## Conséquences
- **Positives** : un fichier unique, lisible et diffable, suffit pour partager, archiver ou restaurer un audit, preuves comprises ; aucune dépendance supplémentaire ; le versionnement explicite permet de faire évoluer le format sans casser les fichiers déjà diffusés.
- **Négatives / Précautions** : le base64 augmente la taille d'environ 33 % et l'import charge le fichier entier en mémoire, ce qui borne en pratique le volume de preuves échangeable à quelques dizaines ou centaines de Mo ; toute évolution du modèle de session ou de template doit prévoir sa conversion dans le chemin d'import (en plus de la migration Dexie) et un test d'aller-retour ; si un format compressé devient nécessaire, il fera l'objet d'un nouvel ADR qui remplacera celui-ci.
