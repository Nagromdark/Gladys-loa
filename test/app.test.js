// The real wiring (src/app.js) against the SDK's fake Gladys: what Gladys
// receives on connection, on a reading, from the widget and the scenes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { registerHandlers } from '../src/app.js';
import { FEATURE } from '../src/vehicle.js';

const CONTRACT = {
  vehicle_name: 'Peugeot 308',
  contract_start: '2025-01-01',
  duration_months: 36,
  allowance_km: 60000,
  start_km: 10,
  extra_km_price: 0.1,
};
const NOW = new Date('2026-01-01T00:00:00Z'); // one year in

async function setup(t, config = CONTRACT) {
  const gladys = createFakeGladys({ config });
  const app = registerHandlers(gladys, { now: () => NOW });
  await gladys.connect();
  t.after(async () => {
    await gladys.disconnect();
    app.stop();
  });
  const feature = (key) => gladys.externalIds('lease', 'contract-1').feature(key);
  return { gladys, app, feature };
}

test('publishes the vehicle device and the time-based figures on connection', async (t) => {
  const { gladys, feature } = await setup(t);
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Peugeot 308 (LOA)');
  assert.equal(device.features.length, 9);
  assert.equal(gladys.fake.lastState(feature(FEATURE.EXPECTED_ODOMETER)), 20010);
  assert.equal(gladys.fake.lastState(feature(FEATURE.DAYS_REMAINING)), 730);
  // Nothing published for the figures that need a reading.
  assert.equal(gladys.fake.lastState(feature(FEATURE.ODOMETER)), undefined);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(gladys.fake.widgetRefreshes.includes('lease_status'));
});

test('an unconfigured contract reports why in the Configuration screen', async (t) => {
  const { gladys } = await setup(t, {});
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /date de début/);
  assert.equal(gladys.fake.states.length, 0);

  const ack = await gladys.fake.action('record_reading', { km: 1000 });
  assert.equal(ack.success, false);
});

test('the record_reading action stores the reading and publishes the figures', async (t) => {
  const { gladys, feature } = await setup(t);
  const ack = await gladys.fake.action('record_reading', { km: 25010 });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /Relevé enregistré : 25\u202f010 km/);
  assert.match(ack.data.message.fr, /15\u202f000 km de trop/);

  assert.equal(gladys.fake.config.last_reading_km, 25010);
  assert.equal(gladys.fake.config.last_reading_at, NOW.toISOString());
  assert.equal(gladys.fake.lastState(feature(FEATURE.ODOMETER)), 25010);
  assert.equal(gladys.fake.lastState(feature(FEATURE.KM_DELTA)), 5000);
  assert.equal(gladys.fake.lastState(feature(FEATURE.PROJECTED_END_ODOMETER)), 75010);
  assert.equal(gladys.fake.lastState(feature(FEATURE.PROJECTED_OVERAGE_COST)), 1500);
});

test('an impossible reading is refused with a bilingual message', async (t) => {
  const { gladys } = await setup(t);
  const ack = await gladys.fake.action('record_reading', { km: 5 });
  assert.equal(ack.success, false);
  assert.match(ack.error, /inférieur au compteur à la livraison/);
  assert.match(ack.error, /below the odometer at delivery/);
  assert.equal(gladys.fake.config.last_reading_km, undefined);
});

test('the stored reading survives a restart and a form save without it', async (t) => {
  const { gladys, app } = await setup(t, {
    ...CONTRACT,
    last_reading_km: 20010,
    last_reading_at: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(app.service.lease().kmDelta, 0);

  // The user changes the price; the event carries only the schema fields.
  await gladys.fake.configUpdated({ ...CONTRACT, extra_km_price: 0.2 });
  assert.equal(app.service.config.extra_km_price, 0.2);
  assert.equal(app.service.config.reading.km, 20010);
});

test('the figures are published again once the user creates the device', async (t) => {
  const { gladys, feature } = await setup(t);
  await gladys.fake.action('record_reading', { km: 20010 });
  const [device] = gladys.fake.discoveredDevices;
  const before = gladys.fake.states.length;
  await gladys.fake.deviceCreated(device);
  const republished = gladys.fake.states.slice(before).map((s) => s.device_feature_external_id);
  assert.ok(republished.includes(feature(FEATURE.ODOMETER)));
});

test('show_summary answers in both languages', async (t) => {
  const { gladys } = await setup(t);
  const ack = await gladys.fake.action('show_summary', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /Aucun relevé saisi/);
  assert.match(ack.data.message.en, /No reading yet/);
});

test('the widget content is valid, before and after a reading', async (t) => {
  const { gladys } = await setup(t);
  for (const language of ['fr', 'en']) {
    const ack = await gladys.fake.widgetGet('lease_status', { settings: {}, language });
    assert.equal(ack.success, true);
    assert.deepEqual(validateWidgetContent(ack.data.content), []);
  }
  await gladys.fake.action('record_reading', { km: 25010 });
  const ack = await gladys.fake.widgetGet('lease_status', { settings: {}, language: 'fr' });
  const { components } = ack.data.content;
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.equal(components.find((c) => c.type === 'gauge').color, 'warning');
  const button = components.find((c) => c.type === 'button');
  assert.equal(button.action.fields[0].default, 25010);
});

test('the widget content stays valid while the contract is not configured', async (t) => {
  const { gladys } = await setup(t, {});
  const ack = await gladys.fake.widgetGet('lease_status', { settings: {}, language: 'fr' });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
});

test('the widget button records a reading', async (t) => {
  const { gladys, feature } = await setup(t);
  const ack = await gladys.fake.widgetAction(
    'lease_status',
    'record_reading',
    {},
    { settings: {}, values: { km: 21000 } },
  );
  assert.equal(ack.success, true);
  assert.equal(gladys.fake.lastState(feature(FEATURE.ODOMETER)), 21000);

  const withoutValues = await gladys.fake.widgetAction('lease_status', 'record_reading', {}, {});
  assert.equal(withoutValues.success, false);
});

test('scene actions record a reading and return the figures as outputs', async (t) => {
  const { gladys } = await setup(t);
  const before = await gladys.fake.sceneAction('get_summary', { language: 'fr' });
  assert.equal(before.success, true);
  assert.equal(before.data.outputs.odometer, -1);
  assert.equal(before.data.outputs.expected_odometer, 20010);

  const ack = await gladys.fake.sceneAction('record_reading', { km: 25010, language: 'en' });
  assert.equal(ack.success, true);
  assert.equal(ack.data.outputs.projected_overage_km, 15000);
  assert.equal(ack.data.outputs.projected_overage_cost, 1500);
  assert.match(ack.data.outputs.summary, /15,000 km over/);
});
