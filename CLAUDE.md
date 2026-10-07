  # typing-gazette
  Read docs/PRD.md before planning anything.

  ## How we work
  - I'm learning. Explain concepts and propose an approach before writing code.
  - Don't edit files unless I ask. When do, make small targeted edits, not full rewrites.
  - I write the engine (engine.js) and text prep (textPrep.js) myself; you can scaffold config, tests, and the GitHub Action.
  - Keep JSDoc comments.
  - Don't create a shared helper until the same need appears 2-3 times.
  - Never put API keys in code. Keys go in .env locally and GitHub Secrets in CI.

  ## Git
  - Work directly on main.
  - Don't commit or push. Stop after the edits so I can review the diff and commit myself.

  ## Commands
  No dependencies and no build step. Tests use Node's built-in runner (Node 22+).
  - All tests: `npm test`
  - Re-run on save: `npm run test:watch`
  - One file: `node --test test/engine.test.js`
  - One test by name: `node --test --test-name-pattern="wpm"`