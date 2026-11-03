// -----------------------------------------------------------------------------
// Human-readable figures, in the two languages the integration speaks. Used by
// the action messages, the scene summary and the dashboard widget.
// -----------------------------------------------------------------------------

const LOCALES = { en: 'en-GB', fr: 'fr-FR' };

const locale = (language) => LOCALES[language] ?? LOCALES.en;

export function formatNumber(value, language) {
  return new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
}

export function formatKm(value, language) {
  return `${formatNumber(value, language)} km`;
}

export function formatSignedKm(value, language) {
  return `${value > 0 ? '+' : ''}${formatKm(value, language)}`;
}

export function formatEuro(value, language) {
  return new Intl.NumberFormat(locale(language), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatDate(date, language) {
  return new Intl.DateTimeFormat(locale(language), { dateStyle: 'long', timeZone: 'UTC' }).format(
    date,
  );
}

function summaryIn(lease, language) {
  const fr = language === 'fr';
  if (lease.odometer === null) {
    return fr
      ? `Compteur prévu aujourd'hui : ${formatKm(lease.expectedOdometer, language)}. Aucun relevé saisi.`
      : `Expected odometer today: ${formatKm(lease.expectedOdometer, language)}. No reading yet.`;
  }
  const parts = [
    fr
      ? `Compteur ${formatKm(lease.odometer, language)}, ${formatSignedKm(lease.kmDelta, language)} par rapport au prévu.`
      : `Odometer ${formatKm(lease.odometer, language)}, ${formatSignedKm(lease.kmDelta, language)} against the allowance.`,
  ];
  if (lease.projectedEndOdometer === null) {
    parts.push(
      fr
        ? 'Projection disponible après une semaine de contrat.'
        : 'Projection available after one week of contract.',
    );
  } else if (lease.projectedOverageKm > 0) {
    parts.push(
      fr
        ? `Projection : ${formatKm(lease.projectedEndOdometer, language)} en fin de contrat, soit ${formatKm(lease.projectedOverageKm, language)} de trop (${formatEuro(lease.projectedOverageCost, language)}).`
        : `Projection: ${formatKm(lease.projectedEndOdometer, language)} at the end, ${formatKm(lease.projectedOverageKm, language)} over (${formatEuro(lease.projectedOverageCost, language)}).`,
    );
  } else {
    parts.push(
      fr
        ? `Projection : ${formatKm(lease.projectedEndOdometer, language)} en fin de contrat, dans le forfait.`
        : `Projection: ${formatKm(lease.projectedEndOdometer, language)} at the end, within the allowance.`,
    );
  }
  if (lease.daysRemaining > 0) {
    parts.push(
      fr
        ? `Budget : ${formatKm(lease.monthlyBudgetKm, language)} par mois, ${formatNumber(lease.daysRemaining, language)} jours restants.`
        : `Budget: ${formatKm(lease.monthlyBudgetKm, language)} per month, ${formatNumber(lease.daysRemaining, language)} days left.`,
    );
  }
  return parts.join(' ');
}

/** One-paragraph summary of the lease, as a multi-language object. */
export function summarize(lease) {
  return { en: summaryIn(lease, 'en'), fr: summaryIn(lease, 'fr') };
}
