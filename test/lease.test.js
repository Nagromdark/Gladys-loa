import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, computeLease, MIN_PROJECTION_DAYS, parseDate } from '../src/lease.js';
import { normalizeConfig, validateConfig } from '../src/config.js';

// The contract of the README: 36 months, 60 000 km, delivered at 10 km.
const config = normalizeConfig({
  contract_start: '2025-01-01',
  duration_months: 36,
  allowance_km: 60000,
  start_km: 10,
  extra_km_price: 0.1,
});
const at = (iso) => new Date(iso);

test('parseDate reads YYYY-MM-DD as UTC midnight and refuses impossible dates', () => {
  assert.equal(parseDate('2025-03-15').toISOString(), '2025-03-15T00:00:00.000Z');
  assert.equal(parseDate(' 2025-03-15 ').toISOString(), '2025-03-15T00:00:00.000Z');
  assert.equal(parseDate('2025-02-30'), null);
  assert.equal(parseDate('15/03/2025'), null);
  assert.equal(parseDate(''), null);
  assert.equal(parseDate(undefined), null);
});

test('addMonths clamps the day to the end of the target month', () => {
  assert.equal(addMonths(parseDate('2025-01-31'), 1).toISOString(), '2025-02-28T00:00:00.000Z');
  assert.equal(addMonths(parseDate('2024-01-31'), 1).toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(addMonths(parseDate('2025-01-01'), 36).toISOString(), '2028-01-01T00:00:00.000Z');
});

test('without a reading, only the time-based figures are computed', () => {
  const lease = computeLease(config, null, at('2026-07-02T00:00:00Z'));
  // 2025-01-01 -> 2028-01-01 is 1095 days; 547 days elapsed.
  assert.equal(lease.totalDays, 1095);
  assert.equal(lease.daysRemaining, 548);
  assert.equal(lease.expectedOdometer, Math.round(10 + (60000 * 547) / 1095));
  assert.equal(lease.odometer, null);
  assert.equal(lease.kmDelta, null);
  assert.equal(lease.projectedEndOdometer, null);
});

test('a car driven exactly at the allowance pace projects no extra cost', () => {
  const readingAt = at('2026-01-01T00:00:00Z'); // 365 days in
  const km = 10 + 20000;
  const lease = computeLease(config, { km, at: readingAt }, readingAt);
  assert.equal(lease.kmDelta, 0);
  assert.equal(lease.drivenKm, 20000);
  assert.equal(lease.remainingKm, 40000);
  assert.equal(lease.projectedEndOdometer, 60010);
  assert.equal(lease.projectedOverageKm, 0);
  assert.equal(lease.projectedOverageCost, 0);
  // 730 days left = 23.98 months.
  assert.equal(lease.monthlyBudgetKm, Math.round(40000 / (730 / 30.4375)));
});

test('a car driving 25 % too much projects the overage and its cost', () => {
  const readingAt = at('2026-01-01T00:00:00Z');
  const lease = computeLease(config, { km: 10 + 25000, at: readingAt }, readingAt);
  assert.equal(lease.kmDelta, 5000);
  assert.equal(lease.projectedEndOdometer, 75010);
  assert.equal(lease.projectedOverageKm, 15000);
  assert.equal(lease.projectedOverageCost, 1500);
});

test('the delta is computed at the reading date, not today', () => {
  const readingAt = at('2026-01-01T00:00:00Z');
  const lease = computeLease(config, { km: 20010, at: readingAt }, at('2026-07-01T00:00:00Z'));
  assert.equal(lease.kmDelta, 0);
  assert.ok(lease.expectedOdometer > 20010);
});

test('no projection during the first week', () => {
  const readingAt = new Date(parseDate('2025-01-01').getTime() + (MIN_PROJECTION_DAYS - 1) * 864e5);
  const lease = computeLease(config, { km: 1500, at: readingAt }, readingAt);
  assert.equal(lease.projectedEndOdometer, null);
  assert.equal(lease.projectedOverageCost, null);
  assert.notEqual(lease.kmDelta, null);
});

test('a reading after the end of the contract is the final mileage', () => {
  const readingAt = at('2028-02-01T00:00:00Z');
  const lease = computeLease(config, { km: 62010, at: readingAt }, readingAt);
  assert.equal(lease.daysRemaining, 0);
  assert.equal(lease.projectedEndOdometer, 62010);
  assert.equal(lease.projectedOverageKm, 2000);
  assert.equal(lease.projectedOverageCost, 200);
  assert.equal(lease.remainingKm, -2000);
  assert.equal(lease.monthlyBudgetKm, 0);
});

test('during the last month, the whole remainder is the monthly budget', () => {
  const readingAt = at('2027-12-20T00:00:00Z');
  const lease = computeLease(config, { km: 59010, at: readingAt }, readingAt);
  assert.equal(lease.daysRemaining, 12);
  assert.equal(lease.monthlyBudgetKm, 1000);
});

test('normalizeConfig accepts form strings and decimal commas', () => {
  const normalized = normalizeConfig({
    contract_start: '2025-01-01',
    duration_months: '36',
    allowance_km: '60000',
    start_km: '',
    extra_km_price: '0,12',
    last_reading_km: '12000',
    last_reading_at: '2025-06-01T08:00:00.000Z',
  });
  assert.equal(normalized.duration_months, 36);
  assert.equal(normalized.start_km, 0);
  assert.equal(normalized.extra_km_price, 0.12);
  assert.equal(normalized.vehicle_name, 'Ma voiture');
  assert.deepEqual(normalized.reading, { km: 12000, at: at('2025-06-01T08:00:00.000Z') });
  assert.deepEqual(validateConfig(normalized), []);
});

test('validateConfig explains what is missing', () => {
  const errors = validateConfig(normalizeConfig({ allowance_km: 0 }));
  assert.equal(errors.length, 2);
  assert.match(errors[0].fr, /date de début/);
  assert.match(errors[1].en, /allowance/);
});
