# typing-gazette PRD

Oct 7, 2026 · @Dev

## Overview

typing-gazette is a typing speed test whose passages come from today's news instead of a fixed list of quotes. It rebuilds Typing Practice (HTML/CSS/JS) with a real data source, a cleaner architecture, and tests.

**Problem.** Typing Practice repeats the same five hardcoded quotes, so practice gets stale and the text never reflects real writing. Typing real articles gives fresh, varied text every day, plus a reason to come back.

**Learning goal.** Beyond the app itself, this project practices things the first version skipped: working with an external API, keeping secrets out of a public repo, CI with GitHub Actions, separating logic from the DOM, and unit tests.

## Goals, non-goals, success criteria

**Goals**

- Serve a new set of news passages every day, with no manual work.
- Measure WPM, CPS, and accuracy correctly, with the formulas covered by tests.
- Credit every passage: headline, source, date, and a link to the full article.
- Deploy as a public static site with no API key exposed.

**Non-goals (for v1)**

- User accounts, logins, or a database.
- Leaderboards or multiplayer.
- A paid API or any recurring cost.
- Mobile typing support (physical keyboard assumed).

**Success criteria**

- The site shows a passage from the last 24 hours on any given day.
- The API key never appears in the repo or in the browser's network tab.
- Engine and text-prep functions have unit tests, and the tests run in CI.
- A new reader can play a test without instructions.

## User and core flow

The primary user is someone who wants quick typing practice with text that isn't the same every time: students, people prepping for typing-heavy jobs, and Dev himself.

1. The reader opens the site and sees today's edition: a short list of headlines.
2. They pick a headline, or press Start for a random one.
3. The passage appears. The timer starts on the first keystroke.
4. Each character turns green or red as they type. Backspace is allowed.
5. When the last character is typed, results show: WPM, CPS, accuracy.
6. A credit line shows the headline, source, date, and a link to read the full article.
7. They can retry the same passage or pick another.

## Features: MVP vs later

The MVP is the smallest version that proves the whole pipeline works end to end: API to JSON to page to results.

| Feature | Version | Notes |
| --- | --- | --- |
| Daily fetch of Guardian articles into `today.json` | MVP | GitHub Action, once a day |
| Text cleanup and chunking into passages | MVP | Strip HTML, normalize quotes and dashes |
| Typing engine with live coloring | MVP | Port from Typing Practice |
| WPM, CPS, accuracy results | MVP | Same metrics as today, now tested |
| Credit line with link to the article | MVP | Check the Guardian's terms for exact wording |
| Headline picker for today's edition | MVP | Or random on Start |
| Section filter (world, tech, sport) | Later | Guardian sections |
| Passage length setting (short / medium / long) | Later |  |
| Personal history and best scores | Later | Browser storage, this browser only |
| Weekly edition (archive of past 7 days) | Later | Keep last 7 JSON files |
| Newspaper-style theme | Later | Fits the "gazette" name |
| Second source (NYT lead paragraphs) | Later | Fallback if one source fails |

## Data source

The source is the Guardian Open Platform Content API, because it is the only free news API that returns full article text. Alternatives ruled out: NewsAPI.org and GNews (free tiers truncate content), NewsData.io (snippets only), NYT (abstracts and lead paragraphs only; kept as a possible second source).

