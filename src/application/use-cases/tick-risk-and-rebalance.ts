import type { ArbitrageEngine } from "../../domain/services/arbitrage-engine.js";
import type { RebalanceInventory } from "./rebalance-inventory.js";

/** Periodic risk cooldown reset + rebalancer tick (independent of feed). */
export class TickRiskAndRebalance {
  constructor(
    private readonly engine: ArbitrageEngine,
    private readonly rebalance: RebalanceInventory,
  ) {}

  tick(now: number): void {
    this.engine.tick(now);
    this.rebalance.tick(now);
  }
}
