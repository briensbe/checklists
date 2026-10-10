## 1. Dépendances et Modèle de Données

- [ ] 1.1 Installer les dépendances du projet (`dexie`, `xlsx`, `jspdf`, `jspdf-autotable`)
- [ ] 1.2 Définir les interfaces TypeScript du domaine (`ChecklistTemplate`, `Section`, `Item`, `ChecklistSession`, `EvidenceRecord`)
- [ ] 1.3 Implémenter le service de base de données Dexie (`AppDatabaseService`) pour la gestion des tables IndexedDB
- [ ] 1.4 Créer le jeu de données par défaut du modèle d'audit de livraison issu du fichier prototype HTML sous format JSON

## 2. Services et Logique Métier

- [ ] 2.1 Implémenter le service de gestion des modèles (`TemplateService`) avec chargement, validation et modèle par défaut
- [ ] 2.2 Implémenter le service de gestion des sessions (`ChecklistSessionService`) avec calcul réactif des métriques (signaux Angular : taux de complétude, compteurs OK/KO/NA, filtrage)
- [ ] 2.3 Implémenter le service de capture et stockage des preuves (`EvidenceService`) supportant les Blobs et URLs d'objets
- [ ] 2.4 Implémenter le service d'export et import (`ExportService`) pour JSON, Excel et PDF

## 3. Composants d'Interface Utilisateur (Architecture 3 fichiers)

- [ ] 3.1 Créer le composant d'en-tête et sélecteur de modèle (`HeaderComponent` : `.html`, `.css`, `.ts`)
- [ ] 3.2 Créer le composant de synthèse et filtres (`AuditSummaryComponent` : `.html`, `.css`, `.ts`)
- [ ] 3.3 Créer le composant de ligne de contrôle (`ChecklistItemComponent` : `.html`, `.css`, `.ts`)
- [ ] 3.4 Créer le composant de section pliable (`ChecklistSectionComponent` : `.html`, `.css`, `.ts`)
- [ ] 3.5 Créer le composant modal/popover de gestion des preuves universelles (`EvidenceAttachmentComponent` : `.html`, `.css`, `.ts`) avec support du `Ctrl+V` et glisser-déposer
- [ ] 3.6 Assembler l'écran principal dans `AppComponent` et tester la complétude du flux d'audit

## 4. Tests et Validation

- [ ] 4.1 Valider le rechargement de page et la persistance IndexedDB sans perte de données
- [ ] 4.2 Valider l'attachement d'une capture d'écran par Ctrl+V et sa restitution
- [ ] 4.3 Valider la conformité des exports JSON, Excel et PDF
- [ ] 4.4 Exécuter le build de production Angular (`pnpm build`)