**Free Developer key terms:** 1 call/second, 500 calls/day, full article text included, non-commercial use only. typing-gazette needs about 1 call per day. ([source](https://apify.com/scrapyx/guardian-articles-scraper.md))

**Request:** `https://content.guardianapis.com/search` with `show-fields=headline,body,byline`, a date filter for the last 24 hours, and the key in the `api-key` parameter. ([source](https://freeapihub.com/apis/guardian-api))

**Output file** written by the build step and read by the site:

```json
{
  "edition": "2026-10-07",
  "generatedAt": "2026-10-07T10:00:00Z",
  "source": "The Guardian",
  "articles": [
    {
      "id": "world/2026/oct/07/example-slug",
      "headline": "Example headline",
      "section": "World news",
      "byline": "Reporter Name",
      "url": "https://www.theguardian.com/...",
      "passages": ["First cleaned passage...", "Second passage..."]
    }
  ]
}
```

The site only ever reads this file. It never calls the Guardian directly.

## Architecture

A scheduled build step fetches the news, and the site stays fully static. This keeps the API key out of the browser and uses about one API call per day.

&#91;embedded content: build-time fetch and run-time app · 7 modules\]

The top row runs once a day in a GitHub Action; the bottom row runs in the reader's browser. ui.js sends keys to engine.js and renders the state it gets back, and engine.js never touches the DOM, which is what makes it testable. Unit tests cover engine.js and textPrep.js.

## Typing engine rules

The engine is plain data plus pure functions, so every rule below can be unit-tested without a browser.

**States:** `idle` (passage shown, timer not started) → `running` (first key pressed) → `finished` (last character typed). Start or Retry returns to `idle`.

**Input rules**

- Printable single characters are added to the typed text. Ctrl, Cmd, and Alt combinations are ignored.
- Backspace removes the last typed character. Mistakes stay counted in accuracy even after they're fixed.
- Space is captured so the page doesn't scroll.
- The test ends when the typed length equals the passage length.

**Stats** (time in minutes, from first keystroke to last)

```latex
\text{WPM} = \frac{\text{characters} / 5}{\text{minutes}}
```

- WPM uses the standard 5-characters-per-word convention, so long and short words count fairly. This is a change from Typing Practice, which counted space-separated words.
- CPS = characters ÷ seconds.
- Accuracy = 1 − (mistakes ÷ characters), as a percent, where mistakes counts every wrong keystroke.

**Text normalization** (in text prep, before the engine sees it): curly quotes to straight, en/em dashes to hyphens, collapse whitespace, and remove or transliterate characters that aren't on a US keyboard.

## Visual design

The look is Routine Clicker's minimal monochrome style, inverted to a white background. Poppins 400/600, small muted labels, thin borders, and buttons that invert on hover all carry over.

| Token | Routine Clicker (dark) | typing-gazette (light) | Used for |
| --- | --- | --- | --- |
| `--bg` | `#000000` | `#ffffff` | Page background |
| `--ink` | `#ffffff` | `#000000` | Headings, typed-correct characters |
| `--muted` | `#444444` | `#999999` | Untyped passage text, small labels |
| `--surface` | `#1c1c1c` | `#ebebeb` | Wrong-space highlight, panels |
| `--hover` | `#333333` | `#dddddd` | Hover backgrounds |
| `--border` | `#333333` | `#cccccc` | Button and panel borders |
| `--focus` | `#555555` | `#aaaaaa` | Cursor outline on the current character (like `.today`) |
| `--error` | (none) | `#d6304a` | Wrong characters, the only color on the page |

- Define these as CSS custom properties on `:root`, so a dark mode later is one `prefers-color-scheme` block that swaps the values back.
- Title: 22px, weight 600, letter-spacing 1px. Results labels: small and muted, like the heatmap's day labels.
- Buttons: white fill, `--border` outline, 6px radius; on hover they invert to black fill with white text.
- Passage: untyped text is `--muted`, correct text turns `--ink`, so progress reads as text "filling in" from gray to black.

## Risks and constraints

| Risk | Impact | Mitigation |
| --- | --- | --- |
| API key leaks into the repo | Key revoked, quota abused | Key only in GitHub Secrets; site never calls the API |
| Daily Action fails (API down, quota) | Stale or missing passages | Keep yesterday's file if the fetch fails; show the edition date on the page |
| Article text has odd characters, captions, or embeds | Untypeable passages | Text prep strips HTML and filters characters; tests with real samples |
| Distressing news content | Uncomfortable practice | Optional section allowlist (e.g. skip some sections) |
| Free key is non-commercial | Can't monetize | Fine for a portfolio project; revisit if that changes |
| Copyright of article text | Republishing full articles | Store and show short passages only, always credited and linked |

## Milestones

Each milestone ends with something that works and can be committed. Dates are open until Dev sets them.

- [ ] **M0 Setup:** new repo, folder structure, test runner, a `CLAUDE.md` with collaboration rules.
- [ ] **M1 Engine:** port the typing logic into pure functions with unit tests. Uses a hardcoded passage.
- [ ] **M2 UI:** render the engine's state; reach feature parity with Typing Practice.
- [ ] **M3 Fetch script:** a Node script that calls the Guardian locally (key in a `.env` file) and writes `today.json`.
- [ ] **M4 Text prep:** clean and chunk real articles; tests built from saved sample responses.
- [ ] **M5 Automation:** GitHub Action runs the fetch daily and commits the file; deploy to GitHub Pages.
- [ ] **M6 Polish:** headline picker, credit line, gazette styling, README with screenshots.

## Open questions for Dev

- [ ] How long should a passage be? (e.g. 1 paragraph, \~60 seconds, or a fixed character count)
- [ ] How many articles per edition? (e.g. top 5 or top 10)
- [ ] Hosting: GitHub Pages, or Netlify / Cloudflare Pages?
- [ ] Which sections to include or exclude?
- [ ] Plain JS modules, or add a build tool like Vite? (Vite adds tooling to learn; plain modules keep it simple)
- [ ] Which test runner? (Vitest or Node's built-in test runner)
- [ ] Daily only, or also a weekly edition in v1?
- [ ] Target dates for the milestones?
