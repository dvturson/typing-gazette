import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, pressKey, getStats, reset } from '../src/engine.js';

/**
 * Builds a keystroke shaped like the parts of a KeyboardEvent the engine reads.
 * @param {string} key - The KeyboardEvent.key value, e.g. 'a' or 'Backspace'.
 * @param {{ ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} [modifiers]
 * @returns {{ key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean }}
 */
function input(key, modifiers = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

/**
 * Presses each character of `text` in order, all at the same timestamp.
 * @param {object} state - Engine state to start from.
 * @param {string} text - Characters to type.
 * @param {number} now - Timestamp in milliseconds passed to every keystroke.
 * @returns {object} The state after the last keystroke.
 */
function typeText(state, text, now) {
  for (const char of text) {
    state = pressKey(state, input(char), now);
  }
  return state;
}

describe('createEngine', () => {
  test('returns an idle state for the passage', () => {
    assert.deepEqual(createEngine('hello'), {
      passage: 'hello',
      typed: '',
      status: 'idle',
      startedAt: null,
      finishedAt: null,
      mistakes: 0,
    });
  });
});

describe('printable keys', () => {
  test('first key starts the timer and moves to running', () => {
    const state = pressKey(createEngine('hello'), input('h'), 1000);

    assert.equal(state.status, 'running');
    assert.equal(state.startedAt, 1000);
    assert.equal(state.typed, 'h');
  });

  test('later keys append without changing startedAt', () => {
    let state = pressKey(createEngine('hello'), input('h'), 1000);
    state = pressKey(state, input('e'), 2000);

    assert.equal(state.typed, 'he');
    assert.equal(state.startedAt, 1000);
  });

  test('a wrong character is still added to typed', () => {
    const state = pressKey(createEngine('hello'), input('x'), 1000);

    assert.equal(state.typed, 'x');
  });

  test('space is a printable key', () => {
    const state = typeText(createEngine('a b'), 'a ', 1000);

    assert.equal(state.typed, 'a ');
    assert.equal(state.mistakes, 0);
  });

  test('does not mutate the state it was given', () => {
    const before = createEngine('hello');
    const copy = { ...before };

    pressKey(before, input('h'), 1000);

    assert.deepEqual(before, copy);
  });
});

describe('ignored keys', () => {
  test('non-printable keys leave the state unchanged', () => {
    const start = createEngine('hello');

    for (const key of ['Shift', 'Enter', 'Tab', 'ArrowLeft', 'Escape']) {
      assert.deepEqual(pressKey(start, input(key), 1000), start, key);
    }
  });

  test('ctrl, meta and alt combinations leave the state unchanged', () => {
    const start = createEngine('hello');

    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      const combo = input('h', { [modifier]: true });
      assert.deepEqual(pressKey(start, combo, 1000), start, modifier);
    }
  });
});

describe('Backspace', () => {
  test('removes the last typed character', () => {
    let state = typeText(createEngine('hello'), 'he', 1000);
    state = pressKey(state, input('Backspace'), 2000);

    assert.equal(state.typed, 'h');
  });

  test('does nothing when no characters are typed', () => {
    const start = createEngine('hello');

    assert.deepEqual(pressKey(start, input('Backspace'), 1000), start);
  });
});

describe('mistakes', () => {
  test('a correct key does not count as a mistake', () => {
    const state = pressKey(createEngine('hello'), input('h'), 1000);

    assert.equal(state.mistakes, 0);
  });

  test('a wrong key counts as a mistake', () => {
    const state = pressKey(createEngine('hello'), input('x'), 1000);

    assert.equal(state.mistakes, 1);
  });

  test('a mistake stays counted after it is fixed', () => {
    let state = pressKey(createEngine('hello'), input('x'), 1000);
    state = pressKey(state, input('Backspace'), 2000);
    state = pressKey(state, input('h'), 3000);

    assert.equal(state.typed, 'h');
    assert.equal(state.mistakes, 1);
  });

  test('every wrong keystroke counts, even at the same position', () => {
    let state = pressKey(createEngine('hello'), input('x'), 1000);
    state = pressKey(state, input('Backspace'), 2000);
    state = pressKey(state, input('y'), 3000);

    assert.equal(state.mistakes, 2);
  });
});

