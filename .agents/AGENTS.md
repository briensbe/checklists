# Règles de codage, d'architecture et de sécurité du projet

## Sécurité & Clés API / Identifiants
- **Règle :** Ne JAMAIS écrire, coder en dur ou insérer de variables d'environnement de type clé d'API, token ou secret directement dans les fichiers de code source ou les scripts (scripts de test, migrations, utilitaires).
- **Action :** Importer et utiliser systématiquement la configuration dynamique issue des fichiers d'environnement dédiés (ex: `src/environments/environment.ts`, `environment.prod.ts` ou fichiers `.env`).

## Package Manager & Build
- Utiliser systématiquement `pnpm` plutôt que `npm`.
- Commande de build : `pnpm build` (ou `pnpm run build`).

## Angular & TypeScript
- Angular avec composants autonomes (`standalone: true`).
- Syntaxe de contrôle de flux native Angular obligatoire (`@if`, `@for`, `@switch`). Directives structurelles (`*ngIf`, `*ngFor`) proscrites.
- Typages stricts obligatoires (`strict: true`, aucun `any` non justifié).
- Toujours utiliser la structure séparée en 3 fichiers : `.html`, `.css` et `.ts`.

## Supabase / PostgreSQL & Pagination
- **Plafond PostgREST 1000 :** Toujours paginer via `.range()` avec `paginateQuery` pour les requêtes dépassant 1000 enregistrements.
- **Tri déterministe (Tie-Breaker) :** Ajouter obligatoirement `.order('id', { ascending: true })` AVANT tout `.range()`.
- **Zéro secret en dur :** Importer exclusivement les configurations depuis `src/environments/environment.ts` ou `.env`.


## Documentation & Liens Markdown
- Ne JAMAIS insérer de chemins de fichiers absolus (ex: `file:///c:/...` ou `C:\...`) dans les fichiers Markdown.
- Utiliser systématiquement des chemins relatifs par rapport à la racine du projet ou au fichier courant.

## Spécifications & OpenSpec
- **Langue :** Tous les artefacts OpenSpec (`proposal.md`, `specs/**/*.md`, `design.md`, `adr.md`, `tasks.md`) ainsi que la documentation technique doivent être obligatoirement rédigés en français.
- **Structure OpenSpec :** Conserver les mots-clés et titres de sections structurels requis par le validateur OpenSpec (`## Why`, `## What Changes`, `## Capabilities`, `## Impact`, `## ADDED Requirements`, `### Requirement: ...`, `#### Scenario: ...`, `- **WHEN**`, `- **THEN**`, `- **GIVEN**`, `## Context`, `## Goals / Non-Goals`, `## Decisions`, `## Risks / Trade-offs`, `## Tasks`) tout en rédigeant l'intégralité du contenu, des explications, des critères et des tâches en langue française.

## Gestion du Versioning (.gitignore)
- **Règle :** Ne jamais commiter de fichiers de logs (`*.log`), de dossiers de compilation (`dist/`, `.angular/`), de fichiers de configuration de secrets (`.env*`, `environment.ts`) ou de caches temporaires Supabase (`supabase/.temp/`).
- **Action :** Initialiser systématiquement le projet avec le `.gitignore` standard incluant la protection des environnements et l'isolation des caches d'agents IA (`.claude/cache/`, `.bolt`, etc.).

### Règles de recherche et d'exploration de fichiers
- Utilise systématiquement `rg` (ripgrep) pour rechercher du texte ou lister les fichiers d'un dossier.
- N'utilise JAMAIS les cmdlets PowerShell d'exploration ou de recherche (`Get-ChildItem`, `Select-String`, `dir`, `ls`, `gci`).
- Syntaxes courantes :
  - Lister les fichiers d'un dossier : `rg --files <chemin>`
  - Chercher du texte dans les fichiers : `rg "<motif>" <chemin>`
  - Filtrer par extensions de fichier : `rg -g "*.{ts,html}" "<motif>" <chemin>`
- Privilégie systématiquement les commandes atomiques SANS pipe (`|`), sans redirection ni chaînage (`&&`, `;`) pour respecter l'Allowlist du terminal.
- Pour filtrer les noms de fichiers avec `rg` : utilise `-g` (ex. `rg --files -g "*profile*" src/` et PAS `rg --files ... | rg ...`).
- Si `rg` n'est pas disponible, demande confirmation avant d'utiliser une alternative.