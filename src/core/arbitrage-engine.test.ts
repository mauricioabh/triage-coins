import { test } from "node:test";
import assert from "node:assert/strict";
import { ArbitrageEngine } from "./arbitrage-engine.js";
import {
  FakeExecutor,
  FakeInventory,
  FakePolicy,
  FakeQuoteBook,
  FakeRiskGate,
  FakeStore,
  FixedClock,
  SeqIds,
  book,
} from "./test-fakes.js";
import type { ExchangeId, OpportunityStatus } from "../types.js";

const NOW = 1_000_000;

interface Harness {
  engine: ArbitrageEngine;
  quotes: FakeQuoteBook;
  store: FakeStore;
  risk: FakeRiskGate;
  executor: FakeExecutor;
  policy: FakePolicy;
}

/**
 * Wire an engine over fakes. Only the bybit->okx pair is set up to cross; the
 * reverse and any kraken pair never cross, so a single opportunity is produced.
 */
function harness(opts: { recvTs?: number; buyAsk?: number; sellBid?: number; flickerMs?: number } = {}): Harness {
  const { recvTs = NOW, buyAsk = 100000, sellBid = 100600, flickerMs = 0 } = opts;
  const quotes = new FakeQuoteBook();
  const store = new FakeStore();
  const risk = new FakeRiskGate(true);
  const executor = new FakeExecutor(1);
  const policy = new FakePolicy();
  policy.maxTrade = 0.1;
  policy.flickerMs = flickerMs;

  quotes.update(book("bybit", [{ price: buyAsk - 10, qty: 1 }], [{ price: buyAsk, qty: 1 }], recvTs));
  quotes.update(book("okx", [{ price: sellBid, qty: 1 }], [{ price: sellBid + 10, qty: 1 }], recvTs));

  const engine = new ArbitrageEngine({
    quotes,
    inventory: new FakeInventory(),
    store,
    risk,
    executor,
    policy,
    clock: new FixedClock(NOW),
    ids: new SeqIds(),
  });
  return { engine, quotes, store, risk, executor, policy };
}

function statusesFor(h: Harness, buy: ExchangeId, sell: ExchangeId): OpportunityStatus[] {
  return h.store.opportunities
    .filter((o) => o.buyExchange === buy && o.sellExchange === sell)
    .map((o) => o.status);
}

function trigger(h: Harness): void {
  // Re-emit one of the existing books to drive a full evaluate() at clock.now().
  h.engine.onBook(h.quotes.getBook("okx")!);
}

test("executes a clean, net-profitable, fresh, confirmed cross", () => {
  const h = harness({ flickerMs: 0 });
  trigger(h);

  assert.deepEqual(statusesFor(h, "bybit", "okx"), ["executed"]);
  assert.equal(h.executor.calls.length, 1);
  assert.equal(h.store.trades.length, 1);
  assert.equal(h.risk.evaluations.length, 1);
});

test("rejected_fees when the net edge is below the threshold", () => {
  // 0.1% gross vs 0.1% taker each side => net negative, below threshold.
  const h = harness({ buyAsk: 100000, sellBid: 100100, flickerMs: 0 });
  trigger(h);

  assert.deepEqual(statusesFor(h, "bybit", "okx"), ["rejected_fees"]);
  assert.equal(h.executor.calls.length, 0);
  assert.equal(h.store.trades.length, 0);
});

test("rejected_stale when a crossing quote is older than staleMs", () => {
  const h = harness({ recvTs: NOW - 5000, flickerMs: 0 }); // > 3000ms stale
  trigger(h);

  assert.deepEqual(statusesFor(h, "bybit", "okx"), ["rejected_stale"]);
  assert.equal(h.executor.calls.length, 0);
});

test("anti-flicker: first profitable tick is pending_confirm, not executed", () => {
  const h = harness({ flickerMs: 150 });
  trigger(h);

  assert.deepEqual(statusesFor(h, "bybit", "okx"), ["pending_confirm"]);
  assert.equal(h.executor.calls.length, 0);
  assert.equal(h.store.trades.length, 0);
});

test("does not execute while the risk gate is closed", () => {
  const h = harness({ flickerMs: 0 });
  h.risk.allow = false;
  trigger(h);

  assert.deepEqual(statusesFor(h, "bybit", "okx"), ["rejected_risk"]);
  assert.equal(h.executor.calls.length, 0);
});

test("counts ticks processed", () => {
  const h = harness({ flickerMs: 0 });
  trigger(h);
  assert.equal(h.store.ticksProcessed, 1);
});
