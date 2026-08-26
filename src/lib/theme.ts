/**
 * Light and dark follow the real sky over Tel Aviv, not the operating system.
 *
 * CLAUDE.md: "Light and dark follow the clock the same way — dark from real
 * shkia, light from real netz." Phase 1 left this on `prefers-color-scheme`
 * because there was no zmanim library yet. There is now, so the stand-in goes.
 *
 * What is deliberately NOT here: a control that makes it evening. The design
 * artboards carry a `sunset` chip because a static mockup cannot be 19:01; the
 * real site simply is 19:01 when it is. See CLAUDE.md, "Preview toggles are
 * NOT features".
 *
 * TODO(phase 4): the one genuine control — the אוטו׳ / sun / moon override,
 * drawn inside the page for when the clock is right and the room is not. It
 * needs client state and a cookie, so it belongs with the designed homepage
 * rather than bolted onto the scaffold.
 */
import { TEL_AVIV, isDaylight } from '@/zmanim';

export type Mode = 'light' | 'dark';

/** Light while the sun is up over Tel Aviv, dark once it has set. */
export function modeAt(instant: Date): Mode {
  return isDaylight(TEL_AVIV, instant) ? 'light' : 'dark';
}
