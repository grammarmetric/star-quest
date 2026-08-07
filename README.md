# Star quest — a Cambridge A2 Key (KET) adventure for Lily

A single-page, gamified English assessment for one 7-year-old, with a live
teacher monitor. Plain HTML, CSS and JavaScript — no build step, no bundler,
no npm install. Drop it on GitHub Pages and it runs.

**Two pages:**

| Page | Who opens it | What it does |
|---|---|---|
| `index.html` | Lily | The quest — four stages, one per KET skill domain |
| `teacher.html` | You | Watches her screen live and shows the final report |

---

## 1. What's in the box

```
index.html            the quest
teacher.html          the live monitor
styles.css            shared stylesheet (GrammarMetric design system)
app.js                quest engine, adaptive levelling, score report
teacher.js            live dashboard
sync.js               Firebase wrapper — degrades to offline silently
icons.js              inline SVG picture set (no image files anywhere)
questions.json        >>> ALL THE CONTENT. This is the file you swap. <<<
firebase-config.js    paste your Firebase keys here
database.rules.json   Realtime Database security rules
.nojekyll             stops GitHub Pages hiding files
```

---

## 2. Try it right now (no Firebase needed)

Browsers refuse to read `questions.json` from a `file://` page, so you need a
local server. Node is already on this machine:

```powershell
cd C:\Users\User\lily-quest
npx serve
```

Open the `http://localhost:3000` address it prints. The quest works completely
— all four stages, adaptive levelling, the full score report. The only thing
missing is the live teacher view, which shows an honest "offline mode" chip
until you finish step 4.

---

## 3. Deploy to GitHub Pages

```powershell
cd C:\Users\User\lily-quest
git init -b main
git add -A
git commit -m "Star quest: KET assessment for Lily"

# gh is installed but not on PATH on this machine
& "C:\Program Files\GitHub CLI\gh.exe" repo create lily-quest --private --source . --push
```

Then turn Pages on:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST repos/grammarmetric/lily-quest/pages `
  -f "source[branch]=main" -f "source[path]=/"
```

Or click: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.

Live in about a minute at
`https://grammarmetric.github.io/lily-quest/`.

> **Private repo note:** GitHub Pages on a *private* repo needs GitHub Pro or
> higher. If Pages refuses to enable, either upgrade or make the repo public —
> there is nothing secret in the code, and both pages carry
> `noindex, nofollow` so they will not turn up in search.

---

## 4. Live teacher monitoring (Firebase Realtime Database)

A new standalone Firebase project, separate from `grammarmetric-classroom`.

### The scripted way (recommended)

Google requires one interactive browser login that nothing can automate. Do
that, then the script does the other six steps:

```powershell
firebase login                       # opens a browser, sign in as admin@grammarmetric.com
cd C:\Users\User\lily-quest
.\tools\setup-firebase.ps1
```

It creates the project, creates the Realtime Database, enables Anonymous
sign-in, registers a web app, writes the real values into `firebase-config.js`,
adds your Pages domain to the authorized list, and deploys
`database.rules.json`. Each step prints OK or FAILED — and any step that fails
prints the exact console click-path, so a partial run is still useful. Re-run it
with `-ProjectId <id>` to pick up where it left off.

Then commit the generated config:

```powershell
git add firebase-config.js && git commit -m "Add Firebase config" && git push
```

> The API key in that file is **not a secret**. A Firebase web API key
> identifies the project; it authorises nothing. Access is controlled by
> `database.rules.json` and the authorized-domain list. Firebase ships these in
> client-side JavaScript by design.

### The manual way

If you would rather click through it, five steps:

