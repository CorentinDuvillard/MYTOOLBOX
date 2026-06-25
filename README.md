# Toolbox
Boîte à outils contenant toutes sortes d’outils utiles au quotidien. 

# Contexte général

Le projet contient des studios distincts en JSX et un index.html qui sert de vitrine/front d’accès.

# Détail des outils

1) Vision Studio
Rôle :
- éditeur visuel / image editor orienté composition sur canvas.

Ce que fait l’outil :
- gère un canvas de travail avec dimensions configurables ;
- importe des images ;
- crée et gère des calques ;
- permet d’ajouter du texte ;
- permet d’ajouter des formes simples (rectangle, cercle, ligne) ;
- permet déplacement, redimensionnement, rotation logique, flips, opacité ;
- expose des réglages d’image (luminosité, contraste, saturation) ;
- gère l’ordre des calques, la visibilité, la suppression, la duplication ;
- gère un historique undo/redo ;
- exporte en image (png/jpeg/webp selon le code) ;
- propose des templates de formats (story, carré, A4, miniature, etc.).

Structure technique :
- ce studio est écrit pour fonctionner directement dans un contexte React global chargé dans la page ;
- il s’appuie sur const { useState, ... } = React ;
- à la fin il expose explicitement le composant via window.ImageEditor = ImageEditor ;
- c’est donc le studio le plus “plug-and-play” dans le HTML actuel.

2) Record Studio
Rôle :
- enregistreur média navigateur.

Ce que fait l’outil :
- détecte les périphériques audio et vidéo ;
- permet de choisir un mode : audio, vidéo, audio+vidéo ;
- permet de choisir microphone et caméra ;
- ouvre un flux getUserMedia ;
- crée un MediaRecorder avec le meilleur mime type supporté ;
- gère démarrer / pause / reprise / arrêt ;
- accumule les chunks médias ;
- reconstruit un Blob final ;
- génère une URL locale de lecture ;
- permet prévisualisation puis téléchargement du média enregistré.

Structure technique :
- ce studio utilise une syntaxe module React moderne : import { useState... } from "react" ;
- le composant est exporté via export default function MediaRecorderApp() ;
- il n’est pas exposé sur window ;
- il n’est donc pas montable tel quel par le HTML actuel sans adaptation ;
- il faut soit :
  1. le transformer en composant global compatible Babel navigateur,
  2. soit faire évoluer l’index.html vers une approche module/bundler,
  3. soit créer un wrapper qui l’expose sur window.

3) PDF Studio
Rôle :
- éditeur PDF interactif.

Ce que fait l’outil :
- charge dynamiquement pdf.js, fabric.js et pdf-lib ;
- importe un PDF ;
- rend les pages en arrière-plan ;
- superpose un canvas Fabric pour l’annotation/édition ;
- permet sélection, texte, rectangle, ellipse, ligne, flèche, crayon, gomme ;
- stocke séparément les objets par page ;
- gère la navigation entre pages ;
- gère le zoom ;
- permet suppression et réordonnancement des objets ;
- réinjecte les annotations dans le PDF final exporté ;
- permet aussi la fusion de plusieurs PDF dans un document unique.

Structure technique :
- comme Record Studio, ce fichier est écrit en syntaxe module React moderne ;
- il utilise import { useState... } from "react" ;
- il exporte export default function PDFStudio() ;
- il n’est pas exposé sur window ;
- lui aussi nécessite un contrat d’intégration cohérent avant de pouvoir être injecté dans la vitrine HTML existante.

4) Archive Studio
Rôle :
- décompression d’archives .zip par lots, 100% locale.

Ce que fait l’outil :
- accepte plusieurs archives .zip d’un coup (glisser-déposer ou sélection) ;
- lit chaque archive avec JSZip, directement dans le navigateur ;
- affiche l’arborescence des fichiers (dossiers et fichiers, avec tailles) ;
- permet de télécharger un fichier précis, tous les fichiers d’une archive, ou tout d’un coup ;
- permet, sur les navigateurs compatibles, d’écrire directement les fichiers dans un dossier choisi (File System Access API) ;
- ne prend pas en charge .rar ni .7z.

Structure technique :
- contrairement aux autres studios, ce n’est pas un composant React mais une page HTML autonome (JS vanilla) ;
- elle charge JSZip depuis un CDN et partage la charte commune via `theme.css` ;
- elle est intégrée à la vitrine via un studio de type `iframe` (champ `type: "iframe"` dans le tableau STUDIOS d’index.html) ;
- aucune transpilation Babel ni exposition sur window n’est nécessaire : la page est montée telle quelle dans un cadre isolé.


## Architecture (relié mais indépendant)
- `index.html` est une **landing statique** : aucune lib lourde au premier rendu.
  React, ReactDOM, Babel et Tailwind ne sont chargés **qu’à l’ouverture** d’un
  studio (lazy load), puis mis en cache.
- Chaque outil est **autonome** : si l’un échoue à charger, la vitrine et les
  autres restent fonctionnels (chargement indépendant, erreurs isolées).
- Le **socle commun** est `theme.css` : il centralise toutes les couleurs, la
  typographie et les espacements. La config Tailwind (dans `index.html`) mappe
  les couleurs des studios sur ces mêmes variables.


## Contraintes UI / Charte graphique
La vitrine et tous les outils suivent une charte :
- lisse, propre, minimaliste, premium mais sobre ;
- **fond blanc**, **texte & éléments noirs**, **accent rouge** (boutons d’action,
  liens actifs, alertes, états importants) ;
- couleurs centralisées dans `theme.css` (modifiables en un seul endroit).

# Palette (voir theme.css)
--bg:#ffffff;            /* fond */
--text:#141414;          /* texte & éléments principaux (noir) */
--muted:#5f5f66;         /* texte secondaire */
--faint:#71717a;         /* texte tertiaire */
--line:#e4e4e7;          /* bordures */
--surface-2:#f5f5f6;     /* surfaces secondaires */
--accent:#e10b0b;        /* accent rouge (actions, états) */
--accent-hover:#c10808;  /* survol/accent foncé */
