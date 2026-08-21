# Star Quest Campaign — Game Design Document

A design document for turning the [star-quest-course](https://github.com/grammarmetric/star-quest-course)
12-week study plan into one continuous, session-spanning game, built from a
real diagnostic run and from Oxford Discover assets that already exist but
aren't wired into either repo yet.

- **Player:** age 7, 1:1, online
- **Session:** 2 hours &times; 12 weeks
- **Engine home:** this repo (`star-quest`) + `star-quest-course`
- **Drafted:** 2026-08-21

No code in this repo implements this yet — this is the design layer only.

## Design pillars

**The game doesn't sit on top of the lesson — it IS the lesson.** Every quest,
boss battle and badge below is real Oxford Discover / KET content already in
the 12-week plan, re-skinned. No separate "reward game" bolted onto drills.

**Progress survives the click of "leave meeting."** star-quest today re-levels
from scratch each run. The campaign needs one thing it doesn't have yet: an
avatar + XP bar that persists across all 12 weeks, not just within one
session.

**She's racing herself, not a leaderboard.** No peers online to compete
against. The competitive hook is a personal-best clock and streak — "beat your
own listening time from last week" — not a ranked board.

**2 hours is four attention spans, not one.** The session is chaptered with
scheduled movement breaks, because at 7 the real risk to a 2-hour block is
attention, not content difficulty.

## The world map

The plan's existing five phases, unchanged in content, re-cast as five regions
on one continuous map. Naming is deliberately generic terrain — no character
names — matching the name-free convention already set for this repo. Region 5
is where all four accent colors meet, the same convention the report screen
already uses for the four-domain comparison.

| # | Region | Content | Weeks |
|---|--------|---------|-------|
| 1 | Weather Coast | Present tense, "now" vs. "this morning" — the exact trap that beat the real listening run | 1–2 |
| 2 | Vowel Hollow | Spelling log, vowel teams, the schwa error pattern | 3–5 |
| 3 | Story Marsh | Opposites, prohibition signs (can't / shouldn't / must not) | 6–7 |
| 4 | Ceiling Peak | Push every domain past where the diagnostic stopped testing | 8–10 |
| 5 | Summit — the Reassessment | Full timed exam, then the real star-quest run again | 11–12 |

## Anatomy of one session

A 2-hour live block, chaptered so no single activity runs long enough to lose
attention.

| Time | Chapter | What happens |
|------|---------|--------------|
| 0:00–0:05 | Check-in | Avatar loads on the map at her current region; recap streak and last week's personal best |
| 0:05–0:30 | Quest 1 | New content for the week (grammar / vocab / spelling target) |
| 0:30–0:35 | Recharge | Physical movement break, framed as refilling her energy bar |
| 0:35–1:00 | Quest 2 | Practice round, adaptive difficulty (existing engine) |
| 1:00–1:10 | Mystery box | Sealed surprise mini-round pulling one weak item from her per-item history |
| 1:10–1:15 | Recharge | Second movement break |
| 1:15–1:45 | Quest 3 | Applied practice / speaking or writing task |
| 1:45–1:55 | Boss check | Only on a phase's final week — the boss battle; otherwise a short review lap |
| 1:55–2:00 | Save & reveal | XP total, streak update, one cosmetic unlock if earned |

## Progression systems

**Persistent avatar.** One avatar that exists across all 12 weeks, not reset
per session. Currency is a cosmetic unlock (hat, pet, trail color) each
session-end rather than new content — cheap to build, and ownership of the
avatar is the actual motivator, not the item.

**XP & personal bests.** Stars/XP accumulate across the campaign. Alongside
the bar, track one per-domain personal-best time (mirroring the report's
existing per-domain timing) so each week she's shown a concrete number to
beat.

**Badges — tied to real diagnosed gaps, not generic completion:**

| Badge | Earned by |
|-------|-----------|
| Tense Detective | Answers only after the sentence finishes — targets the early-answer habit that cost a real listening item |
| Vowel Hunter | Three clean spell-word items in a row — the schwa/unstressed-vowel gap |
| Sign Reader | Prohibition phrases (can't / shouldn't / must not) read correctly under time |
| Ceiling Breaker | Answers an item one level above anything the original diagnostic reached in that domain |

**Boss battles — end of each region:**

| Week | Boss | Built from |
|------|------|------------|
| 2 | The Weather Wizard | Only accepts present-tense sentences with correct "now" / "this morning" marking |
| 5 | The Spelling Log | Actual missed spelling items, re-served |
| 7 | The Sign Reader | A wall of prohibition signs that must be read correctly to pass |
| 10 | The Ceiling Climb | One level above the diagnostic's stopping point in every domain at once |
| 12 | The Summit | The real, unmodified star-quest reassessment |

**Mystery box.** One sealed surprise each session (the 1:00–1:10 window).
Content is pulled straight from her per-item answer history — the same
`a: [[id, answer, correct, seconds]]` data already decoded from the report's
URL fragment — so it's always an actual weak point, never generic filler.

## Assets available but not yet wired in

Found in the student's private Oxford Discover 1 course-material folder and
neighboring folders — none of this is pulled into this repo yet:

| Asset | Count | Proposed game use |
|-------|------:|--------------------|
| Flashcard images (JPG) | 252 | Collectible cards — one drops per quest completed, sorted by region theme; a full region set unlocks the boss battle |
| Poster/chart PDFs | 9 | Region backdrop art (one per Oxford Discover Big Question arc — a near 1:1 fit for 5 regions grouped in pairs) |
| Big Question opener videos | 9 | "Cutscene" on first entering a region |
| Big Question wrap-up videos | 9 | Cutscene on boss-battle victory, before badge reveal |
| Two-unit animated story videos | 9 | Mid-region reward, unlocked at the session halfway point |
| Real Cambridge KET PDFs | 4 | Source material for The Summit (week 12) |
| ODWS spelling-log PDFs (1st ed.) | 6 | Direct source for Vowel Hollow's content and The Spelling Log boss |

## What this needs from the existing engine

- **New:** a persistence layer for avatar + cumulative XP across sessions.
  `sync.js`'s existing transport (local/Firebase/none) can carry it; it just
  isn't asked to yet.
- **New:** a map screen reading the same five-phase structure already written
  into `star-quest-course`'s `index.html`.
- **Reuse as-is:** the adaptive engine, the URL-fragment handoff, and
  `report.js`'s narrative builder — boss battles and the mystery box are just
  new question sets fed through the same rendering path.
- **Content step, not code:** the 252 flashcards and 9 posters need
  trimming/selecting for the five regions actually used (the plan uses roughly
  half of Oxford Discover 1's 18 units) before they're wired in.
- **Keep:** name-free convention, light-mode default, 88px targets, the
  four-accent system exactly as documented in `styles.css` — this document's
  regions map onto it deliberately (cyan / yellow / magenta / orange, all four
  only at the Summit).