**1. Create the project.**
[console.firebase.google.com](https://console.firebase.google.com) → Add
project → name it `lily-quest` → you can switch Google Analytics off.

**2. Create the Realtime Database *first*.**
Build → Realtime Database → Create Database → pick a region near you
(`asia-southeast1` matches your existing setup) → start in **locked mode**.
Doing this before step 3 matters: `databaseURL` does not appear in the config
snippet until the database exists.

**3. Enable Anonymous sign-in.**
Build → Authentication → Get started → Sign-in method → **Anonymous** → Enable.
Nobody types a password; this only proves the client is a real browser session
rather than an anonymous script.

**4. Copy the config into `firebase-config.js`.**
Project settings (gear icon) → General → Your apps → `</>` Web → register the
app → copy the `firebaseConfig` object over the placeholders in
`firebase-config.js`. Make sure `databaseURL` is one of the keys.

**5. Publish the rules.**
Realtime Database → Rules tab → paste the contents of `database.rules.json` →
Publish. (Strip the `"//"` comment block if the console objects to it.)

Then add your Pages domain under **Authentication → Settings → Authorized
domains**: `grammarmetric.github.io`.

### Using it in a lesson

1. Open `teacher.html`, click **Make a new code**, click **Watch**.
2. Send Lily the student link shown (`index.html?session=XXXXXXXX`).
3. As she plays you see, in real time: the exact question on her screen, the
   options she is choosing between, which one she tapped, whether it was right,
   how long each one took, how many times she replayed the audio, and her
   current adaptive level. Her final report appears on your page too.

---

## 5. How the assessment actually works

### Adaptive: starts at Movers, climbs to A2 Key

Every question carries a `level`:

| Level | Pitched at |
|---|---|
| 1 | A1 Movers — where a strong 7-year-old sits |
| 2 | A1+ / low A2 |
| 3 | **Genuine A2 Key** — lifted from the Cambridge sample paper |

She starts at level 1 in every domain. **Two correct in a row promotes her one
level; one wrong demotes her one.** Each domain tracks its own level, so she can
be at A2 Key in vocabulary and Movers in listening at the same time — which is
usually the true picture at this age.

The report shows, per skill, the **highest level she answered correctly**. That
is the number worth watching over time: raw percentage can stay flat while the
ceiling rises.

> A note I'd rather say than bury: A2 Key is above where Cambridge normally
> places a 7-year-old — their young-learner ladder is Pre A1 Starters → A1
> Movers → A2 Flyers, and A2 Key is the teen/adult equivalent of Flyers. The
> adaptive design is what makes this fair: she only meets true A2 material after
> earning it, so a low score means "not there yet", not "failed".

### Four stages, four KET skill domains

| Stage | Domain | Task types, and the real KET part each mirrors |
|---|---|---|
| Word Planet | Vocabulary | picture–word matching; best-word gap fill (**R&W Part 2**); build-the-word from a definition (**R&W Part 6**) |
| Sign Valley | Reading | match a sentence to a notice (**R&W Part 1**); choose the right reply (**R&W Part 3**); Right / Wrong / Doesn't say (**R&W Part 4**) |
| Sentence Bridge | Grammar | grammar cloze (**R&W Part 5**); tap-to-order sentence building |
| Echo Moon | Listening | audio + three pictures (**Listening Part 1**); audio + three options (**Listening Part 3**) |

Content is drawn from *Cambridge English: Key for Schools Sample Test 1* — the
internet-café gap fill, the Cirque du Soleil cloze, the Ana Johnson article, the
lost-property and no-entry notices, and the Susie/Matt cinema conversation are
all the real thing at level 3. Level 1 and 2 items are written to match the same
task shapes at a gentler pitch.

Option order is **not** shuffled — the A/B/C order of the authentic items is
part of the published paper, and scrambling it would break that fidelity.

### Sentence building is tap-to-place, not drag-and-drop

Deliberate. HTML5 drag-and-drop is unreliable on tablets and fiddly for small
hands. She taps a word to place it, taps a placed word to take it back. Same
skill, far fewer mis-drops.

---

## 6. Audio

Every listening item has a `say` field, read aloud by the browser's built-in
voice (British English, slowed to 0.82× for a 7-year-old). No audio files, so
nothing to record before you can use it.

To use your own recordings instead, drop MP3s in an `audio/` folder and set the
`audio` field on the item:

```json
{
  "id": "l3-film",
  "say": "Susie: Hi Matt. Would you like to come to the cinema…",
  "audio": "audio/l3-film.mp3"
}
```

When `audio` is set it plays instead of the browser voice, and falls back to the
voice automatically if the file is missing. Keep `say` filled in either way.

Chrome, Edge and Safari all ship an English voice. Firefox on Windows relies on
the system SAPI voices, which are usually American — if the accent matters,
record MP3s.

---

## 7. Swapping in your own content

`questions.json` is the only file you need to touch. An item looks like this:

```json
{
  "id": "v3-popular",
  "domain": "vocabulary",
  "level": 3,
  "kind": "word-choice",
  "ketRef": "Sample Test 1, R&W Part 2, Q6",
  "prompt": "The internet café quickly became ___ with Ivan and his friends.",
  "say": "The internet café quickly became, something, with Ivan and his friends.",
  "options": ["favourite", "popular", "excellent"],
  "answer": 1
}
```

- `domain` — must match a `domains[].id`: `vocabulary`, `reading`, `grammar`, `listening`
- `level` — `1`, `2` or `3`
- `answer` — the **zero-based index** into `options` (so `1` = the second one)
- `ketRef` — free text, shown to you on the report and monitor, never to Lily

The nine `kind` values, and the extra fields each needs:

| `kind` | Extra fields |
|---|---|
| `picture-word`, `listen-picture` | `options` as `{ "icon": "cat", "label": "cat" }` — icon names come from `icons.js` |
| `word-choice`, `gap-grammar`, `reply-choice`, `listen-choice` | `options` as plain strings |
| `notice-match` | `options` as strings, plus `"optionStyle": "notice"` |
| `true-false-say` | `text` (the passage) + three `options` |
| `sentence-build` | `tiles` (array, correct order) + `answer` (the sentence as a string) |
| `spell-word` | `word`, `letterPool`, `answer` — first letter is given free |

For `sentence-build`, write `tiles` in the **correct** order — the engine
shuffles them on screen, and keeping the source order correct means a typo
between `tiles` and `answer` is catchable rather than silent.

Change how long the test is with `meta.itemsPerDomain` (currently 5, so 20
questions, about 10–12 minutes). Keep at least `itemsPerDomain` items at every
level in every domain — the file currently has 5 of each, which is exactly
enough for her to spend a whole stage parked at one level. Below that the engine
still works, it just steps to a neighbouring level to fill the gap.

Need a picture that doesn't exist? Add a key to `window.ICONS` in `icons.js` —
any 24×24 outline SVG, strokes only, no fills.

---

## 8. Security, stated plainly

- Anonymous auth is required, so an unauthenticated client cannot read or write.
- Beyond that, **the 8-character session code is the secret**. Someone signed in
  who knew a live code could read that session. The code space is 36⁸ ≈ 2.8
  trillion, `sessions` itself is unreadable so codes cannot be enumerated, and
  the payload is one child's practice test. That is a proportionate trade-off —
  but it is a trade-off, and you should know it rather than discover it.
- Lily's **name** goes into the database. Nothing else identifying does.
- Both pages carry `noindex, nofollow`.
- If you want it stricter later: sign yourself in with email/password, have
  `teacher.html` write `ownerUid` when it creates a session, and require
  `data.child('ownerUid').val() === auth.uid` on writes. That is the same
  pattern as the classroom app.

---

## 9. The report

Generated on Lily's screen the moment she finishes, and mirrored to yours. It
shows overall score, total and per-question time, a per-domain breakdown with
the highest level she got right in each, strengths, what to practise next, and
every question with what she answered.

**Every line of that narrative is computed from her actual answers.** If the
data supports no strength, it says so rather than inventing a compliment — for
example, "This run does not show a clear strength yet. The questions may be
pitched too high." Same for the growth list: if she scores above 70% everywhere,
it tells you the test may not have found her ceiling instead of manufacturing a
weakness.

**Save as PDF** on the report screen prints just the report, in light mode,
without buttons.

---

## 10. Design

Follows `grammarmetric-style-guide.md`: Lexend only, the five-role electric
palette, the darkened-hue contrast rule on every coloured fill, flat surfaces
with no gradients or shadows, 14 / 10 / 20px radii, one lead accent per screen
(each stage owns one).

Three exceptions are taken deliberately for a 7-year-old, and each is documented
at the top of `styles.css`:

1. **Light mode is the default** rather than dark. Dark still works and follows
   the token table exactly.
2. **The minimal-motion rule is relaxed for reward feedback only** — the star
   burst, the star-piece reveal, the mascot's idle bob. Everything else is still
   a plain fade, and all of it is disabled under `prefers-reduced-motion`.
3. **Type and hit targets are scaled up** — 18px base, 88px minimum tap target.
