## Context

L'application Checklist & Audit dispose d'une identité visuelle claire conçue en CSS standard sans framework. L'objectif est d'étendre cette charte avec un mode sombre complet sans dénaturer la structure des composants.

## Goals / Non-Goals

**Goals:**
- Utiliser les variables CSS standard existantes (`--color-slate-*`, `--color-brand-*`, etc.) pour basculer le thème en appliquant un attribut `data-theme="dark"` sur l'élément `<html>`.
- Proposer un bouton rond discret dans l'en-tête affichant l'icône Lucide Moon (en mode clair) ou Lucide Sun (en mode sombre).
- Conserver la réactivité avec les signaux Angular (`signal`).

**Non-Goals:**
- Pas d'ajout de bibliothèques d'icônes lourdes : les tracés SVG Lucide sont intégrés directement dans le template pour une légèreté maximale.

## Decisions

- **Attribut `data-theme="dark"` sur `<html>`** : Permet une surcharge élégante et globale des variables CSS dans `src/styles.css`.
- **`ThemeService`** : Fournit un signal `isDarkMode()` et synchronise automatiquement le DOM et le `localStorage`.
