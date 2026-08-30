'use client';

import { useState } from 'react';

import type { Dictionary } from '@/i18n/dictionaries';

/** Only the plain strings. See the `nearMe` group in dictionaries.ts. */
type NearMeLabels = Dictionary['nearMe'];
import {
  formatMetres,
  metresBetween,
  reachability,
  walkingMinutes,
  type Reachability,
} from '@/lib/distance';

/**
 * "Find a minyan near me."
 *
 * ---------------------------------------------------------------------------
 * PROGRESSIVE ENHANCEMENT, NOT A REWRITE
 * ---------------------------------------------------------------------------
 * The board above is server-rendered and stays that way. SEO is this project's
 * entire discovery strategy, so Googlebot, anyone who declines permission and
 * anyone whose browser blocks geolocation must all still get the complete
 * page — which they do, because this component renders one button and then
 * DECORATES the existing DOM rather than owning it. Turning the board into a
 * client island to sort it would have traded the whole discovery strategy for
 * a convenience.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IS ASKED FOR ON ARRIVAL
 * ---------------------------------------------------------------------------
 * The permission prompt fires on tap, never on load. A cold dialog before a
 * visitor has seen anything is refused by most people and reads as a site
 * taking something; asked after the board is visible, it is a trade they can
 * see the value of.
 *
 * ---------------------------------------------------------------------------
 * THE POSITION NEVER LEAVES THE DEVICE
 * ---------------------------------------------------------------------------
 * No fetch, no URL parameter, no logging, and deliberately no persistence —
 * not even localStorage. Every synagogue's coordinates are already in the page,
 * so the arithmetic happens here and the position is discarded when the tab
 * closes. Same instinct as the gabbai phone numbers: the safest place for
 * somebody's location is nowhere.
 */

type State =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'done'; count: number; vague: boolean }
  | { status: 'denied' }
  | { status: 'insecure' }
  | { status: 'failed' };

