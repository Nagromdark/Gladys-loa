// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+), declared in the manifest `scene_actions`.
//
//   - record_reading: feed the odometer from a scene, e.g. the value another
//     integration reads from a connected car, every night;
//   - get_summary: the lease figures as scene variables plus a ready-made
//     sentence, e.g. for a monthly Telegram recap.
//
// Alerts need no scene TRIGGER of ours: the figures are device features, and
// the core's device-value trigger already covers "projected extra cost above
// 0 €" or "days left below 90". It also avoids firing an event as a
// consequence of a received action (a scene bound to it would loop).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { summarize } from './format.js';

const logger = createLogger({ name: 'scenes' });

// Outputs are scalars; a figure not computable yet is -1 rather than absent,
// so a scene condition on it never compares against an empty variable.
const orMinusOne = (value) => (value === null || value === undefined ? -1 : value);

function outputs(lease, language = 'fr') {
  return {
    odometer: orMinusOne(lease.odometer),
    expected_odometer: lease.expectedOdometer,
    km_delta: orMinusOne(lease.kmDelta),
    remaining_km: orMinusOne(lease.remainingKm),
    monthly_budget_km: orMinusOne(lease.monthlyBudgetKm),
    projected_end_odometer: orMinusOne(lease.projectedEndOdometer),
    projected_overage_km: orMinusOne(lease.projectedOverageKm),
    projected_overage_cost: orMinusOne(lease.projectedOverageCost),
    days_remaining: lease.daysRemaining,
    summary: summarize(lease)[language === 'en' ? 'en' : 'fr'],
  };
}

export function createSceneActions(service) {
  return {
    async record_reading(fields) {
      logger.info(`Scene action record_reading <- ${fields.km}`);
      const lease = await service.recordReading(fields.km);
      return outputs(lease, fields.language);
    },

    async get_summary(fields) {
      const lease = service.lease();
      if (!lease) {
        const [error] = service.errors();
        throw new Error(`${error.fr} / ${error.en}`);
      }
      return outputs(lease, fields.language);
    },
  };
}
