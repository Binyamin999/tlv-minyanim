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
 * Four chips, in the order the day actually happens.
 *
 * The artboard draws Mincha first and this followed it, since the boards are
 * the specification. The user corrected it: שחרית / מנחה / ערבית / שבת. A
 * reader scanning a row of prayer names expects them in the order they are
 * davened, and Mincha-first only ever made sense because Mincha is the chip
 * most often *selected* — which is a default, not an ordering.
 *
 * Note the two are independent: `defaultServiceFilter` still opens on whichever
 * service has the soonest minyan, so the common case is unchanged. This is only
 * the order they are laid out in.
 *
 * `shabbat` is the odd one and honestly so — it is a day, not a service. It
 * filters on the `shabbat` column rather than on a service, which is exactly
 * what a person tapping it means: show me the Shabbat times. It stays last
 * because it is the one chip that is not a point in today.
 */
export const SERVICE_FILTERS = ['shacharit', 'mincha', 'arvit', 'shabbat'] as const;

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
