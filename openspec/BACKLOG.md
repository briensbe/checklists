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

- **Pourquoi reportée :** sans intérêt sur poste de bureau, où la capture d'écran par Ctrl+V couvre le besoin.
- **Déclencheur :** passage à un usage mobile ou tablette (lié à l'entrée PWA).
