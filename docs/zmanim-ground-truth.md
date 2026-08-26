# Zmanim ground truth — Tel Aviv / Ramat Aviv

**Purpose:** fixture source for the zmanim test suite. Every value here is sourced
from **outside `@hebcal/core`**. If a test asserts a value from this file and the
engine disagrees, the engine is wrong until proven otherwise.

**Compiled:** 2026-08-26. **Compiled by:** zmanim-authority agent.
**Reference location:** 32.1134 N, 34.7857 E (Ramat Aviv), `Asia/Jerusalem`.
**Horizon model:** sea level / *mishor* (see §2.3). **tzdata:** 2026c.

---

## 1. Sources, and what each one is worth

| # | Source | What it gives | Independent of `@hebcal/core`? |
|---|---|---|---|
| S1 | **NOAA GML Solar Calculator** — `gml.noaa.gov/grad/solcalc/table.php?lat=32.1134&lon=34.7857&year=2026` | sunrise, sunset, solar noon, whole of 2026, minute precision, DST-aware | **Yes.** US government astronomy, no halachic layer. |
| S2 | **sunrisesunset.io** — `api.sunrisesunset.io/json?lat=…&date=…&timezone=Asia/Jerusalem` | sunrise, sunset, 6°/12°/18° twilight, **to the second** | **Yes.** Independent astronomical implementation. |
| S3 | **MyZmanim.com** — location `Tel Aviv Yafo`, MyZmanim location ID **27512341**, `myzmanim.com/day.aspx?vars=27512341/…` | full halachic set to the second, with the shita named on every line | **Yes.** Independent, rabbinically-reviewed engine. Free access is limited to roughly ±6 weeks of the current date, so it covers **2026-07-15, 2026-07-17, 2026-08-28** only. |
| S4 | **המועצה הדתית תל אביב-יפו** (Tel Aviv-Yafo Religious Council) — official *זמני כניסת/יציאת השבת לשנת תשפ"ו 2025/26* poster, `rabanut.co.il/wp-content/uploads/2025/09/rabanot_flayer_zmani_shabat_17x24_11_print.pdf` | published כניסת שבת / יציאת שבת for all 58 Shabbatot and Yamim Tovim of 5786 | **Yes, and it is the local halachic authority.** |
| S5 | **IANA tzdb 2026c** (`zdump -v Asia/Jerusalem`) | exact DST transition instants | **Yes.** |
| S6 | **Kipa.co.il** — `kipa.co.il/כניסת-שבת/תל-אביב/` | Tel Aviv כניסת/יציאת שבת | Yes, but see §7 — it disagrees with S4. |
| X1 | Hebcal **web** zmanim API (`hebcal.com/zmanim?cfg=json…`) | everything, to the second | **NO — same engine family as `@hebcal/core`.** Used *only* as a diagnostic cross-check and clearly labelled as such. Never assert against it alone. |

### 1.1 A source I checked and rejected

`api.sunrise-sunset.org` (note: **not** the same site as `sunrisesunset.io`) returns
sunrise **06:40:40** and sunset **16:59:04** for 2026-01-14 — a day 2.6 minutes longer
than S1, S2, S3 and X1 all agree on. It is the odd one out by ~85 s. **Do not use it.**

### 1.2 How much the sources agree

For 2026-07-15, three independent computations of the same day:

| zman | S3 MyZmanim | S2 sunrisesunset.io | X1 Hebcal | spread |
|---|---|---|---|---|
| netz | 05:45:18 | 05:45:07 | 05:45:07 | 11 s |
| shkia | 19:48:12 | 19:48:21 | 19:48:19 | 9 s |
| shema (GRA) | 09:16:01 | 09:15:56 † | 09:15:55 | 6 s |
| chatzot | 12:46:45 | 12:46:44 † | 12:46:43 | 2 s |
| plag | 18:20:23 | 18:20:31 † | 18:20:29 | 8 s |
| alot 16.1° | 04:19:38 | — | 04:19:24 | 14 s |
| tzeit ≈8.5° | 20:29:38 | — | 20:29:45 | 7 s |

† derived from S2's independently-computed netz/shkia by the GRA proportional-hour
formulas in §2.2. Across all ten dates in this document that derivation never differs
from Hebcal by more than **4 seconds** — which is the real verification: the *engine's
arithmetic* is confirmed against *independently sourced* sunrise and sunset.

**Practical tolerance for tests: ±1 minute on displayed values, except where §2.4
flags a value as sitting on a minute boundary.**

---

## 2. Decisions the tables depend on — read before using any number

### 2.1 Which shita (answers question 2)

| Anchor | **Recommended default** | Why | Also in circulation |
|---|---|---|---|
| `alot` | **16.1° below the horizon** | This is MyZmanim's own default for Tel Aviv Yafo, labelled `72 דקות לפי 16.1 מעלות`. It is the "72 minutes expressed as degrees" opinion, so it tracks the season instead of being a flat 72 minutes. | 90 min / 19.8° (more machmir, used by many Israeli luchot); flat 72 minutes; 72 *zmaniyot*. **Genuinely disputed — do not present a single number as "the" alot without a label.** |
| `netz` | **Sea-level (mishor) sunrise, 0.833° refraction** | What every source here uses, and what Israeli luchot print. | *Netz nir'eh* (visible horizon, elevation-corrected). See §2.3. |
| `shema` | **GRA (Vilna Gaon)** — netz + 3 *shaot zmaniyot* of a netz→shkia day | This is what `סוף זמן ק"ש` means on an Israeli shul board and in the Rabbanut luach. | Magen Avraham (alot→tzeit day), which is ~35–40 min earlier. **Display both, label both.** |
| `chatzot` | **Midpoint of netz and shkia** (= netz + 6 *shaot zmaniyot*) | Consistent with every other GRA zman. Note this is *not* astronomical solar noon — they differ by 6–17 s here (§9.4). | true solar transit |
| `mincha_gedola` | **chatzot + ½ *shaa zmanit*** — but see §9.3, the *lechumra* variant matters in winter | | chatzot + 30 fixed minutes; *lechumra* = the later of the two |
| `mincha_ketana` | **netz + 9½ *shaot zmaniyot*** (GRA) | | MGA equivalent (~40 min later in winter) |
| `plag` | **shkia − 1¼ *shaot zmaniyot*** (= netz + 10¾) (GRA) | | MGA equivalent |
| `shkia` | **Sea-level (mishor) sunset, 0.833° refraction** | | *shkia nir'eit* over the Mediterranean |
| `tzeit` | **8.5° below the horizon** for ending Shabbat and fasts | Reproduces the Tel Aviv Rabbanut's published יציאת שבת to within 0–2 min across all of 5786 (§7.2). | 7.083° (~30 min); 42 min; 13.5/18/20 min for *arvit*; 72 min (R"T). **See §9.1 — this anchor is doing two different jobs and that is a bug waiting to happen.** |
| `candle_lighting` | **shkia − 22 minutes** | The Tel Aviv-Yafo Religious Council's own published number. See §7 — this is the single most important finding in this document. | 20 min (Hebcal, Kipa); 18 min (generic diaspora default); 40 min (Jerusalem); 30 min (Haifa) |

**Recommendation for the product:** pick GRA as the default across the board, print the
shita name next to any zman we display, and never mix (e.g. never show an MGA `shema`
next to a GRA `chatzot` without saying so). A site that picks one clear default and
names it is more trustworthy than one that silently averages opinions.

### 2.2 The GRA formulas the tables use

```
day        = shkia − netz
shaa_zmanit = day / 12
shema         = netz  + 3    × shaa_zmanit
sof_zman_tfilla = netz + 4   × shaa_zmanit
chatzot       = netz  + 6    × shaa_zmanit
mincha_gedola = netz  + 6.5  × shaa_zmanit
mincha_ketana = netz  + 9.5  × shaa_zmanit
plag          = netz  + 10.75× shaa_zmanit
```