describe('finishing', () => {
  test('typing the last character finishes the test', () => {
    let state = typeText(createEngine('hi'), 'h', 1000);
    state = pressKey(state, input('i'), 5000);

    assert.equal(state.status, 'finished');
    assert.equal(state.finishedAt, 5000);
  });

  test('finishes on length even when the last character is wrong', () => {
    const state = typeText(createEngine('hi'), 'hx', 1000);

    assert.equal(state.status, 'finished');
  });

  test('all keys are ignored once finished', () => {
    const finished = typeText(createEngine('hi'), 'hi', 1000);

    assert.deepEqual(pressKey(finished, input('a'), 9000), finished);
    assert.deepEqual(pressKey(finished, input('Backspace'), 9000), finished);
  });
});

describe('getStats', () => {
  // 60 characters typed over 30 seconds: 12 "words" in half a minute.
  const sixty = 'a'.repeat(60);

  test('wpm uses five characters per word', () => {
    let state = typeText(createEngine(sixty), sixty.slice(0, 1), 1000);
    state = typeText(state, sixty.slice(1), 31000);

    assert.equal(getStats(state, 31000).wpm, 24);
  });

  test('cps is characters per second', () => {
    let state = typeText(createEngine(sixty), sixty.slice(0, 1), 1000);
    state = typeText(state, sixty.slice(1), 31000);

    assert.equal(getStats(state, 31000).cps, 2);
  });

  test('accuracy is 100 with no mistakes', () => {
    let state = typeText(createEngine('abcd'), 'a', 0);
    state = typeText(state, 'bcd', 4000);

    assert.equal(getStats(state, 4000).accuracy, 100);
  });

  test('accuracy drops for a mistake that was fixed', () => {
    let state = pressKey(createEngine('abcd'), input('x'), 0);
    state = pressKey(state, input('Backspace'), 1000);
    state = typeText(state, 'abcd', 4000);

    assert.equal(getStats(state, 4000).accuracy, 75);
  });

  test('accuracy never goes below 0', () => {
    let state = createEngine('ab');
    for (let i = 0; i < 3; i++) {
      state = pressKey(state, input('x'), 0);
      state = pressKey(state, input('Backspace'), 0);
    }
    state = typeText(state, 'ab', 4000);

    assert.equal(getStats(state, 4000).accuracy, 0);
  });

  test('an idle engine reports zeros', () => {
    assert.deepEqual(getStats(createEngine('hello'), 5000), {
      wpm: 0,
      cps: 0,
      accuracy: 0,
    });
  });

  test('zero elapsed time gives 0 speed, not Infinity', () => {
    const state = typeText(createEngine('a'), 'a', 5000);
    const stats = getStats(state, 5000);

    assert.equal(stats.wpm, 0);
    assert.equal(stats.cps, 0);
  });

  test('while running, time is measured up to now', () => {
    const state = typeText(createEngine(sixty), sixty.slice(0, 30), 0);
    const stats = getStats(state, 30000);

    assert.equal(stats.wpm, 12);
    assert.equal(stats.cps, 1);
  });

  test('once finished, time stops at finishedAt', () => {
    let state = typeText(createEngine(sixty), sixty.slice(0, 1), 1000);
    state = typeText(state, sixty.slice(1), 31000);

    assert.equal(getStats(state, 999999).wpm, 24);
  });
});

describe('reset', () => {
  test('returns to idle with the same passage', () => {
    const finished = typeText(createEngine('hi'), 'hx', 1000);

    assert.deepEqual(reset(finished), createEngine('hi'));
  });
});
