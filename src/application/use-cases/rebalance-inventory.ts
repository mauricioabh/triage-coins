import type { IRebalancer } from "../../domain/ports/ports.js";

/** Periodic inventory correction (withdrawal fee only here, not per trade). */
export class RebalanceInventory {
  constructor(private readonly rebalancer: IRebalancer) {}

  tick(now: number): void {
    this.rebalancer.tick(now);
  }
}