### 2.3 Elevation — use sea level, and assert it

Ramat Aviv sits at roughly 30 m. **Do not apply an elevation correction.** All four
independent sources compute at sea level; MyZmanim labels its Tel Aviv Yafo sunrise and
sunset explicitly `Level region at sea level / מישור בגובה פני הים`, and the Rabbanut's
published candle-lighting times are consistent with a sea-level shkia to the second.

This is not cosmetic: 30 m of elevation moves shkia later by roughly **1 minute**
(horizon dip 2.076′·√30 = 11.4′ = 0.19°, against a rate near sunset of ≈0.195°/min).
One minute is enough to change a displayed time, and it would put us out of step with
the luach every Tel Aviv shul actually uses.

**Test to write:** assert that supplying an elevation to the engine does not change
the result, or that the engine is configured with elevation 0.

### 2.4 Rounding to the minute — pick a policy and encode it

The Rabbanut poster demonstrates the halachically correct policy, and it is *not*
"round to nearest":

- **Deadlines truncate (floor).** Candle lighting 2026-01-16: sea-level shkia is
  16:59:44, minus 22 min is 16:37:44, and the poster prints **16:37** — not 16:38.
  Same for `shema`, `sof zman tfilla`, and `shkia` itself.
- **"Not before" times round up (ceil).** The poster's יציאת שבת runs 0–2 minutes
  *later* than a computed 8.5° tzeit, never earlier.

`alot`, `netz`, `misheyakir`, `mincha_gedola`, `mincha_ketana`, `plag`, `tzeit` are all
"not before" times → **ceil**. `shema`, `sof zman tfilla`, `candle_lighting` are
deadlines → **floor**. `chatzot` and `shkia` are instants; floor is conventional.

Both the seconds and the floor/ceil minute are given in every table below so the test
can assert whichever policy is chosen. **Values whose seconds fall within 4 s of a
minute boundary are marked `⚠` — those are the ones where a 2-second engine difference
flips the displayed minute, and they should be asserted with a ±1 min tolerance or not
at all.**

---

## 3. Location: Ramat Aviv vs central Tel Aviv — the delta is immaterial

Same computation at 32.1134/34.7857 (Ramat Aviv) and 32.0853/34.7818 (central Tel Aviv),
all ten dates, every anchor:

| | max |Δ| observed |
|---|---|
| netz | 5 s (Ramat Aviv earlier or later depending on season) |
| shkia | 5 s |
| chatzot | 2 s |
| alot 16.1° | 8 s |
| tzeit 8.5° | 5 s |
| **worst case, any anchor, any date** | **8 s** |

**Verdict: seconds, as you expected — confirmed, not assumed.** One coordinate pair for
the whole of Tel Aviv-Yafo is defensible. NOAA (S1) returns *identical* minute values for
both coordinate sets on every one of the ten dates.

Caveat: an 8-second delta can still flip a displayed minute when a value lands on a
boundary (§2.4). If we ever compute per-shul rather than per-city, the *only* visible
effect will be occasional 1-minute differences between two shuls 3 km apart, which will
look like a bug and is not one. **Recommendation: compute city-wide from one fixed
coordinate pair and say so in the UI.**

---

## 4. DST 2026 — confirmed, not assumed (answers question 3 of the brief's date list)

Israel's Time Determination Law (חוק קביעת הזמן, as amended 2013): **DST begins at 02:00
on the Friday before the last Sunday in March, and ends at 02:00 on the last Sunday in
October.** Not the EU rule, not the US rule.

Verified against IANA tzdb 2026c (`zdump -v Asia/Jerusalem`):

```
Asia/Jerusalem  Thu Mar 26 23:59:59 2026 UT = Fri Mar 27 01:59:59 2026 IST isdst=0 gmtoff=7200
Asia/Jerusalem  Fri Mar 27 00:00:00 2026 UT = Fri Mar 27 03:00:00 2026 IDT isdst=1 gmtoff=10800
Asia/Jerusalem  Sat Oct 24 22:59:59 2026 UT = Sun Oct 25 01:59:59 2026 IDT isdst=1 gmtoff=10800
Asia/Jerusalem  Sat Oct 24 23:00:00 2026 UT = Sun Oct 25 01:00:00 2026 IST isdst=0 gmtoff=7200
```

| | 2026 | 2027 |
|---|---|---|
| DST begins | **Fri 2026-03-27**, 02:00 IST → 03:00 IDT | Fri 2027-03-26 |
| DST ends | **Sun 2026-10-25**, 02:00 IDT → 01:00 IST | Sun 2027-10-31 |

Two assertions that fall straight out of this:

- **`2026-03-27T02:00:00` in `Asia/Jerusalem` does not exist.** Local clock times
  02:00:00–02:59:59 are skipped. A `fixed` minyan at 02:30 that day is unrepresentable;
  a naive `new Date('2026-03-27T02:30:00')` will silently land somewhere else.
- **`2026-10-25T01:00:00`–`01:59:59` in `Asia/Jerusalem` occur twice** — first at
  UTC 2026-10-24T22:00Z (IDT), then at UTC 2026-10-24T23:00Z (IST). A `fixed` 01:30
  minyan that night is ambiguous.

---

## 5. Ground truth, date by date

Notation: `HH:MM:SS` is the best independent estimate; `floor` / `ceil` are the two
minute-rounding candidates; `⚠` marks a value within 4 s of a minute boundary.

All values are for 32.1134 N, 34.7857 E, sea level, `Asia/Jerusalem`.

---

### 5.1 — 2026-01-14, Wednesday. **IST (UTC+02)**. 25 Tevet 5786. Dull midwinter weekday.

Independent corroboration of the spine: **NOAA (S1) netz 06:42, shkia 16:58.**
**sunrisesunset.io (S2) netz 06:42:08, shkia 16:57:51.**

| anchor | shita | time | floor | ceil | confidence |
|---|---|---|---|---|---|
| `alot` | 16.1° | 05:25:18 | 05:25 | 05:26 | medium — S3 unavailable this date |
| *misheyakir* | 11.5° | 05:47:59 ⚠ | 05:47 | 05:48 | medium |
| `netz` | sea level | 06:42:05 | 06:42 | 06:43 | **high** — S1 + S2 |
| `shema` | **GRA** | 09:16:01 ⚠ | 09:16 | 09:17 | **high** — derived from S2 |
| `shema` | MGA 16.1° | 08:37:38 | 08:37 | 08:38 | medium |
| `shema` | MGA 72 fixed min | 08:40:01 ⚠ | 08:40 | 08:41 | medium |
| *sof zman tfilla* | GRA | 10:07:20 | 10:07 | 10:08 | high |
| `chatzot` | midpoint | 11:49:58 ⚠ | 11:49 | 11:50 | **high** (S2-derived gives 11:50:00 — genuinely on the boundary, assert ±1 min) |
| `mincha_gedola` | ½ zmanit | 12:15:37 | 12:15 | 12:16 | high |
| `mincha_gedola` | *lechumra* | 12:19:58 ⚠ | 12:19 | 12:20 | high — see §9.3 |
| `mincha_ketana` | GRA | 14:49:34 | 14:49 | 14:50 | high |
| `plag` | GRA | 15:53:43 | 15:53 | 15:54 | high |
| `shkia` | sea level | 16:57:52 | 16:57 | 16:58 | **high** — S1 + S2 |
| `tzeit` | 7.083° | 17:29:51 | 17:29 | 17:30 | medium |
| `tzeit` | **8.5°** | 17:36:59 ⚠ | 17:36 | 17:37 | medium |
| `tzeit` | 42 min | 17:39:52 | 17:39 | 17:40 | high (arithmetic) |
| `tzeit` | R"T 72 min | 18:09:52 | 18:09 | 18:10 | high (arithmetic) |
| `candle_lighting` | shkia − 22 | 16:35:52 | **16:35** | — | high (rule), **but not a real zman — this is a Wednesday.** See §9.2 |

