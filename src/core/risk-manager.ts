import { createLogger } from "../utils/logger.js";
import type { IRiskGate, IStateStore, TradingPolicy } from "./ports.js";

const log = createLogger("risk");

/**
 * Risk controls:
 *  - Circuit breaker: after N consecutive losing trades, pause execution for a
 *    cooldown window (market is moving adversely faster than we can react).
 *  - Manual pause/resume.
 * Detection keeps running while paused — we still surface opportunities, we just
 * don't execute them.
 */
export class RiskManager implements IRiskGate {
  private trippedUntil = 0;

  constructor(
    private readonly store: IStateStore,
    private readonly policy: TradingPolicy,
  ) {}

  /** Call after every trade to evaluate the circuit breaker. */
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

  /** Auto-reset the breaker once the cooldown elapses. */
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
