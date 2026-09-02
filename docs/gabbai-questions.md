# What to ask a gabbai

A field list, ordered by what it unblocks. Every question here exists because
something in the database is currently held, guessed at, or expiring — and one
sentence from the person who runs the minyan would settle it.

The Hebrew is what to actually say. The rest is why it matters, so that if an
answer comes back unexpected you know whether it is interesting or a mistake.

**Do not write down phone numbers.** They are personal data under Israeli
privacy law and this repository is public. Question 8 covers consent, and even
then a number goes in a private note, never in git.

---

## 1. Which luach do you go by?

> **לפי איזה לוח אתם קובעים את הזמנים?**
> אור החיים · כסא רחמים · חב״ד · הרבנות · אחר

**What it unblocks:** `צאת הכוכבים`, which is the most ambiguous word in the
data. Luachot disagree about it by nearly an hour — our current 8.5° is about
shkia + 39 in Tel Aviv, while a 13.5- or 18-minute reckoning is shkia + 13 to
20, and Rabbeinu Tam is shkia + 72. Any tzeit-anchored minyan is therefore held
on sight. Knowing the luach makes that word computable, which turns a held
minyan into a rule that never needs asking about again.

**Never infer this.** A Chabad house does not necessarily use a Chabad luach —
plenty use the local Rabbanut times — and guessing it from the movement is the
same forbidden step as reading movement off nusach.

**What it does NOT do:** it will not turn a printed clock face into a rule. A
luach says how to compute a zman, not how many minutes before it a shul davens.

---

## 2. Do you set the times from the luach, or reprint the same sheet?

> **הזמנים נקבעים לפי הלוח בכל שבוע, או שמדפיסים את אותו דף?**

**What it unblocks:** the single biggest gap. Of 78 publishable minyanim, only
5 are stored as rules; 50 are clock faces that expire at the end of the week
they were read in. A rule is stored once and is correct forever — `shkia + 20`
gives 19:24 in September and 17:00 in December with nobody touching it. A
reprinted number has to be re-read every week, for every shul, forever.

Whether a given time IS a rule is a fact about the shul, not about our
software, and this question is the only cheap way to learn it.

**The alternative, if asking is awkward:** three consecutive weekly sheets
settle it empirically. If a time holds the same offset across three different
sunsets, it is a rule.

---

## 3. Where a board says a zman rather than a clock time — how many minutes?

> **ערבית ב״צאת הכוכבים״ — כמה דקות אחרי השקיעה?**
> **מנחה ״בזמן״ — כמה דקות לפני השקיעה?**

**What it unblocks:** about 60% of the municipal source says only `בזמן` — "at
the proper time" — with no offset, and we refuse to guess one. This question
converts an unknown into a rule in one sentence.

**Proven worth:** בית חב״ד קניון רמת אביב's board said צאת הכוכבים. Held rather
than published, the shul answered "twenty minutes after shkia". Resolving their
own word against the luach's 8.5° would have listed that minyan at 19:45
against a real 19:27 — eighteen minutes late.

---

## 4. May I photograph the Shabbat sheet?

**What it unblocks:** Shabbat is missing for several shuls that are otherwise
well covered — היכל חיים, תהילת אביב, נוה קודש, אוהל יוסף יצחק, תומכי תמימים.
The municipal Shabbat column merges Friday and Saturday without saying which,
so a row read from it can never be placed on the right day. Only a sheet with a
separate `ליל שבת` block can.

A photograph is also worth more than a dictated list: one photograph of כלל
ישראל's sheet confirmed the candle-lighting minhag, corrected a Mincha that was
twelve minutes early, and exposed a bug that had been placing erev-Shabbat
minyanim on Saturday.

---

## 5. Is there a service you do not hold at all?

> **יש תפילה שלא מתקיימת כאן בכלל?**

**What it unblocks:** the difference between "we don't know" and "there are
none", which the site can now state but only from a person. נוה קודש davens
Shacharit every weekday and holds no Mincha or Arvit — without being told, the
page shows one lone row and a reader cannot tell a Mincha we are missing from
one that does not happen.

Ask it per day as well: a mall or campus shul may hold nothing on Shabbat.

---

## 6. If there is more than one minyan — where, and what kind?

> **באיזה חדר?** (למעלה / למטה / בסוכה)
> **יש מניין נץ? הודו? פלג?**

**What it unblocks:** two Arvits an hour apart in one building are two
different staircases to somebody who has never been, and the times alone cannot
say which. The labels are how a davener chooses — a נץ minyan and a 05:40
minyan are the same row until one of them says נץ.

Only record words the board or the gabbai actually used. Anything we have no
code for is written down as held rather than approximated to the nearest word
we do have.

---

## 7. Does anything change between שעון חורף and שעון קיץ?

> **משתנה בין שעון חורף לשעון קיץ?**

**What it unblocks:** the source writes `ח` and `ק` for two clock faces on one
minyan, and those mean standard time and DST rather than the seasons. Israel's
switch dates are not the EU's or America's. A shul that changes its times at
the clock change needs both faces recorded, not one.

---

## 8. May we contact you when something looks out of date?

**What it unblocks:** the refresh engine. Data rot is what kills every minyan
directory — the municipal layer is fourteen months stale and does not admit it,
and TLV10 is simply abandoned.

**Consent first, and a number never goes in the repository.** The GIS export
carries 442 gabbai and rabbi phone numbers; the file is gitignored, no phone
column exists in the database, and none is displayed. If a gabbai agrees to be
contacted, that goes in a private note outside this project.

---

## What to bring back

For each shul: the answers above, a photograph of every sheet on the wall, and
the date you were there. The date is not a formality — every listing displays
`last_verified_at`, and honest decay is the whole trust model.