*shaa zmanit* = 00:51:18.

---

### 5.2 — 2026-01-16, Friday. **IST (UTC+02)**. 27 Tevet 5786. Parashat Vaera. **Erev Shabbat, winter.**

Independent corroboration: **NOAA netz 06:42, shkia 17:00. S2 netz 06:41:45, shkia 16:59:39.**
**S4 (Tel Aviv-Yafo Religious Council, published): כניסת שבת 16:37, יציאת שבת 17:40.**

| anchor | shita | time | floor | ceil | confidence |
|---|---|---|---|---|---|
| `alot` | 16.1° | 05:25:09 | 05:25 | 05:26 | medium |
| *misheyakir* | 11.5° | 05:47:47 | 05:47 | 05:48 | medium |
| `netz` | sea level | 06:41:43 | 06:41 | 06:42 | **high** |
| `shema` | **GRA** | 09:16:12 | 09:16 | 09:17 | **high** |
| `shema` | MGA 16.1° | 08:37:55 | 08:37 | 08:38 | medium |
| *sof zman tfilla* | GRA | 10:07:42 | 10:07 | 10:08 | high |
| `chatzot` | midpoint | 11:50:41 | 11:50 | 11:51 | high |
| `mincha_gedola` | ½ zmanit | 12:16:26 | 12:16 | 12:17 | high |
| `mincha_gedola` | *lechumra* | 12:20:41 | 12:20 | 12:21 | high |
| `mincha_ketana` | GRA | 14:50:55 | 14:50 | 14:51 | high |
| `plag` | GRA | 15:55:17 | 15:55 | 15:56 | high |
| `shkia` | sea level | 16:59:40 | 16:59 | 17:00 | **high** |
| **`candle_lighting`** | **shkia − 22** | 16:37:40 | **16:37** | — | **highest — matches S4 published exactly** |
| `tzeit` | **8.5°** | 17:38:40 | 17:38 | 17:39 | medium — **S4 publishes יציאת שבת 17:40**, 1.3 min later |
| `tzeit` | 7.083° | 17:31:33 | 17:31 | 17:32 | medium |
| `tzeit` | 42 min | 17:41:40 | 17:41 | 17:42 | high (arithmetic) |
| `tzeit` | R"T 72 min | 18:11:40 | 18:11 | 18:12 | high (arithmetic) |

*shaa zmanit* = 00:51:29.

**The listing this date exists to protect:** `לכלל ישראל`, Shabbat Mincha =
`candle_lighting − 10min` → **16:27** (16:27:40). If the engine used 20 minutes instead
of 22, it would print 16:29 — two minutes late, on the one page where being late matters
most. If it used the diaspora default of 18 minutes, 16:31.

---

### 5.3 — 2026-03-26, Thursday. **IST (UTC+02)** — the last IST day. 8 Nisan 5786.

Independent corroboration: **NOAA netz 05:37, shkia 17:56. S2 netz 05:37:12, shkia 17:56:24.**

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 04:24:19 | 04:24 | 04:25 |
| *misheyakir* | 11.5° | 04:46:29 | 04:46 | 04:47 |
| `netz` | sea level | 05:37:10 | 05:37 | 05:38 |
| `shema` | **GRA** | 08:41:58 ⚠ | 08:41 | 08:42 |
| `shema` | MGA 16.1° | 08:05:34 | 08:05 | 08:06 |
| *sof zman tfilla* | GRA | 09:43:34 | 09:43 | 09:44 |
| `chatzot` | midpoint | 11:46:46 | 11:46 | 11:47 |
| `mincha_gedola` | ½ zmanit | 12:17:34 | 12:17 | 12:18 |
| `mincha_gedola` | *lechumra* | 12:17:34 | 12:17 | 12:18 |
| `mincha_ketana` | GRA | 15:22:22 | 15:22 | 15:23 |
| `plag` | GRA | 16:39:22 | 16:39 | 16:40 |
| `shkia` | sea level | 17:56:22 | 17:56 | 17:57 |
| `tzeit` | 7.083° | 18:26:02 ⚠ | 18:26 | 18:27 |
| `tzeit` | **8.5°** | 18:32:47 | 18:32 | 18:33 |
| `tzeit` | R"T 72 min | 19:08:22 | 19:08 | 19:09 |
| `candle_lighting` | shkia − 22 | 17:34:22 | 17:34 | — (Thursday — not a real zman) |

*shaa zmanit* = 01:01:36. Note this is the date where ½ *shaa zmanit* (30 m 48 s) first
exceeds 30 fixed minutes — the two `mincha_gedola` definitions coincide within a second
here and swap order either side of it.

---

### 5.4 — 2026-03-27, Friday. **DST BEGINS. IST until 01:59:59, IDT (UTC+03) from 03:00.** 9 Nisan 5786. Parashat Tzav. **Also erev Shabbat.**

This date is doing three jobs at once — DST transition, erev Shabbat, and a one-hour
jump in every anchor. It is the single most valuable date in this document.

Independent corroboration: **NOAA netz 06:36, shkia 18:57. S2 netz 06:35:55, shkia 18:57:05.**
**S4 (published): כניסת שבת 18:35, יציאת שבת 19:35.**

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 05:22:57 ⚠ | 05:22 | 05:23 |
| *misheyakir* | 11.5° | 05:45:08 | 05:45 | 05:46 |
| `netz` | sea level | 06:35:52 | 06:35 | 06:36 |
| `shema` | **GRA** | 09:41:09 | 09:41 | 09:42 |
| `shema` | MGA 16.1° | 09:04:44 | 09:04 | 09:05 |
| *sof zman tfilla* | GRA | 10:42:55 | 10:42 | 10:43 |
| `chatzot` | midpoint | 12:46:27 | 12:46 | 12:47 |
| `mincha_gedola` | ½ zmanit | 13:17:19 | 13:17 | 13:18 |
| `mincha_ketana` | GRA | 16:22:38 | 16:22 | 16:23 |
| `plag` | GRA | 17:39:50 | 17:39 | 17:40 |
| `shkia` | sea level | 18:57:03 ⚠ | 18:57 | 18:58 |
| **`candle_lighting`** | **shkia − 22** | 18:35:03 | **18:35** | — **matches S4 published exactly** |
| `tzeit` | **8.5°** | 19:33:30 | 19:33 | 19:34 | *(S4 publishes 19:35)* |
| `tzeit` | 7.083° | 19:26:44 | 19:26 | 19:27 |
| `tzeit` | R"T 72 min | 20:09:03 ⚠ | 20:09 | 20:10 |

*shaa zmanit* = 01:01:45.

**The one-hour jump, Thursday → Friday:**

| | Thu 2026-03-26 (IST) | Fri 2026-03-27 (IDT) | Δ clock |
|---|---|---|---|
| netz | 05:37 | 06:35 | +58 min |
| chatzot | 11:46 | 12:46 | +60 min |
| shkia | 17:56 | 18:57 | +61 min |
| candle lighting | (n/a) 17:34 | 18:35 | +61 min |

**Assert this.** Any code that caches yesterday's zmanim, or that works in
"minutes since midnight" without a timezone, or that computes offsets in UTC and formats
in local, breaks exactly here.

---

### 5.5 — 2026-07-15, Wednesday. **IDT (UTC+03)**. **1 Av 5786 — Rosh Chodesh Av.** Midsummer weekday.

**Fully corroborated by MyZmanim (S3), to the second:**

