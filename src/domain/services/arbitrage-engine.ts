import { walkBook, totalDepthBtc } from "./vwap.js";
import {
  EXCHANGE_IDS,
  type ExchangeId,
  type Opportunity,
  type OpportunityStatus,
  type OrderBook,
} from "../entities/index.js";
import type {
  IClock,
  IIdGenerator,
  IInventory,
  IOpportunityExecutor,
  IQuoteBook,
  IRiskGate,
  IStateStore,
  TradingPolicy,
} from "../ports/ports.js";
import { netProfit, netProfitPct, takerFeeCost } from "./pricing.js";

const DUST_BTC = 1e-5;
const REJECT_THROTTLE_MS = 800;

/** Scored pair ready for execution — emitted and executed only if selected as best. */
interface ExecutableCandidate {
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
  partial: boolean;
  now: number;
}

/** Collaborators are ports (interfaces), never concrete classes. */
export interface EngineDeps {
  quotes: IQuoteBook;
  inventory: IInventory;
  store: IStateStore;
  risk: IRiskGate;
  opportunityExecutor: IOpportunityExecutor;
  policy: TradingPolicy;
  clock: IClock;
  ids: IIdGenerator;
}

/**
 * Core arbitrage detection. On every order-book tick it re-evaluates all
 * ordered exchange pairs (buy on A, sell on B).
 */
export class ArbitrageEngine {
  private pending = new Map<string, number>();
  private lastEmit = new Map<string, number>();

  constructor(private readonly deps: EngineDeps) {}

  onBook(book: OrderBook): void {
    const start = performance.now();
    this.deps.quotes.update(book);
    this.deps.store.ticksProcessed += 1;
    this.evaluate(this.deps.clock.now());
    this.deps.store.recordTickTime(performance.now() - start);
  }

  tick(now: number): void {
    this.deps.risk.tick(now);
  }

  private evaluate(now: number): void {
    const executables: ExecutableCandidate[] = [];
    for (const buy of EXCHANGE_IDS) {
      for (const sell of EXCHANGE_IDS) {
        if (buy === sell) continue;
        const candidate = this.scorePair(buy, sell, now);
        if (candidate) executables.push(candidate);
      }
    }
    if (executables.length === 0) return;

    const best = executables.reduce((a, b) => (this.compareCandidates(a, b) < 0 ? b : a));
    const key = `${best.buy}->${best.sell}`;
    const status: OpportunityStatus = best.partial ? "executed_partial" : "executed";
    const opportunity = this.emit(
      { ...best, status, reason: "executed" },
      false,
    );
    this.deps.opportunityExecutor.execute(opportunity, now);
    this.pending.delete(key);
    this.lastEmit.set(key, now);
  }

  /** Higher netProfit wins; tie-break netProfitPct, then lexicographic (buy, sell). */
  private compareCandidates(a: ExecutableCandidate, b: ExecutableCandidate): number {
    if (a.netProfit !== b.netProfit) return a.netProfit - b.netProfit;
    if (a.netProfitPct !== b.netProfitPct) return a.netProfitPct - b.netProfitPct;
    if (a.buy !== b.buy) return a.buy < b.buy ? -1 : 1;
    return a.sell < b.sell ? -1 : a.sell === b.sell ? 0 : 1;
  }

  /** Score one pair; emit rejections and pending_confirm inline; return executable if confirmed. */
  private scorePair(buy: ExchangeId, sell: ExchangeId, now: number): ExecutableCandidate | null {
    const key = `${buy}->${sell}`;
    const buyBook = this.deps.quotes.getBook(buy);
    const sellBook = this.deps.quotes.getBook(sell);
    const topAsk = buyBook?.asks[0];
    const topBid = sellBook?.bids[0];

    if (!buyBook || !sellBook || !topAsk || !topBid) {
      this.pending.delete(key);
      return null;
    }

    if (topAsk.price >= topBid.price) {
      this.pending.delete(key);
      return null;
    }

    if (!this.deps.quotes.isFresh(buy, now) || !this.deps.quotes.isFresh(sell, now)) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_stale", "stale quote", now);
      this.pending.delete(key);
      return null;
    }

    const feeBuyRate = this.deps.policy.takerFee(buy);
    const feeSellRate = this.deps.policy.takerFee(sell);

    const askDepth = totalDepthBtc(buyBook.asks);
    const bidDepth = totalDepthBtc(sellBook.bids);
    const buyable = this.deps.inventory.maxBuyableBtc(buy, topAsk.price * (1 + feeBuyRate));
    const sellable = this.deps.inventory.sellableBtc(sell);
    const requested = this.deps.policy.maxTradeBtc();
    const target = Math.min(requested, askDepth, bidDepth, buyable, sellable);

    if (target < DUST_BTC) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_liquidity", "no liquidity or inventory", now);
      this.pending.delete(key);
      return null;
    }

    const buySide = walkBook(buyBook.asks, target);
    const sellSide = walkBook(sellBook.bids, target);
    const volume = Math.min(buySide.filledBtc, sellSide.filledBtc);
    if (volume < DUST_BTC) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_liquidity", "insufficient depth", now);
      this.pending.delete(key);
      return null;
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

    if (netPct <= this.deps.policy.minNetProfitPct()) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_fees", "net edge below threshold", now);
      this.pending.delete(key);
      return null;
    }

    const firstTs = this.pending.get(key) ?? now;
    if (!this.pending.has(key)) this.pending.set(key, now);
    if (now - firstTs < this.deps.policy.flickerConfirmMs()) {
      this.emit({ ...base, status: "pending_confirm", reason: "confirming edge persistence", partial }, true);
      return null;
    }

    if (!this.deps.risk.canExecute()) {
      this.emitRejection(buy, sell, topAsk.price, topBid.price, "rejected_risk", "circuit breaker active", now);
      this.pending.delete(key);
      return null;
    }

    return { ...base, partial };
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
