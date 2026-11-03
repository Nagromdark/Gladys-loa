# LOA — suivi du kilométrage

Votre voiture est en location (LOA ou LLD) avec un forfait kilométrique :
cette intégration vous dit, à tout moment, si vous roulez trop, combien de
kilomètres vous aurez au compteur en fin de contrat à ce rythme, et ce que le
dépassement vous coûterait à la restitution.

## Ce que vous obtenez

Un appareil **« <nom du véhicule> (LOA) »** dans l'onglet **Découverte**, avec
ces valeurs :

| Valeur                             | Sens                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Compteur kilométrique              | le dernier relevé saisi                                                                  |
| Compteur prévu à date              | ce que le compteur devrait afficher aujourd'hui si le forfait était réparti uniformément |
| Écart avec le prévu                | relevé − prévu à la date du relevé ; **positif = vous roulez trop**                      |
| Km restants au forfait             | forfait − km parcourus ; négatif une fois le forfait dépassé                             |
| Budget km par mois                 | ce que vous pouvez encore rouler chaque mois pour finir pile dans le forfait             |
| Compteur projeté en fin de contrat | le compteur en fin de contrat si vous gardez votre rythme actuel                         |
| Dépassement projeté                | les km au-delà du forfait selon cette projection                                         |
| Surcoût projeté                    | dépassement projeté × prix du km supplémentaire                                          |
| Jours restants                     | jusqu'à la fin du contrat                                                                |

Toutes gardent un historique : vous pouvez les afficher en graphique sur un
tableau de bord.

La projection n'apparaît qu'après une semaine de contrat : avant, un seul
long trajet la fausserait complètement.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration et recopiez votre
   contrat :
   - **Début du contrat** : la date de livraison, au format `AAAA-MM-JJ`
     (par exemple `2025-03-15`) ;
   - **Durée** en mois (36 pour 3 ans) ;
   - **Kilométrage prévu au contrat**, pour **toute** la durée (60 000 km
     pour 3 ans à 20 000 km/an) ;
   - **Compteur à la livraison** (souvent quelques kilomètres) ;
   - **Prix du km supplémentaire**, indiqué dans les conditions du contrat.
2. Enregistrez, puis ajoutez l'appareil depuis l'onglet **Découverte**.
3. Saisissez un premier relevé du compteur (voir ci-dessous).

Tant qu'une information manque, l'écran de configuration affiche ce qu'il
faut corriger.

## Saisir le compteur

Trois façons, au choix :

- **Écran de configuration** : bouton **Saisir le compteur**. Le bilan
  s'affiche sous le bouton.
- **Tableau de bord** : ajoutez le widget **LOA voiture** ; son bouton
  **Nouveau relevé** ouvre un petit formulaire, prérempli avec le dernier
  relevé.
- **Scène** : action **Enregistrer le compteur de la LOA**. Utile si votre
  voiture est connectée et qu'une autre intégration Gladys lit déjà son
  compteur : une scène quotidienne peut lire cette valeur et la transmettre
  ici.

Un relevé par semaine ou par mois suffit : la projection se fait sur le
rythme moyen depuis la livraison. Un relevé inférieur au précédent est
accepté (correction d'une faute de frappe).

## Exemples de scènes

- **Alerte dépassement** : déclencheur « Valeur d'un appareil » sur
  **Surcoût projeté** supérieur à 0 → envoyer un message.
- **Rappel de restitution** : déclencheur sur **Jours restants** inférieur à
  90 → message « Pensez à prendre rendez-vous pour l'état des lieux ».
- **Bilan mensuel** : déclencheur planifié le 1er du mois → action
  **Obtenir le bilan de la LOA** → envoyer un message contenant la variable
  **Bilan** de cette action.
- **Rappel de saisie** : déclencheur planifié chaque dimanche → message
  « Relevez le compteur de la voiture ».

## Le calcul

```
compteur prévu(date) = compteur livraison + forfait × (jours écoulés / jours du contrat)
écart                = relevé − compteur prévu(date du relevé)
rythme               = km parcourus / jours écoulés à la date du relevé
compteur projeté     = compteur livraison + rythme × jours du contrat
surcoût projeté      = max(0, km projetés − forfait) × prix du km supplémentaire
budget par mois      = km restants / mois restants (tout le reste pendant le dernier mois)
```

La fin du contrat est la date de début plus la durée en mois (un contrat
démarré un 31 janvier se termine le dernier jour du mois concerné).

## Dépannage

Consultez les logs de l'intégration depuis l'interface Gladys (ou
`docker logs` sur l'hôte), avec `LOG_LEVEL=debug` pour plus de détail.