| anchor | shita | **S3 MyZmanim** | X1 Hebcal | use this | floor | ceil |
|---|---|---|---|---|---|---|
| `alot` | 16.1° | **04:19:38** | 04:19:24 | 04:19:3x | 04:19 | 04:20 |
| *misheyakir* | 11.5° | **04:46:48** | 04:46:37 | 04:46:4x | 04:46 | 04:47 |
| `netz` | sea level | **05:45:18** | 05:45:07 | 05:45:1x | 05:45 | 05:46 |
| `shema` | MGA 16.1° | **08:33:08** | 08:33:00 ⚠ | 08:33:0x | 08:33 | 08:34 |
| `shema` | **GRA** | **09:16:01** | 09:15:55 | 09:16:0x | 09:16 | 09:17 |
| *sof zman tfilla* | GRA | **10:26:16** | 10:26:11 | 10:26:1x | 10:26 | 10:27 |
| `chatzot` | midpoint | **12:46:45** | 12:46:43 | 12:46:4x | 12:46 | 12:47 |
| `mincha_gedola` | *lechumra* | **13:21:52** | 13:21:51 | 13:21:5x | 13:21 | 13:22 |
| `mincha_ketana` | GRA | — | 16:52:39 | 16:52:3x | 16:52 | 16:53 |
| `plag` | GRA | **18:20:23** | 18:20:29 | 18:20:2x | 18:20 | 18:21 |
| `shkia` | sea level | **19:48:12** | 19:48:19 | 19:48:1x | 19:48 | 19:49 |
| `tzeit` | ≈8.5° | **20:29:38** | 20:29:45 | 20:29:4x | 20:29 | 20:30 |
| `tzeit` | R"T 72 min | **21:00:12** | 21:00:19 | 21:00:1x | 21:00 | 21:01 |
| `candle_lighting` | shkia − 22 | — | 19:26:19 | 19:26:1x | 19:26 | — (Wednesday) |

NOAA (S1) independently: netz **05:45**, shkia **19:48**. *shaa zmanit* = 01:10:16.

MyZmanim labels its `mincha_gedola` **"Lechumra"** — in midsummer ½ *shaa zmanit*
(35 m 08 s) exceeds 30 fixed minutes, so *lechumra* = the zmanit value and the two
definitions agree. **They do not agree in winter.** See §9.3.

---

### 5.6 — 2026-07-17, Friday. **IDT (UTC+03)**. 3 Av 5786. Parashat Devarim. **Erev Shabbat, midsummer.**

**Corroborated by both MyZmanim (S3) and the Religious Council (S4).**
S4 published: **כניסת שבת 19:25, יציאת שבת 20:29.**

| anchor | shita | **S3 MyZmanim** | X1 Hebcal | floor | ceil |
|---|---|---|---|---|---|
| `alot` | 16.1° | **04:21:13** | 04:21:00 ⚠ | 04:21 | 04:22 |
| *misheyakir* | 11.5° | **04:48:14** | 04:48:03 ⚠ | 04:48 | 04:49 |
| `netz` | sea level | **05:46:28** | 05:46:18 | 05:46 | 05:47 |
| `shema` | MGA 16.1° | **08:34:01** | 08:33:53 | 08:33 | 08:34 |
| `shema` | **GRA** | **09:16:41** | 09:16:35 | 09:16 | 09:17 |
| *sof zman tfilla* | GRA | **10:26:46** | 10:26:41 | 10:26 | 10:27 |
| `chatzot` | midpoint | **12:46:55** | 12:46:53 | 12:46 | 12:47 |
| `mincha_gedola` | *lechumra* | **13:21:57** | 13:21:56 ⚠ | 13:21 | 13:22 |
| `mincha_ketana` | GRA | — | 16:52:14 | 16:52 | 16:53 |
| `plag` | GRA | **18:19:46** | 18:19:51 | 18:19 | 18:20 |
| **`candle_lighting`** | **shkia − 22** | **19:25:22** | 19:25:29 | **19:25** | — |
| `shkia` | sea level | **19:47:22** | 19:47:29 | 19:47 | 19:48 |
| `tzeit` | ≈8.5° | **20:28:38** | 20:28:45 | 20:28 | 20:29 |
| `tzeit` | R"T 72 min | **20:59:22** | 20:59:29 | 20:59 | 21:00 |

NOAA (S1): netz **05:46**, shkia **19:47**. *shaa zmanit* = 01:10:05.

**Three sources agree on candle lighting to within 7 seconds and to the exact printed
minute: MyZmanim 19:25:22 (explicitly "22 minutes before sunset"), the Religious
Council's published poster 19:25, and shkia − 22 from Hebcal's shkia 19:25:29.**

`לכלל ישראל` Shabbat Mincha = `candle_lighting − 10min` → **19:15**.

---

### 5.7 — 2026-10-23, Friday. **IDT (UTC+03)**. 12 Cheshvan 5787. Erev Shabbat, two days before DST ends.

Included because it is the erev Shabbat *inside* the DST-end weekend. Not on the S4
poster (5786 ended in September 2026); candle lighting below is `shkia − 22` by rule.

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 05:37:13 | 05:37 | 05:38 |
| `netz` | sea level | 06:50:11 | 06:50 | 06:51 |
| `shema` | GRA | 09:37:33 | 09:37 | 09:38 |
| `chatzot` | midpoint | 12:24:56 ⚠ | 12:24 | 12:25 |
| `mincha_gedola` | ½ zmanit | 12:52:50 | 12:52 | 12:53 |
| `mincha_gedola` | *lechumra* | 12:54:56 ⚠ | 12:54 | 12:55 |
| `mincha_ketana` | GRA | 15:40:13 | 15:40 | 15:41 |
| `plag` | GRA | 16:49:57 ⚠ | 16:49 | 16:50 |
| `candle_lighting` | shkia − 22 | 17:37:42 | **17:37** | — |
| `shkia` | sea level | 17:59:42 | 17:59 | 18:00 |
| `tzeit` | 8.5° | 18:36:32 | 18:36 | 18:37 |

NOAA (S1): netz **06:50**, shkia **18:00**.

---

### 5.8 — 2026-10-24, Saturday. **IDT (UTC+03)** — the last IDT day. 13 Cheshvan 5787. Shabbat.

Independent corroboration: **NOAA netz 06:51, shkia 17:59. S2 netz 06:51:01, shkia 17:58:42.**

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 05:37:55 | 05:37 | 05:38 |
| *misheyakir* | 11.5° | 05:59:45 | 05:59 | 06:00 |
| `netz` | sea level | 06:50:57 ⚠ | 06:50 | 06:51 |
| `shema` | **GRA** | 09:37:52 | 09:37 | 09:38 |
| `shema` | MGA 16.1° | 09:01:20 | 09:01 | 09:02 |
| *sof zman tfilla* | GRA | 10:33:31 | 10:33 | 10:34 |
| `chatzot` | midpoint | 12:24:48 | 12:24 | 12:25 |
| `mincha_gedola` | ½ zmanit | 12:52:37 | 12:52 | 12:53 |
| `mincha_gedola` | *lechumra* | 12:54:48 | 12:54 | 12:55 |
| `mincha_ketana` | GRA | 15:39:32 | 15:39 | 15:40 |
| `plag` | GRA | 16:49:05 | 16:49 | 16:50 |
| `shkia` | sea level | 17:58:39 | 17:58 | 17:59 |
| `tzeit` | **8.5°** (end of Shabbat) | 18:35:32 | 18:35 | **18:36** |
| `tzeit` | R"T 72 min | 19:10:39 | 19:10 | 19:11 |
| `candle_lighting` | shkia − 22 | 17:36:39 | 17:36 | — (Shabbat — not a real zman) |

*shaa zmanit* = 00:55:38.

---

### 5.9 — 2026-10-25, Sunday. **DST ENDS. IDT until 01:59:59, then IST (UTC+02) from 01:00 (repeated hour).** 14 Cheshvan 5787.

