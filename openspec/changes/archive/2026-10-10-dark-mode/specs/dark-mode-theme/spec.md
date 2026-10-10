## ADDED Requirements

### Requirement: Bascule et persistance du thème d'affichage
Le système DOIT permettre à l'utilisateur de basculer à tout moment entre le thème clair et le thème sombre, et persister son choix dans le stockage local du navigateur.

#### Scenario: Bascule vers le thème sombre
- **WHEN** l'utilisateur clique sur le bouton de thème lorsque le thème clair est actif
- **THEN** l'interface applique immédiatement le thème sombre, l'icône de l'en-tête bascule sur le soleil (Lucide Sun), et la préférence est sauvegardée

#### Scenario: Bascule vers le thème clair
- **WHEN** l'utilisateur clique sur le bouton de thème lorsque le thème sombre est actif
- **THEN** l'interface applique immédiatement le thème clair, l'icône de l'en-tête bascule sur la lune (Lucide Moon), et la préférence est sauvegardée

#### Scenario: Respect du choix au rechargement
- **WHEN** l'utilisateur recharge la page
- **THEN** l'application restaure le dernier thème choisi (ou applique la préférence du système d'exploitation par défaut)
