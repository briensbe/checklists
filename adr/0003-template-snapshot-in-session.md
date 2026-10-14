# ADR 0003 : Copie figée du template dans chaque session

## Statut
Accepté - 2026-10-14

Supersedes: aucun (complète ADR 0002)

## Contexte
Depuis l'ADR 0002, chaque session est isolée par UUID mais ne référence son template que par `templateId`. La structure affichée est résolue à la volée depuis la bibliothèque de templates. Conséquences observées :
- modifier un template altère rétroactivement les audits en cours et terminés, et laisse des réponses orphelines ;
- supprimer un template rend ses sessions inexploitables ;
- une session ne peut pas être exportée ou archivée comme un document autoportant.

Ces défauts empêchent d'introduire un statut « terminée » ayant une valeur probante.

## Décision
Chaque session embarque une **copie complète et figée** de la définition du template (`templateSnapshot`) prise à sa création. Toute lecture de structure pour une session (exécution, métriques, validation, exports) passe exclusivement par cette copie. `templateId` est conservé uniquement comme référence d'origine pour détecter une version plus récente.

La mise à jour d'une session vers une nouvelle version du template est **manuelle**, réservée aux sessions en cours, précédée d'un récapitulatif (items ajoutés / supprimés) ; les réponses des items de même identifiant sont conservées.

Les anciens formats de template sont convertis par une fonction de normalisation unique, utilisée à la fois par les migrations de base et par l'import de fichiers JSON.

Alternative écartée : une table de versions immuables de templates référencées par `(templateId, version)`. Elle évite la duplication mais impose un versionnement à chaque enregistrement, un nettoyage des versions orphelines et rend l'export d'une session dépendant d'une seconde entité.

## Conséquences
- **Positives** : sessions autoportantes (exportables, archivables, indépendantes de la bibliothèque) ; la bibliothèque de templates peut évoluer et être nettoyée librement ; base solide pour le cycle de vie et l'échange de sessions par fichier.
- **Négatives / Précautions** : duplication de la structure (quelques Ko par session) ; toute future évolution du format de template doit migrer **à la fois** la table `templates` et les copies embarquées dans `sessions`, via la fonction de normalisation commune ; la correction d'une coquille dans un template ne se propage pas automatiquement aux sessions en cours.