Independent corroboration: **NOAA netz 05:52, shkia 16:58. S2 netz 05:51:48, shkia 16:57:40.**

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 04:38:37 | 04:38 | 04:39 |
| *misheyakir* | 11.5° | 05:00:28 | 05:00 | 05:01 |
| `netz` | sea level | 05:51:44 | 05:51 | 05:52 |
| `shema` | **GRA** | 08:38:12 | 08:38 | 08:39 |
| `shema` | MGA 16.1° | 08:01:38 | 08:01 | 08:02 |
| *sof zman tfilla* | GRA | 09:33:42 | 09:33 | 09:34 |
| `chatzot` | midpoint | 11:24:41 | 11:24 | 11:25 |
| `mincha_gedola` | ½ zmanit | 11:52:25 | 11:52 | 11:53 |
| `mincha_gedola` | *lechumra* | 11:54:41 | 11:54 | 11:55 |
| `mincha_ketana` | GRA | 14:38:54 | 14:38 | 14:39 |
| `plag` | GRA | 15:48:16 | 15:48 | 15:49 |
| `shkia` | sea level | 16:57:38 | 16:57 | 16:58 |
| `tzeit` | 8.5° | 17:34:34 | 17:34 | 17:35 |
| `tzeit` | R"T 72 min | 18:09:38 | 18:09 | 18:10 |
| `candle_lighting` | shkia − 22 | 16:35:38 | 16:35 | — (Sunday) |

*shaa zmanit* = 00:55:29.

**The one-hour drop, Saturday → Sunday:**

| | Sat 2026-10-24 (IDT) | Sun 2026-10-25 (IST) | Δ clock |
|---|---|---|---|
| netz | 06:50 | 05:51 | −59 min |
| chatzot | 12:24 | 11:24 | −60 min |
| shkia | 17:58 | 16:57 | −61 min |

**Assert this too**, and note what it does to the product: a `fixed` 18:00 Arvit was
*after* shkia on Saturday and is now an hour *after* nightfall on Sunday. A `relative`
`shkia + 20min` needs nobody to touch it. That is the core invariant, demonstrated on
a specific Sunday.

---

### 5.10 — 2026-12-21, Monday. **IST (UTC+02)**. 11 Tevet 5787. Winter solstice.

Independent corroboration: **NOAA netz 06:37, shkia 16:40. S2 netz 06:37:29, shkia 16:40:17.**

| anchor | shita | time | floor | ceil |
|---|---|---|---|---|
| `alot` | 16.1° | 05:19:18 | 05:19 | 05:20 |
| *misheyakir* | 11.5° | 05:42:19 | 05:42 | 05:43 |
| `netz` | sea level | 06:37:27 | 06:37 | 06:38 |
| `shema` | **GRA** | 09:08:09 | 09:08 | 09:09 |
| `shema` | MGA 16.1° | 08:29:05 | 08:29 | 08:30 |
| `shema` | MGA 72 fixed min | 08:32:09 | 08:32 | 08:33 |
| *sof zman tfilla* | GRA | 09:58:24 | 09:58 | 09:59 |
| `chatzot` | midpoint | 11:38:52 | 11:38 | 11:39 |
| `mincha_gedola` | ½ zmanit | **12:03:59** ⚠ | 12:03 | 12:04 |
| `mincha_gedola` | ***lechumra*** | **12:08:52** | 12:08 | 12:09 |
| `mincha_ketana` | GRA | 14:34:42 | 14:34 | 14:35 |
| `plag` | GRA | 15:37:30 | 15:37 | 15:38 |
| `shkia` | sea level | 16:40:18 | 16:40 | 16:41 |
| `tzeit` | 7.083° | 17:12:57 ⚠ | 17:12 | 17:13 |
| `tzeit` | **8.5°** | 17:20:12 | 17:20 | 17:21 |
| `tzeit` | R"T 72 min | 17:52:18 | 17:52 | 17:53 |
| `candle_lighting` | shkia − 22 | 16:18:18 | 16:18 | — (Monday) |

*shaa zmanit* = **00:50:14** — the shortest of the year. The two `mincha_gedola`
definitions are **4 m 53 s apart** here (§9.3). This is the best date to assert that
difference.

#### ⚠️ The brief's premise is wrong: 2026-12-21 is **not** the earliest shkia of the year

From NOAA (S1), Tel Aviv 2026, sea level, IST:

| | value | dates |
|---|---|---|
| **Earliest shkia of 2026** | **16:36** | **2026-11-27 through 2026-12-10** (a 14-day plateau) |
| shkia on the solstice | 16:40 | 2026-12-21 |
| Latest sunrise of 2026 | 06:43 | 2027-01-08 to 01-09 |
| Latest shkia of 2026 | 19:51 IDT | 2026-06-22 through 2026-07-07 |

The solstice is the **shortest day**, not the earliest sunset — the equation of time
moves solar noon later through December, so sunset starts creeping back about ten days
*before* the solstice while sunrise is still getting later. **If a test is named
"earliest shkia of the year" it must use 2026-12-01, not 2026-12-21.** Keep 2026-12-21
as the shortest-day / smallest-*shaa-zmanit* case, which is what it is genuinely
extreme for.

---

## 6. Offset resolution — the property the architecture rests on

Same stored rule, `{ kind: 'relative', anchor: 'shkia', offsetMinutes: -20 }`
(the parse of `מנחה 20 דק' לפי שקיעה`), resolved across the year. Nobody edits the record.

| date | shkia | **`shkia − 20min`** | tz |
|---|---|---|---|
| 2026-01-14 | 16:57:52 | **16:37** (16:37:52) | IST |
| 2026-01-16 | 16:59:40 | **16:39** (16:39:40) | IST |
| 2026-03-26 | 17:56:22 | **17:36** (17:36:22) | IST |
| 2026-03-27 | 18:57:03 | **18:37** (18:37:03) | IDT |
| 2026-07-15 | 19:48:19 | **19:28** (19:28:19) | IDT |
| 2026-07-17 | 19:47:29 | **19:27** (19:27:29) | IDT |
| 2026-10-23 | 17:59:42 | **17:39** (17:39:42) | IDT |
| 2026-10-24 | 17:58:39 | **17:38** (17:38:39) | IDT |
| 2026-10-25 | 16:57:38 | **16:37** (16:37:38) | IST |
| 2026-12-21 | 16:40:18 | **16:20** (16:20:18) | IST |
| **2026-12-01** (earliest shkia) | 16:36 (S1, minute precision) | **≈16:16** | IST |
| **2026-07-01** (latest shkia) | 19:51 (S1, minute precision) | **≈19:31** | IDT |

**Full annual swing of one unedited record: 3 h 15 min.** That is the whole argument for
the core invariant, expressed as a number.

And the `candle_lighting − 10min` rule (`מנחה - 10 דק' לפי כניסת שבת`, `לכלל ישראל`):

| erev Shabbat | shkia | candle (shkia−22) | **`candle_lighting − 10min`** |
|---|---|---|---|
| 2026-01-16 | 16:59:40 | 16:37 *(S4 published)* | **16:27** |
| 2026-03-27 | 18:57:03 | 18:35 *(S4 published)* | **18:25** |
| 2026-07-17 | 19:47:29 | 19:25 *(S4 published)* | **19:15** |
| 2026-10-23 | 17:59:42 | 17:37 *(by rule)* | **17:27** |

---

## 7. Question 1 — candle lighting minutes for Tel Aviv

### 7.1 The answer: **22 minutes before shkia**, and the sources disagree

