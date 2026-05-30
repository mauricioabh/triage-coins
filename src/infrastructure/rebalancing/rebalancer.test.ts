import { test } from "node:test";
import assert from "node:assert/strict";
import { Rebalancer } from "./rebalancer.js";
import { FakeInventory, FakePolicy, FakeStore, SeqIds } from "../../test-support/test-fakes.js";

function setup(init: ConstructorParameters<typeof FakeInventory>[0]) {
  const inv = new FakeInventory(init);
  const store = new FakeStore();
  const policy = new FakePolicy();
  policy.rebalanceIntervalMsValue = 0;
  policy.rebalanceMinBtcValue = 0.3;
  policy.rebalanceMinUsdtValue = 1;
  const reb = new Rebalancer(inv, store, policy, new SeqIds());
  return { inv, store, policy, reb };
}

test("transfers BTC from richest to poorest when below threshold", () => {
  const { inv, store, reb } = setup({
    kraken: { usdt: 50000, btc: 0.5 },
    bybit: { usdt: 50000, btc: 0.1 },
    okx: { usdt: 50000, btc: 0.5 },
  });

  reb.tick(1000);

  assert.equal(store.rebalances.length, 1);
  const ev = store.rebalances[0]!;
  assert.equal(ev.asset, "BTC");
  assert.equal(ev.fromExchange, "kraken");
  assert.equal(ev.toExchange, "bybit");
  assert.ok(Math.abs(ev.amount - 0.2) < 1e-9, `amount ${ev.amount}`);
  assert.equal(inv.transfers.length, 1);
});

test("withdrawal fee is charged ONLY on rebalance, using the source venue's BTC fee", () => {
  const { inv, store, policy, reb } = setup({
    kraken: { usdt: 50000, btc: 0.5 },
    bybit: { usdt: 50000, btc: 0.1 },
    okx: { usdt: 50000, btc: 0.5 },
  });

  reb.tick(1000);

  const ev = store.rebalances[0]!;
  assert.equal(ev.withdrawalFee, policy.withdrawalFeesBtc.kraken);
  const received = ev.amount - ev.withdrawalFee;
  assert.ok(Math.abs(inv.get("bybit").btc - (0.1 + received)) < 1e-12, `bybit btc ${inv.get("bybit").btc}`);
  assert.equal(inv.transfers[0]!.fee, policy.withdrawalFeesBtc.kraken);
});

test("does not rebalance when every venue is above the threshold", () => {
  const { store, reb } = setup({
    kraken: { usdt: 50000, btc: 0.5 },
    bybit: { usdt: 50000, btc: 0.4 },
    okx: { usdt: 50000, btc: 0.5 },
  });

  reb.tick(1000);

  assert.equal(store.rebalances.length, 0);
});

test("respects the rebalance interval (no run before interval elapses)", () => {
  const inv = new FakeInventory({ bybit: { usdt: 50000, btc: 0.1 } });
  const store = new FakeStore();
  const policy = new FakePolicy();
  policy.rebalanceIntervalMsValue = 20000;
  policy.rebalanceMinBtcValue = 0.3;
  const reb = new Rebalancer(inv, store, policy, new SeqIds());

  reb.tick(1000);
  assert.equal(store.rebalances.length, 0);
});
