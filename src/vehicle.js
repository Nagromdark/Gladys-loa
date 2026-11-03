// -----------------------------------------------------------------------------
// The leased vehicle, as ONE Gladys device whose read-only features carry the
// lease figures. Being plain device features, they get history, charts, the
// standard dashboard widgets and the device-value scene triggers ("projected
// extra cost above 0 €") for free.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'lease';

// The integration follows a single contract and has no external platform to
// take an id from: the id is a constant. External ids are forever (history,
// scenes and dashboards are keyed on them): never derive it from the config.
const PLATFORM_ID = 'contract-1';

// Feature keys, also forever.
export const FEATURE = {
  ODOMETER: 'odometer',
  EXPECTED_ODOMETER: 'expected-odometer',
  KM_DELTA: 'km-delta',
  REMAINING_KM: 'remaining-km',
  MONTHLY_BUDGET_KM: 'monthly-budget-km',
  PROJECTED_END_ODOMETER: 'projected-end-odometer',
  PROJECTED_OVERAGE_KM: 'projected-overage-km',
  PROJECTED_OVERAGE_COST: 'projected-overage-cost',
  DAYS_REMAINING: 'days-remaining',
};

// Which figure of computeLease() each feature publishes.
const FEATURE_VALUES = {
  [FEATURE.ODOMETER]: 'odometer',
  [FEATURE.EXPECTED_ODOMETER]: 'expectedOdometer',
  [FEATURE.KM_DELTA]: 'kmDelta',
  [FEATURE.REMAINING_KM]: 'remainingKm',
  [FEATURE.MONTHLY_BUDGET_KM]: 'monthlyBudgetKm',
  [FEATURE.PROJECTED_END_ODOMETER]: 'projectedEndOdometer',
  [FEATURE.PROJECTED_OVERAGE_KM]: 'projectedOverageKm',
  [FEATURE.PROJECTED_OVERAGE_COST]: 'projectedOverageCost',
  [FEATURE.DAYS_REMAINING]: 'daysRemaining',
};

const MAX_KM = 2000000;

const sensor = (name, externalId, category, type, unit, min, max) => ({
  name,
  external_id: externalId,
  category,
  type,
  unit,
  min,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: true,
});

export function ids(gladys) {
  return gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);
}

export function featureExternalId(gladys, key) {
  return ids(gladys).feature(key);
}

export function buildDevice(gladys, config) {
  const { device, feature } = ids(gladys);
  const distance = (name, key, min = 0) =>
    sensor(
      name,
      feature(key),
      CATEGORIES.DISTANCE_SENSOR,
      TYPES.SENSOR.INTEGER,
      UNITS.KM,
      min,
      MAX_KM,
    );
  return {
    name: `${config.vehicle_name} (LOA)`,
    external_id: device,
    features: [
      sensor(
        'Compteur kilométrique',
        feature(FEATURE.ODOMETER),
        CATEGORIES.ELECTRICAL_VEHICLE_STATE,
        TYPES.ELECTRICAL_VEHICLE_STATE.ODOMETER,
        UNITS.KM,
        0,
        MAX_KM,
      ),
      distance('Compteur prévu à date', FEATURE.EXPECTED_ODOMETER),
      // Positive: ahead of the allowance (driving too much).
      distance('Écart avec le prévu', FEATURE.KM_DELTA, -MAX_KM),
      // Negative once the allowance is exceeded.
      distance('Km restants au forfait', FEATURE.REMAINING_KM, -MAX_KM),
      distance('Budget km par mois', FEATURE.MONTHLY_BUDGET_KM),
      distance('Compteur projeté en fin de contrat', FEATURE.PROJECTED_END_ODOMETER),
      distance('Dépassement projeté', FEATURE.PROJECTED_OVERAGE_KM),
      sensor(
        'Surcoût projeté',
        feature(FEATURE.PROJECTED_OVERAGE_COST),
        CATEGORIES.CURRENCY,
        TYPES.CURRENCY.DECIMAL,
        UNITS.EURO,
        0,
        1000000,
      ),
      sensor(
        'Jours restants',
        feature(FEATURE.DAYS_REMAINING),
        CATEGORIES.DURATION,
        TYPES.DURATION.INTEGER,
        UNITS.DAYS,
        0,
        10000,
      ),
    ],
  };
}

/**
 * The states to publish for a computeLease() result. Figures that cannot be
 * computed yet (no reading, projection too early) are left out rather than
 * published as a misleading 0.
 */
export function buildStates(gladys, lease) {
  return Object.entries(FEATURE_VALUES)
    .filter(([, figure]) => lease[figure] !== null && lease[figure] !== undefined)
    .map(([key, figure]) => ({
      device_feature_external_id: featureExternalId(gladys, key),
      state: lease[figure],
    }));
}