| Source | Tel Aviv candle lighting, Fri 2026-08-28 | implied offset |
|---|---|---|
| **המועצה הדתית תל אביב-יפו** — official 5786 poster (S4) | **18:48** | **22 min** |
| **MyZmanim**, location `Tel Aviv Yafo` — explicitly labelled `22 minutes before sunset / 22 דקות קודם השקיעה` (S3) | **18:48:12** | **22 min** |
| Kipa.co.il, `כניסת שבת / תל אביב` (S6) | 18:50 | 20 min |
| Hebcal web, geonameid 293397 "Tel Aviv" (X1) | 18:50 | 20 min |

(Sea-level shkia that day is 19:10:12 per MyZmanim, 19:10:15 per Hebcal.)

**This is a real disagreement between published authorities, not a rounding artefact.**
I am naming both rather than picking silently.

### 7.2 Why I recommend 22, with high confidence

1. **The Tel Aviv-Yafo Religious Council is the local halachic authority** for exactly
   the 484 shuls in our database. Its poster is what hangs in Tel Aviv shul lobbies.
2. **The 22-minute rule is verified across the entire year, not sampled.** I checked all
   34 published Fridays of 5786 that fall in calendar 2026 against sea-level shkia:

   > implied offset range **21.98 – 23.02 minutes**; `floor(shkia − 22 min)` reproduces
   > the printed minute on **32 of 34** Fridays exactly, and the two misses
   > (2026-06-26, 2026-08-07) are 1-minute rounding at boundaries where the Council's
   > own shkia differs from ours by 1–4 seconds. There is no date on which 20 or 21 or
   > 23 minutes fits.

3. **It is the more stringent direction.** Lighting two minutes early costs nothing;
   two minutes late is a d'Oraita chillul Shabbat. Where authorities split, the
   product should not be the late one.
4. Our `candle_lighting − 10min` Mincha at `לכלל ישראל` also lands two minutes earlier,
   which errs toward people arriving on time.

**Concrete instruction for the engine:** do **not** rely on `@hebcal/core`'s built-in
`candleLightingMins` for the Tel Aviv geoname — it is 20. Set 22 explicitly, in one
named constant, with this document cited next to it.

For reference, the other Israeli city offsets in general use — **not verified by me,
listed only so nobody hard-codes Tel Aviv's 22 for the whole country**: Jerusalem 40,
Haifa 30, Petach Tikva ~21–22, Be'er Sheva ~20–22. **Flagged as unverified.**

### 7.3 יציאת שבת (end of Shabbat) — related but a different question

The Council's published motzash sits at a solar depression of **≈8.4°–8.8°**
(interpolated against sunrisesunset.io's 6°/12° twilight), i.e. essentially **8.5°**,
and runs **36.5 to 43.5 minutes after shkia** depending on season. A computed 8.5° tzeit
reproduces it to within **0–2 minutes**, always on the early side.

| erev Shabbat | S4 published יציאת שבת | computed tzeit 8.5° | Δ |
|---|---|---|---|
| 2026-01-16 | 17:40 | 17:38:40 | +1.3 min |
| 2026-03-27 | 19:35 | 19:33:30 | +1.5 min |
| 2026-07-17 | 20:29 | 20:28:45 | +0.25 min |
| 2026-08-28 | 19:47 | 19:46:24 | +0.6 min |

**Recommendation:** if we ever print "Shabbat ends", either import the Council's table
verbatim or compute 8.5° **and round up**, and label it. Do not print a value earlier
than the Council's.

---

## 8. Question 3 — the sunset rollover, and which boundary governs a *minyan*

### 8.1 The Hebrew calendar date rolls at **shkia**, not tzeit — confirmed

The halachic day begins at sunset. The interval between shkia and tzeit
(*bein hashmashot*) is of doubtful status — possibly still day, possibly already night —
and is resolved stringently in both directions. **For assigning a Gregorian instant to a
Hebrew calendar date, the boundary is shkia.** `CLAUDE.md` already states this; it is
correct.

**Assertions to write (Ramat Aviv, 2026-01-14, shkia 16:57:52 IST):**

| instant (Asia/Jerusalem) | Hebrew date |
|---|---|
| 2026-01-14 12:00 | 25 Tevet 5786 |
| 2026-01-14 16:57:00 (before shkia) | 25 Tevet 5786 |
| 2026-01-14 16:58:30 (after shkia, before tzeit) | **26 Tevet 5786** |
| 2026-01-14 18:00 | 26 Tevet 5786 |
| 2026-01-14 23:59 | 26 Tevet 5786 |
| 2026-01-15 00:30 | 26 Tevet 5786 — **the Hebrew date does not change at midnight** |

That last row is the off-by-one that silently shifts a whole day's listings.

### 8.2 Which boundary governs whether a *minyan* belongs to the next Hebrew day

**These are not the same boundary, and the distinction is real.** Three cases:

1. **Arvit / Maariv on an ordinary weekday.** Belongs to the **incoming** Hebrew day.
   Normative practice is to daven it after **tzeit**; b'dieved (and very commonly in
   Israeli shuls that daven Mincha and Arvit back to back) it is davened after **plag**,
   before shkia — and it *still* counts as the next day's Arvit. So a minyan can be
   listed at a clock time that is on Hebrew day *N* by the calendar boundary while being
   Arvit of day *N+1*.
2. **Kabbalat Shabbat on Friday.** Almost always *before* shkia. Shabbat has not
   calendrically begun, yet the service is unambiguously Shabbat's. Same for a shul
   whose Shabbat Mincha is `candle_lighting − 10min`.
3. **Shabbat/Yom Tov ending.** Nothing belonging to the next day may be scheduled until
   **tzeit** — the stringent one (§7.3), not shkia.

**Recommended model for the code — two separate fields, never one:**

```
hebrewDate(instant)     -> rolls at SHKIA.            // calendar labelling
liturgicalDay(minyan)   -> declared per service type. // which day's tefillah this is
```

`liturgicalDay` is a property of the *service*, not of the clock: Shacharit/Mincha
belong to the day that contains them; Arvit/Kabbalat Shabbat belong to the day that is
beginning. Deriving it from the timestamp alone will be wrong for every Friday-evening
minyan in the database.

**For "is tonight's Arvit today's or tomorrow's":** it is tomorrow's, always — from the
moment it is davened, whether that is after plag, after shkia, or after tzeit. Group it
with the incoming day in the UI; a user looking for "Maariv tonight" on Tuesday evening
is looking for Wednesday's Arvit and does not know or care.

---

## 9. Question 4 — Adar I / Adar II, and question 5 — everything else

### 9.1 The `tzeit` anchor is doing two different jobs — **fix this before shipping**

`Zman` has one `tzeit`. In the source data, `צאת הכוכבים` on a minyan listing and
`יציאת שבת` on a luach are **different times, 15–25 minutes apart**:

| use | typical Israeli value | for 2026-01-14 (shkia 16:57:52) |
|---|---|---|
| Arvit "at tzeit" in a Tel Aviv shul | shkia + 13.5 / 18 / 20 / 25 min (varies by shul and nusach) | 17:11 – 17:23 |
| End of Shabbat / end of a fast | 8.5° (≈ shkia + 39 min here) | 17:37 |
| Rabbeinu Tam | 72 min | 18:10 |

If `tzeit` resolves to 8.5° and we use it to place an Arvit minyan, we list that minyan
**20+ minutes late** — the exact failure this project exists to avoid. Two options,
both acceptable, pick one and write it down:

- **Preferred:** `tzeit` means the stringent 8.5° value (matching the Rabbanut), and a
  shul's `בזמן` Arvit stays `kind: 'unknown'` until a gabbai tells us the offset. Honest
  blank, per the core invariant.
- Alternative: carry a shita tag on the anchor (`tzeit:8.5deg`, `tzeit:20min`) and
  require the tag at parse time.

**Never map a bare `בזמן` on an Arvit line onto any tzeit value.** That is guessing an
offset.

### 9.2 `candle_lighting` is undefined on most dates

