## Why

Offrir un confort visuel optimal lors des audits nocturnes ou prolongés en permettant de basculer instantanément entre le thème clair et le thème sombre (Dark Mode) avec persistance de la préférence utilisateur.

## What Changes

- **Variables de thème Dark Mode** : Extension du fichier `src/styles.css` avec le sélecteur `[data-theme="dark"]` ou `.dark` redéfinissant les variables CSS standard de fond, texte, cartes et bordures.
- **Service de thème** : Création d'un `ThemeService` réactif gérant l'état du thème (`light` | `dark`), la détection de la préférence système (`prefers-color-scheme`) et la persistance locale dans `localStorage`.
- **Bouton de bascule dans l'en-tête** : Ajout dans `HeaderComponent` d'un bouton discret encadré rond avec les icônes vectorielles SVG Lucide Sun et Lucide Moon.

## Capabilities

### New Capabilities
- `dark-mode-theme`: Gestion du thème sombre (détection, bascule réactive, persistance et styles CSS standard adaptés).

### Modified Capabilities
<!-- Aucun préexistant -->

## Impact

- `src/styles.css` : Ajout des variables CSS adaptées pour le thème sombre.
- `src/app/components/header/` : Ajout du bouton d'action rond avec icônes Lucide Sun/Moon.
- `src/app/services/theme.service.ts` : Nouveau service Angular standalone pour le contrôle du thème.
