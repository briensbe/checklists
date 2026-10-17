# Backlog des idées reportées

Idées discutées lors du cadrage d'octobre 2026 et volontairement écartées pour l'instant. Chaque entrée précise pourquoi elle est reportée et ce qui justifierait de la reconsidérer.

## Comparaison de deux sessions d'un même modèle

Voir ce qui a changé entre deux audits (ex. items passés de KO à OK entre la livraison 1.2 et la 1.3).

- **Pourquoi reportée :** complexe dès que les deux sessions ont des copies figées de versions différentes du modèle (items ajoutés, supprimés, renommés).
- **Déclencheur :** usage régulier de la fonction « Refaire l'audit » (change `runner-and-dashboard-productivity`) et besoin exprimé de suivre l'évolution d'un audit à l'autre.

## PWA et fonctionnement hors ligne

Service worker, installation de l'application, polices embarquées au lieu de Google Fonts.

- **Pourquoi reportée :** l'usage cible est un poste de bureau connecté.
- **Déclencheur :** audits réalisés sur le terrain sans réseau fiable, ou usage sur tablette.

## Synchronisation entre appareils / partage en équipe

Backend ou stockage partagé permettant à plusieurs personnes de voir les mêmes checklists.

- **Pourquoi reportée :** usage mono-utilisateur ; le partage se fait par échange de fichiers JSON (change `session-exchange`). Un backend implique authentification, hébergement et gestion des conflits.
- **Déclencheur :** plusieurs auditeurs devant travailler simultanément sur les mêmes sessions.

## Photo directe depuis la caméra comme preuve

Capture via `<input capture>` ou `getUserMedia`.

- **En partie reprise :** le change `quick-check-and-drawer` ajoute l'attribut `capture="environment"` au bouton Photo du tiroir (sans effet sur poste de bureau). Seule la capture dans la page via `getUserMedia` reste reportée.
- **Pourquoi reportée :** sans intérêt sur poste de bureau, où la capture d'écran par Ctrl+V couvre le besoin.
- **Déclencheur :** passage à un usage mobile ou tablette (lié à l'entrée PWA).

## Grand périmètre : phases, carte du projet et zoom

Regrouper les étapes en phases éventuellement parallèles, avec une carte du projet (une tuile par phase), un zoom sur chaque phase et un bloc « Laissés en route » couvrant toutes les phases franchies (maquette 04 de [docs/design/mockups/](../docs/design/mockups/index.html)).

- **Pourquoi reportée :** les checklists actuelles (audits de livraison, mises en production) tiennent en une dizaine d'étapes. Le modèle est prévu pour l'ajout : une liste `phases` et un `phaseId` sur la section, les sections restant à plat.
- **Déclencheur :** un modèle qui dépasse 7 ou 8 étapes, ou le besoin de suivre un projet complet.

## Compléments de la vision UX

Éléments de [checklist-ux.md](../docs/design/checklist-ux.md) non retenus dans les changes 6 à 9 du [HANDOVER](HANDOVER.md) :
- `canAnticipate` : cocher par anticipation un item d'une étape encore verrouillée ;
- mode discret, sans animation ni confettis (en dehors du respect de `prefers-reduced-motion`, déjà prévu) ;
- vues de synthèse (sunburst, radar, heatmap), qui demanderaient `ngx-echarts` ;
- rapports Excel et PDF enrichis : criticité, état des étapes, historique des items ;
- interactions mobiles : balayage d'une ligne, panneau en bas d'écran, chemin vertical.

- **Pourquoi reportée :** aucun n'est nécessaire pour remplir ou construire un chemin ; leur intérêt se jugera à l'usage.
- **Déclencheur :** retours d'usage après livraison de `runner-path-view`, ou passage à un usage mobile pour les interactions tactiles.
