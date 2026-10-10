# ADR 0001 : Utilisation de Dexie.js et IndexedDB pour la persistance locale

## Statut
Accepté - 2026-10-10

## Contexte
L'application doit fonctionner de manière 100% autonome dans le navigateur (client-only) sans dépendance vers un serveur distant, tout en permettant aux utilisateurs d'associer des pièces jointes et des captures d'écran (images issues du presse-papier ou fichiers) aux différents points de contrôle d'audit.
L'utilisation de `localStorage` est contrainte par un quota strict d'environ 5 Mo et impose un encodage textuel (Base64), entraînant une saturation immédiate dès l'attachement de quelques images.

## Décision
Nous choisissons d'utiliser **IndexedDB** via la librairie **Dexie.js** pour la persistance des sessions et des pièces jointes.

### Étude comparative des solutions envisagées :

| Critère | Dexie.js | idb |
| :--- | :--- | :--- |
| **Poids** | ~20 Ko gzippé | < 2 Ko gzippé |
| **Typage des tables** | Avancé et déclaratif | Basique |
| **Requêtes & index** | Filtrage, tri, pagination simples | Manuel |
| **Migrations de schéma** | Gestion automatique des versions | Callback upgrade basique |
| **Réactivité** | Support natif de `liveQuery()` | Aucun |

Bien que `idb` soit extrêmement léger, le surcoût de ~18 Ko de **Dexie.js** est largement amorti par le typage déclaratif robuste, la simplification drastique des requêtes/index, la gestion mature des migrations de schéma et le support réactif indispensable pour un état applicatif riche.

Dexie.js apporte ainsi :
1. Une gestion native et performante du stockage de `Blob` sans surcharge mémoire.
2. Une API typée TypeScript avec transactions asynchrones basées sur les promesses.
3. Une extensibilité facilitée pour faire évoluer le schéma de données (index, requêtes, futures collections).

## Conséquences
- **Positives** : Capacité de stockage locale très étendue (plusieurs centaines de Mo / Go selon le quota navigateur), absence de blocage du thread principal (I/O asynchrone), conservation intacte des fichiers binaires.
- **Négatives / Précautions** : Les données restent captives du profil navigateur local ; l'utilisateur doit être encouragé à utiliser la fonctionnalité d'export (JSON) pour archiver ou partager ses sessions d'audit.
