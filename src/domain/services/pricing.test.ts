import { test } from "node:test";
import assert from "node:assert/strict";
import { netProfit, netProfitPct, takerFeeCost } from "./pricing.js";

test("takerFeeCost = vwap * volume * rate", () => {
  assert.equal(takerFeeCost(100, 2, 0.001), 0.2);
});

test("netProfit is positive when gross edge beats both taker fees", () => {
  const net = netProfit(100000, 100600, 0.1, 0.001, 0.001);
  assert.ok(Math.abs(net - 39.94) < 1e-9, `got ${net}`);
});

test("netProfit is negative when fees exceed gross edge", () => {
  const net = netProfit(100, 100.1, 1, 0.001, 0.001);
  assert.ok(net < 0, `expected negative, got ${net}`);
});

test("netProfit equals proceeds-minus-cost expansion (executor parity)", () => {
  const buyVwap = 100020;
  const sellVwap = 100579.88;
  const vol = 0.1;
  const fb = 0.001;
  const fs = 0.001;
  const feeBuy = takerFeeCost(buyVwap, vol, fb);
  const feeSell = takerFeeCost(sellVwap, vol, fs);
  const expected = sellVwap * vol - feeSell - (buyVwap * vol + feeBuy);
  assert.equal(netProfit(buyVwap, sellVwap, vol, fb, fs), expected);
});

test("netProfitPct divides by notional and guards zero", () => {
  assert.equal(netProfitPct(40, 10000), 0.004);
  assert.equal(netProfitPct(40, 0), 0);
});
