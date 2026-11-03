// -----------------------------------------------------------------------------
// SDK wiring: every handler registered on the Gladys client, before connect().
// Kept out of index.js so the tests drive the real wiring against the SDK's
// fake Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { createLeaseService, WIDGET_KEY } from './lease-service.js';
import { createWidgets } from './widgets.js';
import { createSceneActions } from './scenes.js';
import { formatKm, summarize } from './format.js';

const logger = createLogger({ name: 'app' });

// The expected odometer and the days left move with time alone: recompute on
// this pace even when nothing else happens.
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export const MANIFEST_ACTIONS = ['record_reading', 'show_summary'];

export function registerHandlers(
  gladys,
  { now = () => new Date(), refreshIntervalMs = REFRESH_INTERVAL_MS } = {},
) {
  const service = createLeaseService(gladys, { now });
  const widgets = createWidgets(gladys, service);
  const sceneActions = createSceneActions(service);
  let timer = null;

  const refresh = () =>
    service.refresh().catch((err) => logger.error('Publishing the lease figures failed', err));

  gladys.onScanRequest(() => service.publishDevice());

  // Gladys drops the states of a feature that does not exist yet: once the
  // user creates the device, publish everything again.
  gladys.onDeviceCreated(() => service.refresh());

  gladys.onConfigUpdated(async (config) => {
    service.setConfig(config);
    await service.publishDevice();
    await service.refresh();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  // --- Configuration screen buttons -----------------------------------------
  gladys.onAction('record_reading', async (fields) => {
    const lease = await service.recordReading(fields.km);
    const summary = summarize(lease);
    return {
      en: `Reading recorded: ${formatKm(lease.odometer, 'en')}. ${summary.en}`,
      fr: `Relevé enregistré : ${formatKm(lease.odometer, 'fr')}. ${summary.fr}`,
    };
  });

  gladys.onAction('show_summary', async () => {
    const lease = service.lease();
    if (!lease) {
      const [error] = service.errors();
      throw new Error(`${error.fr} / ${error.en}`);
    }
    return summarize(lease);
  });

  // --- Scene actions & dashboard widget -------------------------------------
  for (const [key, handler] of Object.entries(sceneActions)) {
    gladys.onSceneAction(key, handler);
  }
  for (const [key, widget] of Object.entries(widgets)) {
    gladys.onWidgetGet(key, widget.get);
    gladys.onWidgetAction(key, widget.action);
  }

  // --- Lifecycle ------------------------------------------------------------
  gladys.on('connected', async () => {
    try {
      service.setConfig(await gladys.getConfig());
      await service.publishDevice();
      await service.refresh();
      // Nudges sent while the socket was down were dropped.
      gladys.requestWidgetRefresh(WIDGET_KEY);
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Initialization failed, check the integration logs.',
          fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        })
        .catch(() => {});
    }
    clearInterval(timer);
    timer = setInterval(refresh, refreshIntervalMs);
  });

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  gladys.on('disconnected', stop);

  return { service, sceneActions, widgets, stop };
}
