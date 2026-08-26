/**
 * The homepage's two filters, as values rather than as UI.
 *
 * They live apart from the components because the page has to read them, the
 * chips have to link to them, and the metadata has to canonicalise them —
 * three callers, one spelling.
 */
import type { Locale } from '@/i18n/locales';
import type { Nusach } from '@/lib/taxonomy';
import { NUSACHIM } from '@/lib/taxonomy';
import type { Service } from '@/minyan-times';

/**
 * Four chips, in the artboard's own order.
 *
 * That order is Mincha first, which is not the order of the day and is
 * recorded here as drawn rather than tidied: the artboard shows מנחה / שחרית /
 * ערבית / שבת and this is an implementation of the artboard.
 *
 * `shabbat` is the odd one and honestly so — it is a day, not a service. It
 * filters on the `shabbat` column rather than on a service, which is exactly
 * what a person tapping it means: show me the Shabbat times.
 */
export const SERVICE_FILTERS = ['mincha', 'shacharit', 'arvit', 'shabbat'] as const;

export type ServiceFilter = (typeof SERVICE_FILTERS)[number];

export function isServiceFilter(value: unknown): value is ServiceFilter {
  return (SERVICE_FILTERS as readonly unknown[]).includes(value);
}

export function isNusach(value: unknown): value is Nusach {
  return (NUSACHIM as readonly unknown[]).includes(value);
}

/** The service a `ServiceFilter` selects, or null when it selects a day. */
export function serviceOf(filter: ServiceFilter): Service | null {
  return filter === 'shabbat' ? null : filter;
}

/**
 * The URL for a filtered homepage.
 *
 * `service` is always present and `nusach` only when set, so there is exactly
 * one URL per view — no `?nusach=` empty parameter, no two spellings of the
 * same page for a crawler to treat as duplicates.
 */
export function homeHref(
  locale: Locale,
  service: ServiceFilter,
  nusach: Nusach | null,
): string {
  const params = new URLSearchParams({ service });
  if (nusach) params.set('nusach', nusach);
  return `/${locale}?${params.toString()}`;
}

/** The first query parameter value, whatever Next handed us. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