export function NearMe({ labels }: { labels: NearMeLabels }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  /*
   * NO CAPABILITY CHECK BEFORE RENDER, and that is a fix rather than an
   * oversight.
   *
   * This read `if (!('geolocation' in navigator)) return null`, which looks
   * careful and produced a hydration mismatch on every homepage load — React
   * error #418, visible only in a real browser's console. Node 24 has a
   * `navigator` global but no `geolocation` on it, so the server rendered
   * nothing while the client rendered a button, and the two trees disagreed.
   *
   * The button is therefore always rendered, on the server and on the client,
   * and support is checked at the moment it is used. A browser without
   * geolocation gets the same honest failure note as a fix that times out,
   * which is a far better trade than a whole page failing to hydrate.
   */
  const locate = () => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'failed' });
      return;
    }
    /*
     * A secure context is required, and its absence must not read as a
     * refusal.
     *
     * Browsers only hand out a position over https or on localhost. Served to
     * a phone over a LAN address — which is how this site is reviewed — the
     * request is refused before anyone is asked, and it arrives as
     * PERMISSION_DENIED: byte for byte what a real "no" looks like. Reporting
     * that as "no access to location" blames the reader for a decision they
     * were never offered, and sends them into their settings to fix something
     * that is not broken.
     *
     * Checked here rather than at render, deliberately. Branching on
     * `isSecureContext` while rendering is the same hydration trap the
     * capability check fell into: the server cannot know.
     */
    if (!window.isSecureContext) {
      setState({ status: 'insecure' });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const accuracy = position.coords.accuracy;
        const count = decorate(here, accuracy, labels);
        setState({ status: 'done', count, vague: accuracy > 250 });
      },
      (error) => {
        // PERMISSION_DENIED is a decision, not a fault, and is worded as one.
        setState({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'failed' });
      },
      // No cached position: someone who has walked three streets since the
      // last fix would be told about the minyan behind them.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  /*
   * What a screen reader hears. Everything this feature does is visual —
   * numbers appear inside cards and the board silently reorders — so without
   * this a blind user taps the button and is told nothing at all, while the
   * page rearranges under their cursor.
   *
   * The reorder is the part that most needs saying: the distances themselves
   * get read out on reaching each card, but a list that changed order while
   * you were reading it is disorienting and invisible.
   */
  const announcement =
    state.status === 'locating'
      ? labels.locating
      : state.status === 'denied'
        ? labels.denied
        : state.status === 'failed'
          ? labels.failed
          : state.status === 'insecure'
            ? labels.insecure
          : state.status === 'done'
            ? // `count` earns its place here. It was carried in state and read
              // by nothing, which the QA pass called out as a comment
              // overpromising — this is the branch that comment described.
              `${state.count} ${labels.sorted}${state.vague ? `. ${labels.vague}` : ''}`
            : '';

  return (
    <span className="near-me">
      <button className="near-me-button" onClick={locate} disabled={state.status === 'locating'}>
        {state.status === 'locating' ? labels.locating : labels.action}
      </button>
      {state.status === 'denied' ? <span className="near-me-note">{labels.denied}</span> : null}
      {state.status === 'failed' ? <span className="near-me-note">{labels.failed}</span> : null}
      {state.status === 'insecure' ? (
        <span className="near-me-note">{labels.insecure}</span>
      ) : null}
      {state.status === 'done' && state.vague ? (
        <span className="near-me-note">{labels.vague}</span>
      ) : null}
      {/* `polite`, never `assertive`: this interrupts nothing, and a person
          part-way through hearing a synagogue's name should not be cut off.
          Always in the DOM rather than mounted on demand — a live region
          added at the same moment as its text is frequently not announced. */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}

/**
 * Write walking distance onto every card, and sort the board by it.
 *
 * Reads the coordinates the server already printed on each card and fills the
 * empty slot it left. Returns how many cards were reached, so the button can
 * say nothing happened if the answer is none.
 */
function decorate(
  here: { lat: number; lng: number },
  accuracyMetres: number,
  labels: NearMeLabels,
): number {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-lat][data-lng]')];
  const measured: Array<{ el: HTMLElement; metres: number }> = [];

  for (const el of cards) {
    const lat = Number(el.dataset.lat);
    const lng = Number(el.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const metres = metresBetween(here, { lat, lng });
    const walk = walkingMinutes(metres);

    // Minutes are recomputed from the row's own instant rather than taken from
    // a number the server rendered: a page left open for twenty minutes would
    // otherwise judge reachability against a countdown that has since expired.
    const at = el.dataset.at ? new Date(el.dataset.at) : null;
    const minutesUntil = at ? Math.round((at.getTime() - Date.now()) / 60000) : null;
    const verdict = reachability(minutesUntil, walk, accuracyMetres);

    const slot = el.querySelector<HTMLElement>('.near-slot');
    if (slot) {
      const { value, unit } = formatMetres(metres);
      // Composed here rather than by a dictionary function, because a function
      // cannot be handed to a client component — see the `nearMe` group. Both
      // languages read "N <walk> · X <unit>", so one order serves both.
      const distance = `${value} ${unit === 'm' ? labels.metres : labels.kilometres}`;
      slot.textContent = `${walk} ${labels.walk} · ${distance}`;
      slot.hidden = false;
    }
    // The verdict goes on the card so CSS can style the whole row, and as a
    // data attribute rather than a class so it replaces itself on a re-run.
    el.dataset.reach = verdict;

    const tooFar = el.querySelector<HTMLElement>('.near-too-far');
    if (tooFar) {
      tooFar.textContent = labels.tooFar;
      tooFar.hidden = verdict !== 'too_far';
    }

    measured.push({ el, metres });
  }

  // Nearest first, which is what was asked for — but only among the cards, and
  // never the hero. The hero is the next minyan by TIME and reordering the
  // board does not change what is next; a shul 200 m away whose next minyan is
  // tomorrow morning must not become the answer to "where can I daven now".
  const container = document.querySelector('.cards');
  if (container) {
    const inBoard = measured.filter((m) => m.el.parentElement === container);
    // Cards with no time stay last, exactly as the server ordered them. A shul
    // whose next minyan we cannot state has no position among shuls we can —
    // sorting it to the top for being close would make "nearest" outrank
    // "known", which is the wrong way round for a site whose product is the
    // times. Distance is still shown on them; only their rank is withheld.
    const timed = inBoard.filter((m) => m.el.dataset.at);
    const untimed = inBoard.filter((m) => !m.el.dataset.at);
    [...timed.sort((a, b) => a.metres - b.metres), ...untimed].forEach((m) =>
      container.appendChild(m.el),
    );
    container.classList.add('cards-by-distance');
  }

  return measured.length;
}