It exists only on **erev Shabbat and erev Yom Tov** — and not even on all of those.
Resolving `candle_lighting − 10min` on a Tuesday must return *undefined*, not
`shkia − 32min`. Test that it does.

**And the case that will actually bite:** when Yom Tov falls on **Saturday night**
(i.e. motzei Shabbat into Yom Tov), candle lighting is **after tzeit**, from a
pre-existing flame — it is *not* `shkia − 22`. The Council's own poster shows this: for
2025-09-22 (erev Rosh Hashana, Monday) it prints a כניסה time and no יציאה; for
2025-09-24 (2nd day Rosh Hashana) it prints a יציאה time and **no כניסה**, because that
night's lighting is at nightfall.

Live cases in our window:

| date | what | why it breaks a naive rule |
|---|---|---|
| **2026-09-12 Sat** | Rosh Hashana I 5787 **on Shabbat** | candles Fri 2026-09-11 at shkia−22; second night's candles Sat 2026-09-12 **after tzeit** |
| **2026-09-26 Sat** | Sukkot I **on Shabbat** | same shape |
| **2026-10-03 Sat** | Shmini Atzeret **on Shabbat** | same shape |
| 2027-04-24 Sat | Pesach III (chol hamoed) on Shabbat | ordinary Shabbat, but the *schedule* is the Yom Tov one |

The first of those is **17 days from today**. It is the highest-priority calendar bug
in the codebase right now.

### 9.3 `mincha_gedola` — two definitions that only diverge in winter

`mincha_gedola` = chatzot + ½ *shaa zmanit*, **or** chatzot + 30 fixed minutes, and the
*lechumra* (stringent) opinion takes the **later** of the two. MyZmanim labels its value
`Lechumra / לחומרא`. They diverge whenever a *shaa zmanit* is under 60 minutes — i.e.
the entire Israeli winter:

| date | *shaa zmanit* | ½ zmanit | +30 fixed | *lechumra* | gap |
|---|---|---|---|---|---|
| 2026-12-21 | 00:50:14 | 12:03:59 | 12:08:52 | **12:08:52** | **4 m 53 s** |
| 2026-01-14 | 00:51:18 | 12:15:37 | 12:19:58 | **12:19:58** | 4 m 21 s |
| 2026-10-25 | 00:55:29 | 11:52:25 | 11:54:41 | **11:54:41** | 2 m 16 s |
| 2026-03-26 | 01:01:36 | 12:17:34 | 12:16:46 | **12:17:34** | 48 s (crossover ≈ this date) |
| 2026-07-15 | 01:10:16 | 13:21:51 | 13:16:43 | **13:21:51** | 5 m 08 s |

This matters commercially, not just halachically: **`מנחה גדולה` minyanim are the
lunchtime Tel Aviv product** — the Religious Council maintains a dedicated
`תפילת מנחה גדולה` page. A five-minute error on a 13:00 office minyan is the difference
between catching it and not.

### 9.4 chatzot ≠ solar noon

`chatzot` as netz+6 *shaot zmaniyot* is the midpoint of sunrise and sunset, which is
**not** the astronomical solar transit. NOAA's solar noon vs our chatzot:

| date | NOAA solar noon (S1) | chatzot (midpoint) | Δ |
|---|---|---|---|
| 2026-01-14 | 11:49:41 | 11:49:58 | 17 s |
| 2026-07-15 | 12:46:49 | 12:46:43 | 6 s |
| 2026-12-21 | 11:38:38 | 11:38:52 | 14 s |

Small, but it is enough to flip a displayed minute — 2026-01-14 chatzot is 11:49:58,
four seconds from the boundary. Use the midpoint definition consistently and do not
"correct" it toward solar noon.

### 9.5 `ח` / `ק` in the source data means **DST**, not the season

`ח 12:30 ק 13:30` is `חורף` / `קיץ`, and in Israeli speech these are `שעון חורף` /
`שעון קיץ` — **the clock, not the weather**. The switchover dates are therefore
**2026-03-27** and **2026-10-25**, the DST transitions, not the equinoxes and not
1 April / 1 October. Modelling this as a `fixed` time with a validity window keyed to
the DST transition is correct; keying it to a Gregorian month is not.
*(Confidence: high on the linguistic reading, but this is a claim about what 16 specific
gabbaim meant — worth one WhatsApp round to confirm before it ships.)*

### 9.6 Adar I / Adar II — 5787 **is** a leap year, confirmed

**Confirmed.** 5787 mod 19 = 11, and 11 is one of the leap positions {3, 6, 8, 11, 14,
17, 19} in the Metonic cycle. Verified against the calendar:

| | 5786 (2025–26) — **regular** | 5787 (2026–27) — **leap** |
|---|---|---|
| month name returned | `Adar` (אדר) | `Adar I` (אדר א׳) **and** `Adar II` (אדר ב׳) |
| 1 Adar / 1 Adar I | 2026-02-18 | **2027-02-08** |
| 1 Adar II | — | **2027-03-10** |
| Purim (14 Adar / 14 Adar II) | **2026-03-03** | **2027-03-23** |
| Purim Katan (14 Adar I) | — | 2027-02-21 |
| Ta'anit Esther | 2026-03-02 | 2027-03-22 |
| length | Adar = 29 days | Adar I = **30** days, Adar II = 29 days |

**The specific trap a naive implementation falls into**, in order of how likely it is to
actually happen:

1. **String-matching the month name.** In a regular year the month is `Adar`; in a leap
   year it is `Adar I` / `Adar II` and **the string `Adar` never appears alone**.
   `hm === 'Adar'` silently matches nothing for the whole of 5787, and any listing keyed
   to it disappears from February to April 2027. `startsWith('Adar')` over-matches and
   fires twice. Neither is right; compare on the month *number* plus an explicit
   `isLeapYear` branch.
2. **Assuming 12 months.** 5787 has **13**. Any `for (m = 1; m <= 12; m++)` over Hebrew
   months, or `(month % 12)` arithmetic, drops or aliases a month.
3. **Assuming month numbers are stable across years.** Nisan is month 1; in a leap year
   the months after Shvat all shift by one. A Hebrew month index cached in the database
   in 5786 means a different month in 5787.
4. **Rosh Chodesh fires twice, and each time for two days.** Because Shvat has 30 days,
   Rosh Chodesh Adar I is **2027-02-07 and 2027-02-08**; because Adar I has 30 days,
   Rosh Chodesh Adar II is **2027-03-09 and 2027-03-10**. A "Rosh Chodesh minyan" rule
   written as "once a month, one day" is wrong on both counts, in both directions.
5. **`30 Adar` exists only in a leap year** (as 30 Adar I). A stored `30 Adar` yahrzeit
   or anniversary has no counterpart in a regular year and must be resolved by rule.
6. **Which Adar a regular-year date maps into is disputed** — for a yahrzeit from a
   regular year, the Shulchan Aruch says Adar II and the Rema says Adar I (and both in
   subsequent years, per some). **Do not resolve this silently.** It does not affect
   minyan times, but it will affect any yahrzeit feature.
7. **Israel keeps one day of Yom Tov.** Every calendar call needs `il: true`. Getting it
   wrong invents an eighth day of Pesach and a second day of Shavuot that no Tel Aviv
   shul observes. Worth noting in the UI for our chutz-la'aretz users, who *do* keep two
   days but will be davening in Israeli shuls that do not.

### 9.7 Fast days — three different start rules

