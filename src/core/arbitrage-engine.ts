import { walkBook, totalDepthBtc } from "../utils/vwap.js";
import {
  EXCHANGE_IDS,
  type ExchangeId,
  type Opportunity,
  type OpportunityStatus,
  type OrderBook,
} from "../types.js";
import type {
  IClock,
  IIdGenerator,
  IInventory,
  IQuoteBook,
  IRiskGate,
  IStateStore,
  ITradeExecutor,
  TradingPolicy,
} from "./ports.js";
import { netProfit, netProfitPct, takerFeeCost } from "./pricing.js";

const DUST_BTC = 1e-5;
const REJECT_THROTTLE_MS = 800;

/** Collaborators are ports (interfaces), never concrete classes. */
interface EngineDeps {
  quotes: IQuoteBook;
  inventory: IInventory;
  store: IStateStore;
  risk: IRiskGate;
  executor: ITradeExecutor;
  policy: TradingPolicy;
  clock: IClock;
  ids: IIdGenerator;
}

/**
 * Core arbitrage detection. On every order-book tick it re-evaluates all
 * ordered exchange pairs (buy on A, sell on B). For each gross divergence it:
 *   1. rejects stale quotes,
 *   2. caps volume by liquidity + wallet inventory (partial fills),
 *   3. walks both books to get the real VWAP (slippage included),
 *   4. computes net P&L after real taker fees,
 *   5. requires the edge to persist (anti-flicker) before executing,
 *   6. defers to the risk manager (circuit breaker) before executing.
 *
 * Net profit formula lives in `pricing.ts` (shared with the executor); slippage
 * is already inside the VWAPs — never double-counted.
 */
export class ArbitrageEngine {
  /** firstProfitableTs per pair, for anti-flicker confirmation. */
  private pending = new Map<string, number>();
  /** last opportunity emit per pair, to throttle the feed. */
  private lastEmit = new Map<string, number>();

  constructor(private readonly deps: EngineDeps) {}

  onBook(book: OrderBook): void {
    const start = performance.now();
    this.deps.quotes.update(book);
    this.deps.store.ticksProcessed += 1;
    this.evaluate(this.deps.clock.now());
    this.deps.store.recordTickTime(performance.now() - start);
  }

  /** Periodic tick (independent of feed) to reset the circuit breaker. */
  tick(now: number): void {
    this.deps.risk.tick(now);
  }

  private evaluate(now: number): void {
    for (const buy of EXCHANGE_IDS) {
      for (const sell of EXCHANGE_IDS) {
        if (buy === sell) continue;
        this.evaluatePair(buy, sell, now);
      }
    }
  }

  private evaluatePair(buy: ExchangeId, sell: ExchangeId, now: number): void {
    const key = `${buy}->${sell}`;
    const buyBook = this.deps.quotes.getBook(buy);
    const sellBook = this.deps.quotes.getBook(sell);
    const topAsk = buyBook?.asks[0];
    const topBid = sellBook?.bids[0];

    if (!buyBook || !sellBook || !topAsk || !topBid) {
      this.pending.delete(key);
      return;
    }

    // No gross divergence: buying ask is not below selling bid.
    if (topAsk.price >= topBid.price) {
      this.pending.delete(key);
      return;
    }

    // A raw cross exists. Stale data is untrustworthy.
    if (!this.deps.quotes.isFresh(buy, now) || !this.deps.quotes.isFresh(sell, now)) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_stale", "stale quote", now);
      this.pending.delete(key);
      return;
    }

    const feeBuyRate = this.deps.policy.takerFee(buy);
    const feeSellRate = this.deps.policy.takerFee(sell);

    // Cap volume by depth on both sides and by wallet inventory.
    const askDepth = totalDepthBtc(buyBook.asks);
    const bidDepth = totalDepthBtc(sellBook.bids);
    const buyable = this.deps.inventory.maxBuyableBtc(buy, topAsk.price * (1 + feeBuyRate));
    const sellable = this.deps.inventory.sellableBtc(sell);
    const requested = this.deps.policy.maxTradeBtc();
    const target = Math.min(requested, askDepth, bidDepth, buyable, sellable);

