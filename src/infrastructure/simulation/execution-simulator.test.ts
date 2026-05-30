import { test } from "node:test";
import assert from "node:assert/strict";
import { ExecutionSimulator } from "./execution-simulator.js";
import { FakeInventory, FakePolicy, SeqIds } from "../../test-support/test-fakes.js";
import type { Opportunity } from "../../domain/entities/index.js";

function opportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp_1",
    ts: 1000,
    buyExchange: "bybit",
    sellExchange: "okx",
    topBuyAsk: 100000,
    topSellBid: 100600,
    volumeBtc: 0.1,
    buyVwap: 100000,
    sellVwap: 100600,
    grossSpread: 600,
    grossSpreadPct: 0.006,
    feeBuy: 0,
    feeSell: 0,
    netProfit: 0,
    netProfitPct: 0,
    status: "executed",
    reason: "executed",
    demo: false,
    ...over,
  };
}

const EPS = 1e-6;

test("applies adverse latency drift to both legs", () => {
  const inv = new FakeInventory();
  const policy = new FakePolicy();
  policy.latencyBps = 2;
  const sim = new ExecutionSimulator(inv, policy, new SeqIds());

  const trade = sim.execute(opportunity(), 2000);

  assert.ok(Math.abs(trade.execBuyVwap - 100020) < EPS, `execBuy ${trade.execBuyVwap}`);
  assert.ok(Math.abs(trade.execSellVwap - 100579.88) < EPS, `execSell ${trade.execSellVwap}`);
});

test("netProfit matches the drifted proceeds-minus-cost (golden)", () => {
  const inv = new FakeInventory();
  const policy = new FakePolicy();
  policy.latencyBps = 2;
  const sim = new ExecutionSimulator(inv, policy, new SeqIds());

  const trade = sim.execute(opportunity(), 2000);

  assert.ok(Math.abs(trade.netProfit - 35.928012) < EPS, `net ${trade.netProfit}`);
  assert.ok(Math.abs(trade.feeBuy - 10.002) < EPS, `feeBuy ${trade.feeBuy}`);
  assert.ok(Math.abs(trade.feeSell - 10.057988) < EPS, `feeSell ${trade.feeSell}`);
  assert.ok(Math.abs(trade.netProfitPct - 35.928012 / 10002) < EPS, `pct ${trade.netProfitPct}`);
});

test("updates wallets under the pre-positioned model (spend USDT on buy, gain USDT on sell)", () => {
  const inv = new FakeInventory({ bybit: { usdt: 50000, btc: 0.5 }, okx: { usdt: 50000, btc: 0.5 } });
  const policy = new FakePolicy();
  policy.latencyBps = 2;
  const sim = new ExecutionSimulator(inv, policy, new SeqIds());

  sim.execute(opportunity(), 2000);

  const bybit = inv.get("bybit");
  const okx = inv.get("okx");
  assert.ok(Math.abs(bybit.btc - 0.6) < EPS, `bybit btc ${bybit.btc}`);
  assert.ok(Math.abs(bybit.usdt - (50000 - 10012.002)) < EPS, `bybit usdt ${bybit.usdt}`);
  assert.ok(Math.abs(okx.btc - 0.4) < EPS, `okx btc ${okx.btc}`);
  assert.ok(Math.abs(okx.usdt - (50000 + 10047.930012)) < EPS, `okx usdt ${okx.usdt}`);
});

test("higher taker fees reduce realized net profit", () => {
  const policy = new FakePolicy();
  policy.latencyBps = 0;
  const low = new ExecutionSimulator(new FakeInventory(), policy, new SeqIds()).execute(opportunity(), 1);

  const policyHi = new FakePolicy();
  policyHi.latencyBps = 0;
  policyHi.takerFees = { kraken: 0.0026, bybit: 0.0026, okx: 0.0026, binance: 0.0026 };
  const hi = new ExecutionSimulator(new FakeInventory(), policyHi, new SeqIds()).execute(opportunity(), 1);

  assert.ok(hi.netProfit < low.netProfit, `expected ${hi.netProfit} < ${low.netProfit}`);
});

test("marks partial fills from opportunity status", () => {
  const sim = new ExecutionSimulator(new FakeInventory(), new FakePolicy(), new SeqIds());
  const trade = sim.execute(opportunity({ status: "executed_partial" }), 1);
  assert.equal(trade.partial, true);
});
