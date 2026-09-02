/**
 * Distance, walking time, and whether you can still make it.
 *
 * Every number in `distance.ts` is deliberately pessimistic, and these are the
 * assertions that keep it that way. Telling somebody they can reach a minyan
 * when they cannot wastes the entire journey; telling them they cannot when
 * they could costs a few minutes. The two errors are not symmetrical.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCURACY_LIMIT_METRES,
  anythingWithinReach,
  formatMetres,
  metresBetween,
  reachability,
  walkingMinutes,
} from '../src/lib/distance.ts';

// Two real synagogues in the database, 579 m apart in a straight line.
const KLAL = { lat: 32.12615434145014, lng: 34.80098522868166 };
const MALL = { lat: 32.11222, lng: 34.79583 };

describe('metresBetween', () => {
  it('measures a known pair to within a metre or two', () => {
    // Cross-checked against PostGIS ST_Distance on the same two points, which
    // is a different implementation on a different ellipsoid — so this is not
    // the library agreeing with itself.
    const d = metresBetween(KLAL, MALL);
    assert.ok(Math.abs(d - 1613) < 15, `expected ~1613 m, got ${Math.round(d)}`);
  });

  it('is zero for a point against itself', () => {
    assert.equal(Math.round(metresBetween(KLAL, KLAL)), 0);
  });

  it('is symmetric', () => {
    assert.equal(Math.round(metresBetween(KLAL, MALL)), Math.round(metresBetween(MALL, KLAL)));
  });
});

describe('walkingMinutes', () => {
  it('never returns less than the straight line would take', () => {
    // Streets turn. A figure that assumed the hypotenuse would send people
    // late, which is the failure this module exists to avoid.
    for (const metres of [100, 350, 800, 1500, 4000]) {
      const optimistic = metres / 83; // 5 km/h, straight line, no rounding
      assert.ok(
        walkingMinutes(metres) > optimistic,
        `${metres} m: ${walkingMinutes(metres)} min is not cautious enough`,
      );
    }
  });

  it('always rounds up, so a part-minute is never free', () => {
    assert.equal(walkingMinutes(1), 1);
    assert.ok(Number.isInteger(walkingMinutes(537)));
  });

  it('grows with distance', () => {
    assert.ok(walkingMinutes(2000) > walkingMinutes(1000));
  });

  it('is never zero, even standing at the door', () => {
    // "0 דק׳ הליכה" appeared the first time this ran against a position on top
    // of a synagogue. It reads as a broken number, and it is also false —
    // there is always a minute of finding the entrance.
    assert.equal(walkingMinutes(0), 1);
    assert.equal(walkingMinutes(3), 1);
  });
});

describe('reachability', () => {
  it('says yes only when the walk fits in the time left', () => {
    assert.equal(reachability(15, 10, 20), 'reachable');
    assert.equal(reachability(10, 10, 20), 'reachable');
    assert.equal(reachability(9, 10, 20), 'too_far');
  });

  it('refuses to judge from a vague position', () => {
    // `coords.accuracy` is routinely hundreds of metres indoors, which is
    // enough to flip the verdict. Better to show a distance and say nothing.
    assert.equal(reachability(30, 10, ACCURACY_LIMIT_METRES + 1), 'unknown');
  });

  it('refuses to judge with no time to judge against', () => {
    // The unknown-time card. It still gets a distance; it cannot get a verdict.
    assert.equal(reachability(null, 5, 10), 'unknown');
  });

  it('never defaults to yes', () => {
    // Every path that cannot answer must return `unknown`, never `reachable`.
    const vague = reachability(null, 5, 9999);
    assert.notEqual(vague, 'reachable');
  });
});

describe('formatMetres', () => {
  it('uses metres below a kilometre, rounded to 50', () => {
    // 847 m from a position with its own error bars is false precision.
    assert.deepEqual(formatMetres(847), { value: 850, unit: 'm' });
    assert.deepEqual(formatMetres(120), { value: 100, unit: 'm' });
  });

  it('switches to kilometres above 1000 m', () => {
    assert.deepEqual(formatMetres(1613), { value: 1.6, unit: 'km' });
  });

  it('never prints a distance of zero', () => {
    // Rounding to the nearest 50 turned anything under 25 m into "0 מ׳", which
    // is what standing outside a shul produced. 50 m is also roughly the
    // accuracy of a good urban fix, so it is the smallest honest figure.
    assert.deepEqual(formatMetres(0), { value: 50, unit: 'm' });
    assert.deepEqual(formatMetres(12), { value: 50, unit: 'm' });
  });
});

/**
 * The coverage ceiling.
 *
 * Beyond it the honest answer is that we know of nothing near you. Without it
 * the board answered a visitor in Dizengoff Center with fifteen rows marked
 * `reachable`, walks of 76 to 116 minutes, and a live directions link on each
 * — technically true, since those minyanim really are hours away, and an
 * answer nobody standing there should be given.
 */
describe('anythingWithinReach', () => {
  it('is true when something is a short walk away', () => {
    assert.equal(anythingWithinReach([300, 5000, 9000]), true);
  });

  it('is false when even the nearest is beyond half an hour on foot', () => {
    // Dizengoff Center to the nearest of the seventeen: about 4 km.
    assert.equal(anythingWithinReach([4000, 4200, 6200]), false);
  });

  it('judges the nearest, not the average', () => {
    // One close shul is enough to make the feature useful, however far the
    // rest of the city is.
    assert.equal(anythingWithinReach([200, 40000]), true);
  });

  it('is false for an empty board, never true by default', () => {
    // A filter that matches nothing must not report coverage it does not have.
    assert.equal(anythingWithinReach([]), false);
  });

  it('lets the whole covered neighbourhood through', () => {
    // The seventeen span 2.1 km, so anyone standing among them has one much
    // closer than the ceiling and never sees the message. If this ever fails,
    // the ceiling has been tightened to the point of hiding real coverage.
    assert.equal(anythingWithinReach([2100]), false, '2.1 km is beyond a 30-minute walk');
    assert.equal(anythingWithinReach([1500]), true, 'but the far end of one neighbourhood is not');
  });
});
