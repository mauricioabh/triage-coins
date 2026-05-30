import type { CircuitState, Opportunity, PnlPoint, RebalanceEvent, Trade } from "../../domain/entities/index.js";
import type { IStateStore } from "../../domain/ports/ports.js";
import { config } from "../config/config.js";

export class Store implements IStateStore {
  readonly startedAt = Date.now();

  private opportunities: Opportunity[] = [];
  private trades: Trade[] = [];
  private rebalances: RebalanceEvent[] = [];
  private pnl: PnlPoint[] = [];

  ticksProcessed = 0;
  opportunitiesDetected = 0;
  tradesExecuted = 0;
  tradesRejected = 0;
  realizedPnl = 0;
  consecutiveLosses = 0;
  circuit: CircuitState = "running";
  tickTimeEwma = 0;

  recordTickTime(ms: number): void {
    const alpha = 0.05;
    this.tickTimeEwma = this.tickTimeEwma === 0 ? ms : this.tickTimeEwma * (1 - alpha) + ms * alpha;
  }

  addOpportunity(op: Opportunity): void {
    this.opportunitiesDetected += 1;
    this.opportunities.unshift(op);
    if (this.opportunities.length > config.recentEventsMax) this.opportunities.pop();
  }

  addTrade(trade: Trade): void {
    this.tradesExecuted += 1;
    this.realizedPnl += trade.netProfit;
    this.trades.unshift(trade);
    if (this.trades.length > config.recentEventsMax) this.trades.pop();

    if (trade.netProfit < 0) {
      this.consecutiveLosses += 1;
    } else {
      this.consecutiveLosses = 0;
    }

    this.pnl.push({ ts: trade.ts, pnl: this.realizedPnl });
    if (this.pnl.length > config.pnlSeriesMax) this.pnl.shift();
  }

  addRebalance(event: RebalanceEvent): void {
    this.rebalances.unshift(event);
    if (this.rebalances.length > 20) this.rebalances.pop();
  }

  recentOpportunities(): Opportunity[] {
    return this.opportunities;
  }

  recentTrades(): Trade[] {
    return this.trades;
  }

  recentRebalances(): RebalanceEvent[] {
    return this.rebalances;
  }

  pnlSeries(): PnlPoint[] {
    return this.pnl;
  }

  reset(): void {
    this.opportunities = [];
    this.trades = [];
    this.rebalances = [];
    this.pnl = [];
    this.ticksProcessed = 0;
    this.opportunitiesDetected = 0;
    this.tradesExecuted = 0;
    this.tradesRejected = 0;
    this.realizedPnl = 0;
    this.consecutiveLosses = 0;
    this.circuit = "running";
    this.tickTimeEwma = 0;
  }
}
