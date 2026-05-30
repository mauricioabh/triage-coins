import type { Opportunity, Trade } from "../../domain/entities/index.js";
import type { IIdGenerator, IInventory, ITradeExecutor, TradingPolicy } from "../../domain/ports/ports.js";
import { netProfit, netProfitPct, takerFeeCost } from "../../domain/services/pricing.js";

export class ExecutionSimulator implements ITradeExecutor {
  constructor(
    private readonly inventory: IInventory,
    private readonly policy: TradingPolicy,
    private readonly ids: IIdGenerator,
  ) {}

  execute(op: Opportunity, now: number): Trade {
    const drift = this.policy.latencySlippageBps() / 10_000;
    const execBuyVwap = op.buyVwap * (1 + drift);
    const execSellVwap = op.sellVwap * (1 - drift);

    const feeBuyRate = this.policy.takerFee(op.buyExchange);
    const feeSellRate = this.policy.takerFee(op.sellExchange);
    const feeBuy = takerFeeCost(execBuyVwap, op.volumeBtc, feeBuyRate);
    const feeSell = takerFeeCost(execSellVwap, op.volumeBtc, feeSellRate);

    const quoteCost = execBuyVwap * op.volumeBtc + feeBuy;
    const quoteProceeds = execSellVwap * op.volumeBtc - feeSell;
    const net = netProfit(execBuyVwap, execSellVwap, op.volumeBtc, feeBuyRate, feeSellRate);

    this.inventory.applyBuy(op.buyExchange, op.volumeBtc, quoteCost);
    this.inventory.applySell(op.sellExchange, op.volumeBtc, quoteProceeds);

    const notional = execBuyVwap * op.volumeBtc;
    return {
      id: this.ids.next("trade"),
      ts: now,
      buyExchange: op.buyExchange,
      sellExchange: op.sellExchange,
      volumeBtc: op.volumeBtc,
      requestedBtc: op.volumeBtc,
      buyVwap: op.buyVwap,
      sellVwap: op.sellVwap,
      execBuyVwap,
      execSellVwap,
      feeBuy,
      feeSell,
      netProfit: net,
      netProfitPct: netProfitPct(net, notional),
      partial: op.status === "executed_partial",
      demo: op.demo,
    };
  }
}
