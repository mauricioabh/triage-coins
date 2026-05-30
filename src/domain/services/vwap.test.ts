import { test } from "node:test";
import assert from "node:assert/strict";
import { walkBook, totalDepthBtc } from "./vwap.js";
import type { Level } from "../entities/index.js";

const asks: Level[] = [
  { price: 100, qty: 1 },
  { price: 101, qty: 2 },
  { price: 102, qty: 3 },
];

test("walkBook fills fully within first level", () => {
  const r = walkBook(asks, 0.5);
  assert.equal(r.filledBtc, 0.5);
  assert.equal(r.vwap, 100);
  assert.equal(r.fullyFilled, true);
});

test("walkBook computes VWAP across multiple levels (slippage)", () => {
  const r = walkBook(asks, 2);
  assert.equal(r.filledBtc, 2);
  assert.equal(r.vwap, 100.5);
  assert.equal(r.fullyFilled, true);
});

test("walkBook returns partial fill when depth is insufficient", () => {
  const r = walkBook(asks, 10);
  assert.equal(r.filledBtc, 6);
  assert.equal(r.fullyFilled, false);
});

test("walkBook handles zero/negative target", () => {
  assert.equal(walkBook(asks, 0).filledBtc, 0);
  assert.equal(walkBook(asks, -1).vwap, 0);
});

test("net profit is negative when fees exceed gross edge", () => {
  const vol = 1;
  const buyVwap = 100;
  const sellVwap = 100.1;
  const feeBuy = 0.001;
  const feeSell = 0.001;
  const net = sellVwap * vol * (1 - feeSell) - buyVwap * vol * (1 + feeBuy);
  assert.ok(net < 0, `expected negative net, got ${net}`);
});

test("totalDepthBtc sums all levels", () => {
  assert.equal(totalDepthBtc(asks), 6);
});
