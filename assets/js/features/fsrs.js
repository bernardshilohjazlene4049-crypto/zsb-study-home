/*
 * FSRS-5 复习调度（长期模式，无学习步、无随机抖动）。
 * 按 ts-fsrs v4.7.1（https://github.com/open-spaced-repetition/ts-fsrs）的算法与默认参数移植。
 *
 * MIT License
 * Copyright (c) 2025 Open Spaced Repetition
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
 * OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export const RATING = { again: 1, hard: 2, good: 3, easy: 4 };
export const DEFAULT_W = Object.freeze([
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
]);
const DECAY = -0.5;
const FACTOR = 19 / 81;
const S_MIN = 0.01;
const DAY = 86400000;

const fix = (x) => +x.toFixed(8);
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export function createFsrs({ w = DEFAULT_W, requestRetention = 0.9, maximumInterval = 36500 } = {}) {
  const modifier = fix((Math.pow(requestRetention, 1 / DECAY) - 1) / FACTOR);
  const initStability = (g) => Math.max(w[g - 1], 0.1);
  const constrainD = (d) => Math.min(Math.max(fix(d), 1), 10);
  const initDifficulty = (g) => constrainD(w[4] - Math.exp((g - 1) * w[5]) + 1);
  const nextDifficulty = (d, g) => {
    const delta = -w[6] * (g - 3);
    const damped = d + fix(delta * (10 - d) / 9);
    return constrainD(fix(w[7] * initDifficulty(RATING.easy) + (1 - w[7]) * damped));
  };
  const retrievability = (t, s) => fix(Math.pow(1 + FACTOR * t / s, DECAY));
  const recallStability = (d, s, r, g) => {
    const hard = g === RATING.hard ? w[15] : 1;
    const easy = g === RATING.easy ? w[16] : 1;
    return fix(clamp(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard * easy), S_MIN, 36500));
  };
  const forgetStability = (d, s, r) =>
    fix(clamp(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), S_MIN, 36500));
  const interval = (s) => Math.min(Math.max(1, Math.round(s * modifier)), maximumInterval);

  /** state: { stability, difficulty, last_review, reps, lapses } 或 null（新题）。返回新状态与间隔天数。 */
  function review(state, rating, now = Date.now()) {
    const g = typeof rating === "string" ? RATING[rating] : rating;
    if (![1, 2, 3, 4].includes(g)) throw new Error(`无效评分：${rating}`);
    const isNew = !state || !state.stability;
    const next = {};
    if (isNew) {
      for (const k of [1, 2, 3, 4]) next[k] = { difficulty: initDifficulty(k), stability: initStability(k) };
    } else {
      const elapsed = Math.max(0, utcDayDiff(state.last_review, now));
      const r = retrievability(elapsed, state.stability);
      const { difficulty: d, stability: s } = state;
      next[1] = { difficulty: nextDifficulty(d, 1), stability: clamp(s, S_MIN, forgetStability(d, s, r)) };
      for (const k of [2, 3, 4]) next[k] = { difficulty: nextDifficulty(d, k), stability: recallStability(d, s, r, k) };
    }
    let [a, h, gd, e] = [1, 2, 3, 4].map((k) => interval(next[k].stability));
    a = Math.min(a, h); h = Math.max(h, a + 1); gd = Math.max(gd, h + 1); e = Math.max(e, gd + 1);
    const days = { 1: a, 2: h, 3: gd, 4: e }[g];
    return {
      days,
      state: {
        stability: next[g].stability,
        difficulty: next[g].difficulty,
        last_review: new Date(now).toISOString(),
        reps: (state?.reps || 0) + 1,
        lapses: (state?.lapses || 0) + (g === 1 && !isNew ? 1 : 0)
      }
    };
  }
  return { review, retrievability };
}

function utcDayDiff(from, to) {
  const a = new Date(from), b = new Date(to);
  return Math.floor((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / DAY);
}
