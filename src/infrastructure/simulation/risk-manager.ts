import { createLogger } from "../logging/logger.js";
import type { IRiskGate, IStateStore, TradingPolicy } from "../../domain/ports/ports.js";

const log = createLogger("risk");

export class RiskManager implements IRiskGate {
  private trippedUntil = 0;

  constructor(
    private readonly store: IStateStore,
    private readonly policy: TradingPolicy,
  ) {}

  evaluate(now: number): void {
    if (this.store.circuit === "paused") return;
    if (this.store.consecutiveLosses >= this.policy.circuitBreakerLosses()) {
      const cooldownMs = this.policy.circuitBreakerCooldownMs();
      this.trippedUntil = now + cooldownMs;
      this.store.circuit = "tripped";
      log.warn(
        `circuit breaker tripped after ${this.store.consecutiveLosses} consecutive losses; ` +
          `cooling down ${cooldownMs}ms`,
      );
    }
  }

  tick(now: number): void {
    if (this.store.circuit === "tripped" && now >= this.trippedUntil) {
      this.store.circuit = "running";
      this.store.consecutiveLosses = 0;
      log.info("circuit breaker reset, resuming execution");
    }
  }

  canExecute(): boolean {
    return this.store.circuit === "running";
  }

  pause(): void {
    this.store.circuit = "paused";
    log.info("execution paused by operator");
  }

  resume(): void {
    this.store.circuit = "running";
    this.store.consecutiveLosses = 0;
    this.trippedUntil = 0;
    log.info("execution resumed by operator");
  }
}
