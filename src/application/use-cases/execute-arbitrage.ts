import type { Opportunity } from "../../domain/entities/index.js";
import type { IOpportunityExecutor, IRiskGate, IStateStore, ITradeExecutor } from "../../domain/ports/ports.js";

/** Risk gate + simulated execution + store update after a confirmed opportunity. */
export class ExecuteArbitrage implements IOpportunityExecutor {
  constructor(
    private readonly executor: ITradeExecutor,
    private readonly store: IStateStore,
    private readonly risk: IRiskGate,
  ) {}

  execute(op: Opportunity, now: number): void {
    const trade = this.executor.execute(op, now);
    this.store.addTrade(trade);
    this.risk.evaluate(now);
  }
}
