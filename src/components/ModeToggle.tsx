'use client';

import { useState } from 'react';

import {
  MODE_PREFERENCES,
  modeCookieValue,
  resolveMode,
  type Mode,
  type ModePreference,
} from '@/lib/theme';

/**
 * The one genuine control on the page: אוטו׳ / sun / moon.
 *
 * CLAUDE.md is explicit that two of the three chips above the artboards are
 * scaffolding and one ships. This is the one that ships — "for when the clock
 * is right and the room is not". There is no `sunset` button here and there is
 * no `bleed` button here; a button that makes it evening would be as wrong as
 * a button that makes it Tuesday.
 *
 * ---------------------------------------------------------------------------
 * NO FLASH, AND NO SERVER ROUND TRIP
 * ---------------------------------------------------------------------------
 * The server already wrote the right `data-mode` onto <html> from the cookie,
 * so the first paint is correct. On a click this component writes the cookie
 * *and* moves `data-mode` itself, because every colour in the design is a
 * custom property keyed on that attribute — so the whole page changes without
 * re-fetching anything.
 *
 * `skyMode` is passed in rather than computed here for the same reason the
 * rest of the app does not compute it in the browser: shkia over Tel Aviv is a
 * server fact from the zmanim library. Holding it lets `auto` resolve on the
 * client too, so returning to `auto` is instant instead of a round trip.
 *
 * The initial state is seeded from the server-rendered preference, so this
 * component renders identically on both sides and never hydrates a mismatch.
 *
 * Labels are handed over one by one rather than as the whole dictionary. The
 * dictionary is full of formatter *functions* — `inMinutes`, `verifiedShort` —
 * and a function cannot cross the server/client boundary. Passing the four
 * strings this control needs keeps the payload to four strings, too.
 */
export interface ModeToggleLabels {
  group: string;
  auto: string;
  names: Record<ModePreference, string>;
}
export function ModeToggle({
  preference,
  skyMode,
  labels,
}: {
  preference: ModePreference;
  skyMode: Mode;
  labels: ModeToggleLabels;
}) {
  const [chosen, setChosen] = useState<ModePreference>(preference);

  function choose(next: ModePreference) {
    setChosen(next);
    document.cookie = modeCookieValue(next);
    const mode = resolveMode(next, skyMode);
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.dataset.modePref = next;
    // Scrollbars and form controls follow the sky too, not the OS.
    root.style.colorScheme = mode;
  }

  return (
    <div className="segmented mode-toggle" role="radiogroup" aria-label={labels.group}>
      {MODE_PREFERENCES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={chosen === option}
          className="segment"
          data-option={option}
          onClick={() => choose(option)}
        >
          {option === 'auto' ? (
            <>
              {skyMode === 'light' ? <SunIcon /> : <MoonIcon />}
              {/* The dot the mobile artboard puts on the corner of the button:
                  "this is following the sky, it was not chosen by hand". */}
              <span className="mode-dot" aria-hidden="true" />
              <span className="segment-label">{labels.auto}</span>
            </>
          ) : option === 'light' ? (
            <SunIcon />
          ) : (
            <MoonIcon />
          )}
          <span className="visually-hidden">{labels.names[option]}</span>
        </button>
      ))}
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
