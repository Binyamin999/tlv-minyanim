/**
 * Light and dark follow the real sky over Tel Aviv, not the operating system.
 *
 * CLAUDE.md: "Light and dark follow the clock the same way — dark from real
 * shkia, light from real netz."
 *
 * What is deliberately NOT here: a control that makes it evening. The design
 * artboards carry a `sunset` chip because a static mockup cannot be 19:01; the
 * real site simply is 19:01 when it is. See CLAUDE.md, "Preview toggles are
 * NOT features".
 *
 * What IS here is the one genuine control: the אוטו׳ / sun / moon override,
 * for when the clock is right and the room is not. Three states, not two —
 * `auto` has to be a first-class value a user can come back to, or the first
 * tap silently opts them out of the sky forever.
 */
// Relative rather than `@/zmanim` so `node --test` can load this file: the
// `@/` alias is a bundler fact, not a runtime one, and a rule about what the
// sky is doing should be testable without Next.
import { TEL_AVIV, isDaylight } from '../zmanim/index.ts';

export type Mode = 'light' | 'dark';

/** `auto` = follow the sky. The other two are the user overruling it. */
export type ModePreference = 'auto' | Mode;

/**
 * Every value the cookie may hold. NOT the buttons — see `modeOptionsFor`,
 * which offers two of these at a time. All three remain valid stored states:
 * the control simply stops being able to create the third.
 */
export const MODE_PREFERENCES: readonly ModePreference[] = ['auto', 'light', 'dark'];

/**
 * The override worth offering right now, which is only ever the OTHER one.
 *
 * Three buttons meant one of them never did anything a reader could see: at
 * night, "dark" is what the page already is. A control whose third of the
 * width changes nothing is asking someone to work out which two matter.
 *
 * So the control is `auto` plus the mode the sky is not — at night the sun,
 * by day the moon — and it says what it does: keep following the sky, or
 * don't.
 */
export function offeredOverride(skyMode: Mode): Mode {
  return skyMode === 'light' ? 'dark' : 'light';
}

/** The buttons, in order. `auto` first, so it is the outer one in both scripts. */
export function modeOptionsFor(skyMode: Mode): readonly ModePreference[] {
  return ['auto', offeredOverride(skyMode)];
}

/**
 * An override lapses once the sky agrees with it.
 *
 * Someone picks light at ten at night because the room is bright. By morning
 * the sky is light too and the choice has stopped doing anything — and the
 * button that would show it is no longer on screen, because it is no longer
 * an override. Left in the cookie it would surface hours later as a page that
 * refuses to go dark at shkia, under a control reading `אוטו׳`.
 *
 * So a preference that matches the sky IS auto, which keeps the two buttons a
 * complete description of the state rather than two thirds of one. The cost
 * is that "always light, forever" cannot be expressed — and it could not be
 * expressed by a two-button control in any case.
 */
export function lapseIfSkyAgrees(preference: ModePreference, skyMode: Mode): ModePreference {
  return preference === skyMode ? 'auto' : preference;
}

/**
 * The cookie the override lives in.
 *
 * A cookie rather than localStorage because the decision has to be made on the
 * server: <html data-mode> must be correct in the first byte of HTML, or the
 * page paints light and then snaps to dark. localStorage cannot be read before
 * paint without a blocking inline script, which is the same flash wearing a
 * different hat.
 */
export const MODE_COOKIE = 'tlv-mode';

/** A year. The preference is a preference, not a session. */
export const MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isModePreference(value: unknown): value is ModePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** Light while the sun is up over Tel Aviv, dark once it has set. */
export function modeAt(instant: Date): Mode {
  return isDaylight(TEL_AVIV, instant) ? 'light' : 'dark';
}

/**
 * What the page should actually be: the override if there is one, otherwise
 * the sky. An unreadable or absent cookie is `auto`, which is the right
 * default and also the right answer to a tampered value.
 */
export function resolveMode(preference: ModePreference, skyMode: Mode): Mode {
  return preference === 'auto' ? skyMode : preference;
}

/** Parse whatever came back from the cookie jar. Never throws. */
export function readModePreference(value: string | undefined): ModePreference {
  return isModePreference(value) ? value : 'auto';
}

/** The one place that knows how the cookie is spelled. Used by the client. */
export function modeCookieValue(preference: ModePreference): string {
  return `${MODE_COOKIE}=${preference}; Path=/; Max-Age=${MODE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
