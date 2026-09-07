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
  lapseIfSkyAgrees,
  modeOptionsFor,
  offeredOverride,
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

  /**
   * The control offers `auto` and the mode the sky is NOT.
   *
   * A third button repeating what the page already is spends a third of the
   * control on a choice nobody can see the result of. What is left is the only
   * decision there is: keep following the sky, or overrule it.
   */
  it('offers only the override that would change something', () => {
    assert.equal(offeredOverride('dark'), 'light');
    assert.equal(offeredOverride('light'), 'dark');
    assert.deepEqual(modeOptionsFor('dark'), ['auto', 'light']);
    assert.deepEqual(modeOptionsFor('light'), ['auto', 'dark']);
    // Two buttons, and `auto` is always the first of them.
    for (const sky of ['light', 'dark'] as const) {
      assert.equal(modeOptionsFor(sky).length, 2);
      assert.equal(modeOptionsFor(sky)[0], 'auto');
      assert.notEqual(modeOptionsFor(sky)[1], sky);
    }
  });

  /**
   * And an override lapses once the sky catches up with it — otherwise a
   * choice made at ten at night reappears as a page that will not go dark at
   * shkia, under a control that says it is following the sky.
   */
  it('lets an override lapse when the sky agrees with it', () => {
    assert.equal(lapseIfSkyAgrees('light', 'light'), 'auto');
    assert.equal(lapseIfSkyAgrees('dark', 'dark'), 'auto');
    // A real override survives, and auto is already auto.
    assert.equal(lapseIfSkyAgrees('light', 'dark'), 'light');
    assert.equal(lapseIfSkyAgrees('dark', 'light'), 'dark');
    assert.equal(lapseIfSkyAgrees('auto', 'light'), 'auto');
    // The surviving override is always the one the control still shows.
    for (const sky of ['light', 'dark'] as const) {
      const survivor = lapseIfSkyAgrees(offeredOverride(sky), sky);
      assert.ok(modeOptionsFor(sky).includes(survivor));
    }
  });

  it('still follows real shkia and real netz, not the operating system', () => {
    // 2026-08-26 in Tel Aviv: netz 06:19, shkia 19:12 (Asia/Jerusalem, UTC+3).
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 9, 0))), 'light'); // 12:00
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 17, 30))), 'dark'); // 20:30
    assert.equal(modeAt(new Date(Date.UTC(2026, 7, 26, 1, 0))), 'dark'); // 04:00
  });
});