    if (target < DUST_BTC) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_liquidity", "no liquidity or inventory", now);
      this.pending.delete(key);
      return;
    }

    const buySide = walkBook(buyBook.asks, target);
    const sellSide = walkBook(sellBook.bids, target);
    const volume = Math.min(buySide.filledBtc, sellSide.filledBtc);
    if (volume < DUST_BTC) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_liquidity", "insufficient depth", now);
      this.pending.delete(key);
      return;
    }

    const buyVwap = buySide.vwap;
    const sellVwap = sellSide.vwap;
    const feeBuy = takerFeeCost(buyVwap, volume, feeBuyRate);
    const feeSell = takerFeeCost(sellVwap, volume, feeSellRate);
    const net = netProfit(buyVwap, sellVwap, volume, feeBuyRate, feeSellRate);
    const notional = buyVwap * volume;
    const netPct = netProfitPct(net, notional);
    const partial = volume < requested - DUST_BTC;

    const base = {
      buy,
      sell,
      topAsk: topAsk.price,
      topBid: topBid.price,
      volume,
      buyVwap,
      sellVwap,
      feeBuy,
      feeSell,
      netProfit: net,
      netProfitPct: netPct,
      now,
    };

    // Not enough edge to cover real costs.
    if (netPct <= this.deps.policy.minNetProfitPct()) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_fees", "net edge below threshold", now);
      this.pending.delete(key);
      return;
    }

    // Anti-flicker: the edge must persist before we trust it.
    const firstTs = this.pending.get(key) ?? now;
    if (!this.pending.has(key)) this.pending.set(key, now);
    if (now - firstTs < this.deps.policy.flickerConfirmMs()) {
      this.emit({ ...base, status: "pending_confirm", reason: "confirming edge persistence", partial }, true);
      return;
    }

    // Confirmed edge — defer to risk controls.
    if (!this.deps.risk.canExecute()) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_risk", "circuit breaker active", now);
      this.pending.delete(key);
      return;
    }

    const status: OpportunityStatus = partial ? "executed_partial" : "executed";
    const opportunity = this.emit({ ...base, status, reason: "executed", partial }, false);
    const trade = this.deps.executor.execute(opportunity, now);
    this.deps.store.addTrade(trade);
    this.deps.risk.evaluate(now);
    this.pending.delete(key);
    this.lastEmit.set(key, now);
  }

  private emitRejection(
    buy: ExchangeId,
    sell: ExchangeId,
    topAsk: number,
    topBid: number,
    status: OpportunityStatus,
    reason: string,
    now: number,
  ): void {
    const key = `${buy}->${sell}`;
    const last = this.lastEmit.get(key) ?? 0;
    if (now - last < REJECT_THROTTLE_MS) return;
    this.lastEmit.set(key, now);
    this.deps.store.tradesRejected += 1;
    const gross = topBid - topAsk;
    this.deps.store.addOpportunity({
      id: this.deps.ids.next("opp"),
      ts: now,
      buyExchange: buy,
      sellExchange: sell,
      topBuyAsk: topAsk,
      topSellBid: topBid,
      volumeBtc: 0,
      buyVwap: topAsk,
      sellVwap: topBid,
      grossSpread: gross,
      grossSpreadPct: topAsk > 0 ? gross / topAsk : 0,
      feeBuy: 0,
      feeSell: 0,
      netProfit: 0,
      netProfitPct: 0,
      status,
      reason,
      demo: this.deps.policy.isDemo(),
    });
  }

  private emit(
    p: {
      buy: ExchangeId;
      sell: ExchangeId;
      topAsk: number;
      topBid: number;
      volume: number;
      buyVwap: number;
      sellVwap: number;
      feeBuy: number;
      feeSell: number;
      netProfit: number;
      netProfitPct: number;
      status: OpportunityStatus;
      reason: string;
      partial: boolean;
      now: number;
    },
    throttled: boolean,
  ): Opportunity {
    const key = `${p.buy}->${p.sell}`;
    const gross = p.topBid - p.topAsk;
    const opportunity: Opportunity = {
      id: this.deps.ids.next("opp"),
      ts: p.now,
      buyExchange: p.buy,
      sellExchange: p.sell,
      topBuyAsk: p.topAsk,
      topSellBid: p.topBid,
      volumeBtc: p.volume,
      buyVwap: p.buyVwap,
      sellVwap: p.sellVwap,
      grossSpread: gross,
      grossSpreadPct: p.topAsk > 0 ? gross / p.topAsk : 0,
      feeBuy: p.feeBuy,
      feeSell: p.feeSell,
      netProfit: p.netProfit,
      netProfitPct: p.netProfitPct,
      status: p.status,
      reason: p.reason,
      demo: this.deps.policy.isDemo(),
    };

    if (throttled) {
      const last = this.lastEmit.get(key) ?? 0;
      if (p.now - last < REJECT_THROTTLE_MS) return opportunity;
      this.lastEmit.set(key, p.now);
    }
    this.deps.store.addOpportunity(opportunity);
    return opportunity;
  }
}
