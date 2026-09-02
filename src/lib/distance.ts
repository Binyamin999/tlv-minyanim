/**
 * How far, how long on foot, and whether you can still make it.
 *
 * Pure arithmetic, no DOM and no browser API, so it can be tested — the
 * component that calls it cannot be, being a client component full of
 * geolocation.
 *
 * ---------------------------------------------------------------------------
 * EVERY NUMBER HERE IS DELIBERATELY PESSIMISTIC
 * ---------------------------------------------------------------------------
 * The failure this exists to prevent is telling somebody they can make a
 * minyan when they cannot. Arriving early costs a few minutes standing
 * outside; arriving late costs the minyan, which is the entire journey wasted.
 * The two errors are not symmetrical and the arithmetic must not treat them as
 * though they were.
 */

/** Metres between two WGS84 points, on a sphere. */
export function metresBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  // Haversine. The earth is not a sphere, but the error over a few kilometres
  // in one city is centimetres — far inside the error already introduced by
  // walking in straight lines below, and by GPS accuracy above.
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Straight line to street distance.
 *
 * We have coordinates, not routes. Nobody walks the hypotenuse: streets turn,
 * and Tel Aviv's grid is not aligned to anything. 1.4 is at the cautious end
 * of the usual 1.2–1.4 urban detour range, chosen for the asymmetry above.
 */
const ROUTE_FACTOR = 1.4;

/**
 * Metres per minute on foot.
 *
 * 75 m/min is 4.5 km/h — slower than the ~5 km/h an unencumbered adult walks
 * on a clear pavement, which is the point. The person using this is in an
 * unfamiliar neighbourhood looking for a building they have never seen, quite
 * possibly in a suit, on erev Shabbat, with children.
 */
const METRES_PER_MINUTE = 75;

/**
 * Minutes on foot for a straight-line distance, always rounded up.
 *
 * Never zero. Standing at the door of a shul, "0 דק׳ הליכה" is both wrong —
 * there is always a minute of finding the entrance — and reads as a broken
 * number rather than a short walk.
 */
export function walkingMinutes(straightLineMetres: number): number {
  return Math.max(1, Math.ceil((straightLineMetres * ROUTE_FACTOR) / METRES_PER_MINUTE));
}

/**
 * GPS accuracy beyond which a reachability verdict is not honest.
 *
 * `coords.accuracy` is a 95% confidence radius in metres. Indoors or on a
 * desktop it is routinely hundreds of metres — enough to move a verdict from
 * "you will make it" to "you will not". Beyond this we still show a distance,
 * because it is roughly right and useful, but we stop telling anyone whether
 * they can make it, because that is a yes/no and it would be a guess.
 */
export const ACCURACY_LIMIT_METRES = 250;

/**
 * The furthest a shul can be and still be worth offering, on foot.
 *
 * Beyond this the honest answer is that we know of nothing near you — not a
 * dutifully sorted list of ninety-minute walks with live directions links.
 *
 * Thirty minutes is the outer edge of "I could get there". It is also well
 * inside the covered area: the seventeen synagogues span 2.1 km, so anyone
 * standing among them has one much closer than this and never sees the
 * message. It fires when somebody is genuinely outside the coverage — from
 * Dizengoff Center the nearest is 76 minutes — which today is most of the
 * city, and will stay true for someone outside all four neighbourhoods long
 * after Kfar Shalem lands.
 */
export const COVERAGE_LIMIT_WALK_MINUTES = 30;

/**
 * Is anything we know about near enough to be worth showing?
 *
 * Takes the whole result set, because the question is about coverage rather
 * than about any one shul. `false` means say so and change nothing else — the
 * board stays in time order, undecorated, exactly as a visitor who never
 * tapped would see it.
 */
export function anythingWithinReach(straightLineMetres: readonly number[]): boolean {
  if (straightLineMetres.length === 0) return false;
  return walkingMinutes(Math.min(...straightLineMetres)) <= COVERAGE_LIMIT_WALK_MINUTES;
}

export type Reachability = 'reachable' | 'too_far' | 'unknown';

/**
 * Can this minyan still be reached on foot?
 *
 * `unknown` where the position is too vague to judge, or where there is no
 * time to judge against — never a cheerful default. A row with no answer says
 * nothing rather than saying yes.
 */
export function reachability(
  minutesUntilStart: number | null,
  walkMinutes: number,
  accuracyMetres: number,
): Reachability {
  if (accuracyMetres > ACCURACY_LIMIT_METRES) return 'unknown';
  if (minutesUntilStart === null) return 'unknown';
  return minutesUntilStart >= walkMinutes ? 'reachable' : 'too_far';
}

/**
 * A distance a person can act on.
 *
 * Metres below a kilometre, because "850 מ׳" is a walk you can picture and
 * "0.85 ק״מ" is arithmetic. Rounded to 50 m — the underlying figure is a
 * straight line from a position with its own error bars, and a spurious "847"
 * would claim a precision that is not there.
 */
export function formatMetres(metres: number): { value: number; unit: 'm' | 'km' } {
  // Floored at 50, never 0. Rounding to the nearest 50 turns anything under
  // 25 m into "0 מ׳", which is what standing outside a shul produced — a
  // distance of zero reads as a bug, not as "you are here". 50 is also about
  // the accuracy of a good urban GPS fix, so it is the smallest figure this
  // can honestly print.
  if (metres < 1000) return { value: Math.max(50, Math.round(metres / 50) * 50), unit: 'm' };
  return { value: Math.round(metres / 100) / 10, unit: 'km' };
}