| fast | starts | ends | in our window |
|---|---|---|---|
| **Yom Kippur** | previous evening at **shkia** (with *tosefet*, in practice at candle lighting = shkia − 22) | tzeit, stringent | 2026-09-21 Mon; erev 2026-09-20 Sun |
| **Tish'a B'Av** | previous evening at **shkia** | tzeit, stringent | 2026-07-23 Thu; erev 2026-07-22 Wed |
| **The four minor fasts** (Tzom Gedaliah, Asara B'Tevet, Ta'anit Esther, Shiva Asar b'Tammuz) | **alot hashachar on the day itself** — *not* the night before | tzeit | Tzom Tammuz 2026-07-02; Tzom Gedaliah 2026-09-14; **Asara B'Tevet 2026-12-20**; Ta'anit Esther 2027-03-22 |
| **Ta'anit Bechorot** | alot, erev Pesach | usually discharged by a siyum | 2027-04-21 Wed |

Consequences for the schedule engine:

- On a minor fast, `alot` is a **service-relevant** anchor, not just a display value —
  and its shita is disputed (§2.1), so the fast start is disputed too. **Label it.**
- Fast days change the *schedule*: Mincha moves later (with Torah reading and
  *Aneinu*), and on Tish'a B'Av Mincha is deliberately late. A minyan record scraped
  from a normal week is wrong on those days. Treat "does this shul have a special fast-day
  schedule" as `unknown` rather than assuming the weekday one.
- **Asara B'Tevet is the only fast that can fall on a Friday** and is observed then, into
  Shabbat. In 5787 it falls on Sunday 2026-12-20, so this is not exercised — but the rule
  must not be "fasts never fall on erev Shabbat".
- **Minor fasts move when 13 Adar / 17 Tammuz / 9 Av falls on Shabbat**: Ta'anit Esther
  moves *backward* to the preceding Thursday; the others move *forward* to Sunday. Both
  directions exist; do not hard-code one.
- **Erev Yom Kippur** (2026-09-20) is its own schedule: an early Shacharit, Mincha in the
  early afternoon *before* the seudah mafseket, then Kol Nidrei before shkia. None of
  that resembles a Sunday.

### 9.8 Solar midnight (*chatzot halayla*) flips across the DST boundary

Not one of our ten anchors, but it will appear the moment anyone lists a *tikkun chatzot*
or a late-night minyan. Solar midnight in Tel Aviv is at roughly **23:50 IST** (i.e. on
the *previous* calendar date) and roughly **00:25 IDT** (on the current one). The
calendar date it belongs to therefore changes twice a year. Any "chatzot halayla for
date D" API needs an explicit convention.

### 9.9 The user's device is in another timezone

Half our users are travellers. **Every time rendered must be computed and formatted in
`Asia/Jerusalem` regardless of the device.** Since the app is server-rendered this is
mostly free, but two things leak:

- Any `new Date()`, `toLocaleTimeString()` or date arithmetic that runs client-side
  (the "next minyan in 40 minutes" countdown is exactly this) will use the device zone.
- **Test with `TZ=America/New_York` and `TZ=Australia/Sydney` set**, not just UTC. UTC
  passes tests that Sydney fails, because Sydney is on the other side of the date line
  from Jerusalem for part of the day — a naive `toISOString().slice(0,10)` returns
  *tomorrow's* date for a Sydney user at 09:00 Jerusalem time.
- Consider showing "Tel Aviv time" explicitly in the UI when the device zone differs.

### 9.10 Ordering — what can and cannot invert

Within a single shita (GRA), the ordering `alot < netz < shema < chatzot <
mincha_gedola < mincha_ketana < plag < shkia < tzeit` **can never invert** — they are
fixed multiples of the same *shaa zmanit*. Assert it as an invariant on every date; if
it ever fails, the day length went negative or a timezone leaked.

What *can* invert:

- **Across shitot.** MGA `mincha_ketana` (2026-01-14: 15:31:34) is later than GRA
  `mincha_ketana` (14:49:34) and can pass GRA `plag` (15:53:43) on some days. If the
  UI ever mixes, the timeline sorts nonsensically.
- **Offsets against each other.** `shkia − 20min` (16:37:52 on 2026-01-14) sits between
  `plag` and `shkia`, but `netz − 25min` in June lands before `misheyakir` and close to
  `alot`. A resolved offset can legitimately fall outside the anchor ordering —
  **the "next minyan" sort must sort on resolved instants, never on anchor rank.**
- **No zman is undefined at 32°N.** All degree-based zmanim (16.1°, 19.8°, 11.5°, 8.5°,
  7.083°) are reached every day of the year here. The library's polar-region "returns
  null" branch will never fire for Tel Aviv — which means it will also never be tested.
  If the code has an `if (t === null)` path, exercise it with a synthetic high-latitude
  fixture, or delete it.

---

## 10. Confidence register — read this before quoting anything above

| Claim | Confidence | Basis |
|---|---|---|
| netz & shkia, all ten dates | **High** | Three independent sources within 3 s (NOAA, sunrisesunset.io, MyZmanim where available) |
| shema/chatzot/mincha gedola/mincha ketana/plag (GRA), all ten dates | **High** | Derived from independent netz/shkia; matches the engine within 4 s on every date |
| Tel Aviv candle lighting = shkia − 22 min | **High** | Official Religious Council poster verified across 34 Fridays + MyZmanim's explicit label. **But Hebcal and Kipa publish 20 — a real dispute, named in §7.** |
| Rabbanut motzash ≈ 8.5° | **Medium-high** | Fits 0–2 min across the year; the exact algorithm the Council uses is not published |
| `alot` 16.1° and `misheyakir` 11.5° on the six dates **without** MyZmanim coverage (2026-01-14, 01-16, 03-26, 03-27, 10-23, 10-24, 10-25, 12-21) | **Medium — flagged** | Only the app's own engine family. Corroborated on 2026-07-15/17 to within 14 s, which makes the method sound, but these specific values are **not** independently confirmed. Treat as regression baselines, not as authority. |
| `tzeit` 8.5° on those same dates | **Medium — flagged** | Same caveat |
| DST transition instants | **High** | IANA tzdb 2026c + the statutory rule, cross-confirmed by NOAA's own DST-aware table |
| Hebrew dates and 5787 leap-year structure | **High** | Hebrew calendar arithmetic is deterministic and not disputed between sources |
| Israeli candle-lighting minutes for cities **other than Tel Aviv** | **Unverified — do not use** | §7.2 |
| §9.5, that `ח`/`ק` means DST rather than season | **Medium** | Linguistically near-certain; a claim about 16 gabbaim's intent, so verify by asking |

**Anything marked Medium above is safe to use as a regression baseline — "the engine
still returns what it returned last week" — and is not safe to cite as "the correct
halachic time". If a Medium value ever needs to be authoritative, re-derive it from
MyZmanim within its ±6-week free window, or from a printed luach.**

---

## 11. Reproducing this

```bash
# S1 — NOAA, whole year, both coordinate sets
curl -A "Mozilla/5.0" "https://gml.noaa.gov/grad/solcalc/table.php?lat=32.1134&lon=34.7857&year=2026"

# S2 — sunrisesunset.io, to the second
curl "https://api.sunrisesunset.io/json?lat=32.1134&lng=34.7857&date=2026-01-14&time_format=24&timezone=Asia/Jerusalem"

# S3 — MyZmanim, Tel Aviv Yafo (free window is roughly +/- 6 weeks of today).
#      POST txtPickDate=M/D/YYYY + btnChangeDate=Apply with the page's ASP.NET
#      __VIEWSTATE/__EVENTVALIDATION; the 302 Location carries a server-signed
#      day.aspx?vars=27512341/M-D-YYYY/.../<hash> URL.

# S4 — Tel Aviv-Yafo Religious Council, official 5786 Shabbat times poster
curl -O "https://rabanut.co.il/wp-content/uploads/2025/09/rabanot_flayer_zmani_shabat_17x24_11_print.pdf"

# S5 — DST transitions
zdump -v Asia/Jerusalem | grep 2026
```

The 5787 poster was not yet published as of 2026-08-26; check `rabanut.co.il` in
September 2026 and refresh §5.7 – §5.10's candle-lighting values against it.
