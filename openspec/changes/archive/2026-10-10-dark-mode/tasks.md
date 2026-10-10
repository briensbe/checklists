## 1. Implémentation du ThemeService et Variables CSS

- [x] 1.1 Définir les variables CSS sombres dans `src/styles.css` sous `[data-theme="dark"]`
- [x] 1.2 Créer le service `ThemeService` (`src/app/services/theme.service.ts`) avec détection système et persistance `localStorage`
- [x] 1.3 Réajuster les contrastes des variables CSS de statut (chips OK/KO/NA, pilules et bouton batch) en mode sombre
- [x] 1.4 Corriger la visibilité des boutons d'actions du Header en mode sombre

## 2. Intégration dans l'En-tête et Validation

- [x] 2.1 Ajouter le bouton rond discret avec les icônes Lucide Sun et Lucide Moon dans `HeaderComponent` (.html, .css, .ts)
- [x] 2.2 Valider la bascule de thème et le build de production (`pnpm build`)
