# study-tracker

[![npm version](https://img.shields.io/npm/v/@fabianimv/study-tracker.svg)](https://www.npmjs.com/package/@fabianimv/study-tracker)
[![CI](https://github.com/FabianIMV/study-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/FabianIMV/study-tracker/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/@fabianimv/study-tracker.svg)](LICENSE)

Stores every answer from a quiz, flashcard or study app in the browser and shows
how much the learner has improved per week, per month and per topic.

- **Zero dependencies, no build step, no server.** Three files you can load with `<script>` and `<link>`.
- **Nothing gets lost.** Each answer is saved the moment it is recorded, whether the
  learner finishes the session, stops halfway or closes the tab. Two open tabs don't overwrite each other.
- **Content-agnostic.** The library only needs a question id, a topic and whether the answer was correct.
- **Several apps on one domain.** Each app uses its own `appId`, so apps hosted on the same
  origin (for example `username.github.io`) keep their data separate.
- **Users own their data.** Progress can be exported and imported as JSON for backups or to move to another device.
- **Ready-made progress view** (optional): stat tiles, per-topic table, weekly/monthly charts,
  session history and export/import buttons. Light and dark mode.

## Installation

### npm

```bash
npm install @fabianimv/study-tracker
```

```js
// ES modules / bundlers
import StudyTracker from '@fabianimv/study-tracker';
import StudyTrackerView from '@fabianimv/study-tracker/view'; // optional UI
import '@fabianimv/study-tracker/style.css';                   // optional UI styles

// CommonJS
const StudyTracker = require('@fabianimv/study-tracker');
```

### CDN

Always pin an exact version so an update never changes your app without you noticing.

```html
<!-- jsDelivr -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fabianimv/study-tracker@0.1.0/study-tracker.css">
<script src="https://cdn.jsdelivr.net/npm/@fabianimv/study-tracker@0.1.0/study-tracker.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fabianimv/study-tracker@0.1.0/study-tracker-view.js"></script>

<!-- or unpkg -->
<script src="https://unpkg.com/@fabianimv/study-tracker@0.1.0/study-tracker.js"></script>
```

Loaded with `<script>`, the library exposes `window.StudyTracker` and `window.StudyTrackerView`.

## Quick start

```html
<div id="progress"></div>

<script>
  var tracker = StudyTracker.create({ appId: 'my-quiz' });

  // When a session (quiz, practice round…) starts
  var session = tracker.startSession({ planned: 20 });

  // Every time the learner answers (saved immediately)
  tracker.recordAnswer(session, {
    question: 'q-017',      // stable question id
    topic: 'networking',    // topic or domain
    correct: false,
    response: [2]           // optional: what was picked, to review later
  });

  // When the session ends (or the learner stops early)
  tracker.endSession(session, 'completed'); // or 'stopped'

  // Optional ready-made progress screen
  StudyTrackerView.render(document.getElementById('progress'), tracker, {
    topics: [
      { id: 'networking', label: 'Networking', total: 40 },
      { id: 'storage', label: 'Storage', total: 35 }
    ],
    locale: 'en',
    texts: { title: 'Your progress' } // see "Translating the view" below
  });
</script>
```

## Isolating data between apps

All data lives in `localStorage` under the key `study-tracker:<appId>`. `localStorage`
is shared by every page on the same origin, so **give each app its own `appId`**:

```js
StudyTracker.create({ appId: 'spanish-vocab' });
StudyTracker.create({ appId: 'chemistry-101' });
```

- Allowed characters: letters, digits, `.`, `-` and `_`.
- Once an app is live, **don't change its `appId`**: learners would lose access to their
  saved history (it stays under the old key).
- `importData` refuses files exported from a different `appId`.

## ⚠️ Keep question ids stable

Progress is computed per question id. Once an app is published, **never change or
reuse the id of an existing question**:

- Renaming an id makes the question look brand new: its history is orphaned and
  mastery/coverage drop.
- Reusing an id for a different question mixes the history of two questions.

Use ids that don't depend on order (for example `net-017` rather than the array index),
fix typos in the question text freely, and give a new id only to genuinely new questions.
The same applies to topic ids.

## What it measures

| Metric | Meaning |
|---|---|
| **Estimated mastery** | Of the questions seen, the share answered correctly **the last time** each was answered. Repeating an easy question doesn't inflate it; fixing a mistake raises it. Its change compares today's value with the value at the start of the week or month. |
| **Period accuracy** | Share of correct answers in the week or month, compared with the previous period. |
| **Questions seen** | How many distinct questions have been answered out of the whole bank (coverage). |

Weeks run Monday to Sunday in the learner's local time.

## API

### `StudyTracker.create({ appId, storage?, now? })`

- `appId` (required): app identifier, see [Isolating data between apps](#isolating-data-between-apps).
- `storage`: any object with `getItem`, `setItem` and `removeItem`. Defaults to `localStorage`,
  falling back to memory when it is unavailable (e.g. some private modes).
- `now`: function returning the current time in ms. Useful in tests.

### Writing

| Method | What it does |
|---|---|
| `startSession({ planned?, meta? })` | Opens a session and returns its id. `meta` accepts anything (filters used, mode…). |
| `recordAnswer(sessionId, { question, topic, correct, response? })` | Saves an answer immediately. |
| `endSession(sessionId, reason?)` | Closes the session (`'completed'`, `'stopped'` or any text). Unclosed sessions keep their answers. |
| `importData(jsonOrObject, 'merge' \| 'replace')` | Imports a backup. `merge` (default) never duplicates answers. Returns how many answers were added. |
| `clear()` | Deletes all data for this app. |

### Reading

| Method | Returns |
|---|---|
| `getSessions()` | Sessions with at least one answer, newest first, with `answered`, `correct`, `pct` and `byTopic`. |
| `getAnswers({ session?, topic?, question?, from?, to? })` | Filtered answers. |
| `periodStats('day' \| 'week' \| 'month', { limit? })` | Accuracy per period, including empty periods (`pct: null`) so gaps are visible. |
| `mastery({ topics?, until? })` | Estimated mastery overall and per topic. `topics` is `{ topicId: totalQuestions }` to compute coverage. |
| `progress('week' \| 'month', { topics? })` | Everything needed to answer "am I improving?": current mastery and accuracy and their change, overall and per topic. |
| `questionStats()` | Per question: attempts, correct count and whether the last attempt was correct. Handy for "only missed" or "only new" sessions. |
| `exportData()` | Full copy of the data. |
| `onChange(fn)` | Calls `fn` whenever the data changes, including from another tab. Returns an unsubscribe function. |
| `isPersistent()` | `false` when the browser can't store data (it will be lost on close). |

### `StudyTrackerView.render(container, tracker, options)`

Renders the progress screen. Returns `{ refresh, destroy }`; call `destroy()` before reusing the container.

| Option | Use |
|---|---|
| `topics` | `[{ id, label, total }]`, in display order. |
| `getQuestion(id)` | Optional. Returns `{ text, options, correct }` to show the details of each past session. |
| `period` | `'week'` (default) or `'month'`. |
| `locale` | Locale for dates. Defaults to `'es'`. |
| `texts` | Overrides any string in `StudyTrackerView.texts`. |
| `fileName` | File name used when exporting. |

#### Translating the view

The built-in strings are in Spanish. Pass `locale` and override the strings you need through
`texts`; the full list of keys is in `StudyTrackerView.texts`:

```js
StudyTrackerView.render(el, tracker, {
  locale: 'en',
  texts: {
    title: 'Your progress', week: 'Week', month: 'Month',
    thisWeek: 'this week', thisMonth: 'this month',
    prevWeek: 'last week', prevMonth: 'last month',
    mastery: 'Estimated mastery', accuracy: 'Accuracy'
    // …
  }
});
```

Colors can be themed with CSS variables: `--st-surface-custom`, `--st-text-custom`,
`--st-muted-custom`, `--st-line-custom`, `--st-grid-custom` and `--st-accent-custom`.

## Data format

The stored data (and the exported file) is plain, versioned JSON:

```json
{
  "schema": 1,
  "appId": "my-quiz",
  "sessions": [
    { "id": "m1x2…", "startedAt": 1760000000000, "endedAt": 1760000600000,
      "reason": "completed", "planned": 20, "meta": { "mode": "practice" } }
  ],
  "answers": [
    { "session": "m1x2…", "question": "net-007", "topic": "networking",
      "correct": true, "response": [0], "at": 1760000030000 }
  ]
}
```

- `schema` is the format version. If the format ever changes, the library migrates older
  data automatically when it loads or imports it, so existing history keeps working
  after an upgrade.
- Answers are stored as a flat list so they are easy to analyze elsewhere (spreadsheets, pandas…).
- Timestamps are milliseconds since the Unix epoch.
- `localStorage` allows about 5 MB per origin. Each answer takes roughly 120 bytes, so
  there is room for around 40,000 answers.

## Export and import

Everything stays in the learner's browser, so offer a way to back it up. The progress
view already includes *Export*, *Import* and *Clear* buttons; to do it yourself:

```js
// Export: download a JSON backup
var blob = new Blob([JSON.stringify(tracker.exportData(), null, 2)], { type: 'application/json' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'my-quiz-progress.json';
a.click();

// Import: from an <input type="file">
input.addEventListener('change', function () {
  input.files[0].text().then(function (text) {
    var added = tracker.importData(text, 'merge'); // or 'replace'
    console.log(added + ' new answers imported');
  });
});
```

`merge` adds only the sessions and answers that are missing, so importing the same file
twice is safe. `replace` discards the current data first.

## Development

```bash
npm test   # uses Node's built-in test runner (Node 18+), nothing to install
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Fabian Munoz
