import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap } from "../../composition/bootstrap.js";
import { runtime } from "../../infrastructure/config/runtime.js";
import { FakeMarketDataFeedFactory } from "../../test-support/fake-market-data-feed.js";
import { book, FixedClock } from "../../test-support/test-fakes.js";
import { SyntheticFeed } from "../../infrastructure/demo/synthetic-feed.js";

const NOW = 2_000_000;

test("fixture feed drives detection through bootstrap without network", () => {
  runtime.demoMode = false;
  runtime.flickerConfirmMs = 0;
  runtime.minNetProfitPct = 0.0001;

  const fixtures = [
    book("bybit", [{ price: 99_990, qty: 2 }], [{ price: 100_000, qty: 2 }], NOW),
    book("okx", [{ price: 100_600, qty: 2 }], [{ price: 100_610, qty: 2 }], NOW),
    book("kraken", [{ price: 100_200, qty: 2 }], [{ price: 100_210, qty: 2 }], NOW),
  ];

  const ctx = bootstrap({
    feedFactory: new FakeMarketDataFeedFactory(fixtures),
    demoFeed: new SyntheticFeed(),
    clock: new FixedClock(NOW),
  });

  ctx.start();

  const snap = ctx.application.getSnapshot();
  ctx.stop();

  assert.ok(snap.stats.ticksProcessed >= 2, `ticks ${snap.stats.ticksProcessed}`);
  const executed = snap.recentOpportunities.filter((o) => o.status === "executed" || o.status === "executed_partial");
  assert.ok(executed.length >= 1, "expected at least one executed opportunity from fixture cross");
  assert.ok(snap.stats.tradesExecuted >= 1, `trades ${snap.stats.tradesExecuted}`);
});

test("NDJSON-shaped fixture lines replay as order books", () => {
  const line = {
    ts: NOW,
    exchange: "bybit" as const,
    bids: [{ price: 99_000, qty: 1 }],
    asks: [{ price: 99_010, qty: 1 }],
  };
  const fixtures = [book(line.exchange, line.bids, line.asks, line.ts)];

  runtime.demoMode = false;
  runtime.flickerConfirmMs = 0;

  const ctx = bootstrap({
    feedFactory: new FakeMarketDataFeedFactory(fixtures),
    clock: new FixedClock(NOW),
  });
  ctx.start();
  assert.equal(ctx.application.getSnapshot().stats.ticksProcessed, 1);
  ctx.stop();
});
