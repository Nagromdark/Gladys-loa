# LOA — car lease mileage

Your car is leased (LOA or LLD in France) with a mileage allowance: this
integration tells you at any time whether you drive too much, what the
odometer will read at the end of the contract at your current pace, and what
the extra kilometres would cost when you return the car.

## What you get

A **"<vehicle name> (LOA)"** device in the **Discovery** tab, with these
values:

| Value                              | Meaning                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Compteur kilométrique              | the last reading you entered                                              |
| Compteur prévu à date              | what the odometer should read today if the allowance were spread evenly   |
| Écart avec le prévu                | reading − expected at the reading date; **positive = you drive too much** |
| Km restants au forfait             | allowance − distance driven; negative once the allowance is exceeded      |
| Budget km par mois                 | what you can still drive each month to end exactly within the allowance   |
| Compteur projeté en fin de contrat | the final odometer if you keep your current pace                          |
| Dépassement projeté                | the kilometres over the allowance in that projection                      |
| Surcoût projeté                    | projected extra kilometres × price per extra kilometre                    |
| Jours restants                     | days until the end of the contract                                        |

The feature names are in French (LOA is a French contract); rename them in
Gladys if you like. Every value keeps its history, so you can chart it on a
dashboard.

The projection only appears after one week of contract: before that, a
single long trip would distort it completely.

## Configuration

1. Open the **Configuration** tab of the integration and copy your contract:
   - **Contract start**: the delivery date, as `YYYY-MM-DD` (e.g.
     `2025-03-15`);
   - **Duration** in months (36 for 3 years);
   - **Mileage allowance** for the **whole** contract (60,000 km for 3 years
     at 20,000 km/year);
   - **Odometer at delivery** (often a few kilometres);
   - **Price per extra km**, from the contract terms.
2. Save, then add the device from the **Discovery** tab.
3. Record a first odometer reading (see below).

While something is missing, the Configuration screen says what to fix.

## Recording the odometer

Three ways:

- **Configuration screen**: the **Record the odometer** button. The summary
  shows under the button.
- **Dashboard**: add the **Car lease** widget; its **New reading** button
  opens a small form, pre-filled with the last reading.
- **Scene**: the **Record the leased car odometer** action. Handy when your
  car is connected and another Gladys integration already reads its
  odometer: a daily scene can pass that value on.

A reading a week or a month is enough: the projection uses the average pace
since the delivery. A reading lower than the previous one is accepted (fixing
a typo).

## Scene examples

- **Overage alert**: "device value" trigger on **Surcoût projeté** above 0 →
  send a message.
- **Return reminder**: trigger on **Jours restants** below 90 → "book the
  return inspection".
- **Monthly summary**: scheduled trigger on the 1st of the month → **Get the
  lease summary** action → send a message containing its **Summary**
  variable.
- **Reading reminder**: scheduled trigger every Sunday → "read the car
  odometer".

## The computation

```
expected(date)    = odometer at delivery + allowance × (days elapsed / contract days)
delta             = reading − expected(reading date)
pace              = distance driven / days elapsed at the reading date
projected         = odometer at delivery + pace × contract days
projected cost    = max(0, projected distance − allowance) × price per extra km
budget per month  = km left / months left (all of it during the last month)
```

The contract ends on the start date plus the duration in months (a contract
started on 31 January ends on the last day of the target month).

## Troubleshooting

Read the integration logs from the Gladys UI (or `docker logs` on the host),
with `LOG_LEVEL=debug` for the full detail.
