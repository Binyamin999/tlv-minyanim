/**
 * Light and dark, and the one control that overrules them.
 *
 * The sky half of this is already pinned in `jerusalem-clock.test.ts` against
 * published netz and shkia. What is asserted here is the override's own rule:
 * that `auto` really does defer, that a chosen mode really does win, and that
 * a cookie somebody has edited by hand cannot put the page into a fourth state.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MODE_COOKIE,
  isModePreference,
  modeAt,
  modeCookieValue,
  readModePreference,
  resolveMode,
} from '../src/lib/theme.ts';

describe('the light/dark override', () => {
  it('defers to the sky when the preference is auto', () => {
    assert.equal(resolveMode('auto', 'light'), 'light');
    assert.equal(resolveMode('auto', 'dark'), 'dark');
  });

  it('overrules the sky when a mode was chosen', () => {
    // The whole point: the clock is right and the room is not.
    assert.equal(resolveMode('dark', 'light'), 'dark');
    assert.equal(resolveMode('light', 'dark'), 'light');
  });

  it('treats an absent or tampered cookie as auto', () => {
    assert.equal(readModePreference(undefined), 'auto');
    assert.equal(readModePreference(''), 'auto');
    assert.equal(readModePreference('sunset'), 'auto');
    assert.equal(readModePreference('LIGHT'), 'auto');
    assert.equal(readModePreference('__proto__'), 'auto');
  });

  it('reads back the three values it writes', () => {
    for (const preference of ['auto', 'light', 'dark'] as const) {
      assert.ok(isModePreference(preference));
      const cookie = modeCookieValue(preference);
      assert.ok(cookie.startsWith(`${MODE_COOKIE}=${preference};`), cookie);
      assert.equal(readModePreference(cookie.split(';')[0]?.split('=')[1]), preference);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\//);
    }
  });

  it('still follows real shkia and real netz, not the operating system', () => {
    // 2026-08-26 in Tel Aviv: netz 06:19, shkia 19:12 (Asia/Jerusalem, UTC+3).
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 9, 0))), 'light'); // 12:00
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 17, 30))), 'dark'); // 20:30
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 1, 0))), 'dark'); // 04:00
  });
});
