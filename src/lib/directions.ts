/**
 * Getting there. Coordinates come from the GIS layer, so these links are exact
 * and need no geocoding.
 */

/**
 * WALKING, not driving. This is not a detail: people walk to shul, often on
 * erev Shabbat, and driving directions are wrong for nearly every journey this
 * site serves. Belongs on cards and on the shul page alike.
 */
export function walkingDirectionsUrl(lat: number, lng: number): string {
  const destination = `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

/**
 * Waze is a driving app — useful for the rarer cross-town trip. It belongs on
 * the individual synagogue page ONLY, never on a card in a list.
 */
export function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}
