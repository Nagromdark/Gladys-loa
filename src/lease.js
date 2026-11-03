// -----------------------------------------------------------------------------
// The lease arithmetic, with no Gladys in it: config + last reading + now in,
// figures out. Everything else in the integration only publishes them.
//
// The allowance is spread evenly over the contract: on day d of a contract of
// D days, the odometer "should" read start_km + allowance × d / D. The pace
// measured between the delivery and the last reading is extrapolated to the
// end of the contract to project the final mileage and the extra cost.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

// Average month length (365.25 / 12): converts the days left into months for
// the monthly budget without depending on which months remain.
const DAYS_PER_MONTH = 30.4375;

// Below this many days since the delivery, the measured pace is mostly noise
// (one long trip the first weekend would project 200 000 km): no projection.
export const MIN_PROJECTION_DAYS = 7;

/**
 * Parse a `YYYY-MM-DD` date as UTC midnight. Returns null when invalid,
 * including impossible days (2025-02-30).
 */
export function parseDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) {
    return null;
  }
  return date;
}

/**
 * Add calendar months, clamping the day to the end of the target month
 * (31 January + 1 month = 28 or 29 February), like lease contracts do.
 */
export function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Compute the lease figures.
 *
 * @param {object} config normalized config (see src/config.js), validated
 * @param {{ km: number, at: Date } | null} reading last odometer reading
 * @param {Date} now
 * @returns {object} the figures; the reading-based ones are null without a
 *   reading, the projection ones also within the first MIN_PROJECTION_DAYS
 */
export function computeLease(config, reading, now) {
  const start = parseDate(config.contract_start);
  const end = addMonths(start, config.duration_months);
  const durationMs = end - start;
  const fractionAt = (date) => clamp((date - start) / durationMs, 0, 1);
  const expectedOdometerAt = (date) => config.start_km + config.allowance_km * fractionAt(date);

  const daysRemaining = Math.max(0, Math.ceil((end - now) / DAY_MS));
  const result = {
    start,
    end,
    totalDays: Math.round(durationMs / DAY_MS),
    daysRemaining,
    timeElapsedPercent: round2(fractionAt(now) * 100),
    expectedOdometer: Math.round(expectedOdometerAt(now)),
    reading: reading ?? null,
    odometer: null,
    drivenKm: null,
    kmDelta: null,
    remainingKm: null,
    allowanceUsedPercent: null,
    monthlyBudgetKm: null,
    projectedEndOdometer: null,
    projectedOverageKm: null,
    projectedOverageCost: null,
  };
  if (!reading) {
    return result;
  }

  const drivenKm = reading.km - config.start_km;
  const remainingKm = config.allowance_km - drivenKm;
  Object.assign(result, {
    odometer: reading.km,
    drivenKm,
    // Compared at the READING date, not today: an old reading must not look
    // like the car stopped driving since.
    kmDelta: Math.round(reading.km - expectedOdometerAt(reading.at)),
    remainingKm,
    allowanceUsedPercent: round2((drivenKm / config.allowance_km) * 100),
    // During the last month, the whole remainder is this month's budget.
    monthlyBudgetKm:
      daysRemaining > 0
        ? Math.max(0, Math.round(remainingKm / Math.max(daysRemaining / DAYS_PER_MONTH, 1)))
        : 0,
  });

  const elapsedDays = (Math.min(reading.at, end) - start) / DAY_MS;
  if (elapsedDays >= MIN_PROJECTION_DAYS) {
    // A reading taken after the end is the final mileage, not a pace.
    const projectedDriven =
      reading.at >= end ? drivenKm : (drivenKm / elapsedDays) * (durationMs / DAY_MS);
    const projectedOverageKm = Math.max(0, Math.round(projectedDriven - config.allowance_km));
    Object.assign(result, {
      projectedEndOdometer: Math.round(config.start_km + projectedDriven),
      projectedOverageKm,
      projectedOverageCost: round2(projectedOverageKm * config.extra_km_price),
    });
  }
  return result;
}
