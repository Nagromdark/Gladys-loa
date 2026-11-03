# Gladys LOA — suivi du kilométrage d'une voiture en location

Intégration externe pour [Gladys Assistant](https://gladysassistant.com) qui
suit une voiture en **LOA / LLD** avec forfait kilométrique (par exemple 3 ans,
60 000 km) : écart avec le prévu, projection en fin de contrat, coût des
kilomètres en trop, budget mensuel restant.

Construite sur le SDK officiel
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
et la structure du template
[`integration-template-js`](https://github.com/GladysAssistant/integration-template-js)
(CI, release, Dockerfile, tests du manifest).

Documentation utilisateur : [`docs/fr.md`](docs/fr.md) ·
[`docs/en.md`](docs/en.md) (Gladys l'affiche depuis l'écran de configuration).

## Ce qu'elle apporte dans Gladys

- **Un appareil** « <véhicule> (LOA) » avec 9 valeurs historisées : compteur,
  compteur prévu à date, écart, km restants, budget par mois, compteur
  projeté, dépassement projeté, surcoût projeté, jours restants. Ces valeurs
  servent directement de déclencheurs de scène (« surcoût projeté > 0 € »).
- **Trois façons de saisir le compteur** : bouton dans l'écran de
  configuration, widget de tableau de bord avec formulaire, action de scène
  (pour relayer le compteur d'une voiture connectée lu par une autre
  intégration).
- **Un widget** `lease_status` : compteur, écart, projection, jours restants
  (en direct), jauge du forfait consommé, surcoût projeté, fin de contrat.
- **Une action de scène** `get_summary` qui renvoie les chiffres et une phrase
  de bilan, pour un message mensuel.

## Le calcul

```
compteur prévu(date) = compteur livraison + forfait × jours écoulés / jours du contrat
écart                = relevé − compteur prévu(date du relevé)
compteur projeté     = compteur livraison + (km parcourus / jours écoulés) × jours du contrat
surcoût projeté      = max(0, km projetés − forfait) × prix du km supplémentaire
```

Pas de projection pendant les 7 premiers jours (trop bruitée). Tout le calcul
est dans [`src/lease.js`](src/lease.js), sans dépendance à Gladys.

## Structure

```
index.js                 démarrage : SDK + registerHandlers + connect
src/app.js               branchement de tous les handlers du SDK
src/lease-service.js     état (config, dernier relevé) et publication des valeurs
src/lease.js             le calcul du contrat (pur, testé)
src/vehicle.js           l'appareil Gladys et ses features
src/widgets.js           widget de tableau de bord
src/scenes.js            actions de scène
src/format.js            nombres, dates et bilan en français / anglais
src/config.js            valeurs par défaut, normalisation, validation
gladys-assistant-integration.json   le manifest
docs/fr.md, docs/en.md   documentation utilisateur (obligatoire)
test/                    node --test, contre le faux Gladys du SDK
```

Le dernier relevé est stocké dans la configuration de l'intégration (clés
`last_reading_km` / `last_reading_at`, hors `config_schema`) : il survit aux
redémarrages sans volume à gérer.

## Développement

```bash
npm install
npm test              # node --test
npm run lint          # ESLint
npm run format:check  # Prettier
npx github:GladysAssistant/integration-store .   # validation du store
```

Lancer en local contre un Gladys :

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="<selector>" \
LOG_LEVEL=debug npm start
```

## Publier

1. Ajouter le topic GitHub `gladys-assistant-integration` au dépôt, et le
   rendre public.
2. Décrire les changements sous `## [Unreleased]` dans
   [`CHANGELOG.md`](CHANGELOG.md), puis **Actions → Release → Run workflow**
   (`patch`, `minor` ou `major`) : le workflow met à jour la version partout,
   pousse le tag, construit l'image `ghcr.io/nagromdark/gladys-loa`
   (amd64 + arm64) et publie la release GitHub.
3. Rendre public le paquet ghcr.io (Packages → gladys-loa → Package
   settings), sinon Gladys ne pourra pas télécharger l'image.
4. L'indexeur du store détecte la nouvelle version : l'intégration
   s'installe en un clic depuis Gladys.

Pour tester avant publication : **Actions → Build and publish image → Run
workflow** sur une branche, puis coller le manifest affiché dans le résumé du
build dans **Intégrations → Installer une intégration → Mode développeur**.

## Licence

Apache-2.0
