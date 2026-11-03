// -----------------------------------------------------------------------------
// Integration configuration.
//
// The user fills the contract in the Configuration screen, from the
// `config_schema` of `gladys-assistant-integration.json`. This module provides
// the defaults, normalizes the received object (form values may arrive as
// strings) and says what is missing before any computation runs.
//
// The last odometer reading is stored in the same configuration, under keys
// that are NOT in the config_schema (`last_reading_km`, `last_reading_at`):
// the SDK documents those as free internal storage, never shown in the form.
// -----------------------------------------------------------------------------

import { parseDate } from './lease.js';

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  vehicle_name: 'Ma voiture',
  contract_start: '',
  duration_months: 36,
  allowance_km: 60000,
  start_km: 0,
  // Required in the manifest, without a default: every contract has its own.
  extra_km_price: 0,
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
};

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const lastKm = toNumber(raw.last_reading_km, null);
  const lastAt = typeof raw.last_reading_at === 'string' ? new Date(raw.last_reading_at) : null;
  return {
    vehicle_name:
      typeof raw.vehicle_name === 'string' && raw.vehicle_name.trim() !== ''
        ? raw.vehicle_name.trim()
        : DEFAULT_CONFIG.vehicle_name,
    contract_start: typeof raw.contract_start === 'string' ? raw.contract_start.trim() : '',
    duration_months: Math.round(toNumber(raw.duration_months, DEFAULT_CONFIG.duration_months)),
    allowance_km: Math.round(toNumber(raw.allowance_km, DEFAULT_CONFIG.allowance_km)),
    start_km: Math.round(toNumber(raw.start_km, DEFAULT_CONFIG.start_km)),
    extra_km_price: toNumber(raw.extra_km_price, DEFAULT_CONFIG.extra_km_price),
    reading:
      lastKm !== null && lastAt && !Number.isNaN(lastAt.getTime())
        ? { km: Math.round(lastKm), at: lastAt }
        : null,
  };
}

/**
 * What prevents the computation, as multi-language messages (shown in the
 * Configuration screen through setConnectionStatus). Empty when usable.
 */
export function validateConfig(config) {
  const errors = [];
  if (parseDate(config.contract_start) === null) {
    errors.push({
      en: 'Enter the contract start date (YYYY-MM-DD).',
      fr: 'Renseignez la date de début du contrat (AAAA-MM-JJ).',
    });
  }
  if (!(config.duration_months >= 1)) {
    errors.push({
      en: 'The contract duration must be at least one month.',
      fr: "La durée du contrat doit être d'au moins un mois.",
    });
  }
  if (!(config.allowance_km > 0)) {
    errors.push({
      en: 'The mileage allowance must be greater than zero.',
      fr: 'Le kilométrage prévu au contrat doit être supérieur à zéro.',
    });
  }
  if (!(config.start_km >= 0)) {
    errors.push({
      en: 'The odometer at delivery cannot be negative.',
      fr: 'Le compteur à la livraison ne peut pas être négatif.',
    });
  }
  if (!(config.extra_km_price >= 0)) {
    errors.push({
      en: 'The price per extra kilometre cannot be negative.',
      fr: 'Le prix du kilomètre supplémentaire ne peut pas être négatif.',
    });
  }
  return errors;
}
