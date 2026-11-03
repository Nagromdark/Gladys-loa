// -----------------------------------------------------------------------------
// The integration state and its operations, shared by every surface (manifest
// action, dashboard widget, scene actions, timer): the current config, the
// last reading, and what to publish when either changes.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, validateConfig } from './config.js';
import { computeLease } from './lease.js';
import { buildDevice, buildStates } from './vehicle.js';
import { formatKm } from './format.js';

const logger = createLogger({ name: 'lease' });

// An unchanged figure is still re-sent this often, so it stays recently dated
// in Gladys (the expected odometer moves daily, the others only on a reading).
const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

// Above this, a typed reading is a typo (an extra zero), not a mileage.
const MAX_READING_KM = 2000000;

export const WIDGET_KEY = 'lease_status';

// A thrown error reaches the user as a plain string (under the button, in the
// scene log): carry both languages.
function userError({ en, fr }) {
  return new Error(`${fr} / ${en}`);
}

export function createLeaseService(gladys, { now = () => new Date() } = {}) {
  let config = normalizeConfig();
  let lastStatusKey = null;

  async function reportStatus(error) {
    // Only on change: refresh() runs every hour.
    const key = error ? error.en : 'ok';
    if (key === lastStatusKey) {
      return;
    }
    await gladys.setConnectionStatus(!error, error ?? undefined);
    lastStatusKey = key;
  }

  const service = {
    get config() {
      return config;
    },

    /** Errors preventing the computation (empty when configured). */
    errors() {
      return validateConfig(config);
    },

    /** The current figures, or null while the contract is not configured. */
    lease() {
      return service.errors().length === 0 ? computeLease(config, config.reading, now()) : null;
    },

    /**
     * Take a new configuration. A config event without the reading keys (a
     * form save that only carries the schema fields) keeps the known reading.
     */
    setConfig(raw) {
      const next = normalizeConfig(raw);
      config = { ...next, reading: next.reading ?? config.reading };
    },

    async publishDevice() {
      await gladys.publishDiscoveredDevices([buildDevice(gladys, config)]);
    },

    /** Recompute and publish the figures that changed. */
    async refresh() {
      const [error] = service.errors();
      if (error) {
        logger.warn(`Contract not configured: ${error.en}`);
        await reportStatus(error);
        return null;
      }
      const lease = service.lease();
      await gladys.publishChangedStates(buildStates(gladys, lease), {
        heartbeat: STATE_HEARTBEAT_MS,
      });
      await reportStatus(null);
      return lease;
    },

    /**
     * Record an odometer reading typed by the user or sent by a scene.
     * Throws a user-facing error (shown under the button / in the scene log)
     * on an impossible value.
     */
    async recordReading(rawKm) {
      const [error] = service.errors();
      if (error) {
        throw userError(error);
      }
      const km = Math.round(Number(String(rawKm ?? '').replace(',', '.')));
      if (!Number.isFinite(km) || String(rawKm ?? '').trim() === '') {
        throw userError({ en: 'Invalid mileage.', fr: 'Kilométrage invalide.' });
      }
      if (km < config.start_km) {
        throw userError({
          en: `The reading (${formatKm(km, 'en')}) is below the odometer at delivery (${formatKm(config.start_km, 'en')}).`,
          fr: `Le relevé (${formatKm(km, 'fr')}) est inférieur au compteur à la livraison (${formatKm(config.start_km, 'fr')}).`,
        });
      }
      if (km > MAX_READING_KM) {
        throw userError({
          en: `Unlikely reading: ${formatKm(km, 'en')}.`,
          fr: `Relevé improbable : ${formatKm(km, 'fr')}.`,
        });
      }
      if (config.reading && km < config.reading.km) {
        // A correction of a mistyped reading is legitimate: accept, but say so.
        logger.warn(`Reading ${km} km is lower than the previous one (${config.reading.km} km)`);
      }
      const reading = { km, at: now() };
      config = { ...config, reading };
      await gladys.setConfig({ last_reading_km: km, last_reading_at: reading.at.toISOString() });
      logger.info(`Reading recorded: ${km} km`);
      const lease = await service.refresh();
      gladys.requestWidgetRefresh(WIDGET_KEY);
      return lease;
    },
  };
  return service;
}
