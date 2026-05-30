import { createLogger } from "../infrastructure/logging/logger.js";
import { config } from "../infrastructure/config/config.js";
import { runtime } from "../infrastructure/config/runtime.js";
import { RuntimeTradingPolicy } from "../infrastructure/config/trading-policy.js";
import { ConnectorFactory } from "../infrastructure/exchanges/index.js";
import { SyntheticFeed } from "../infrastructure/demo/synthetic-feed.js";
import { FeedRecorder } from "../infrastructure/demo/recorder.js";
import { OrderBookManager } from "../infrastructure/state/order-book-manager.js";
import { WalletBook } from "../infrastructure/state/wallet-book.js";
import { Store } from "../infrastructure/state/store.js";
import { RiskManager } from "../infrastructure/simulation/risk-manager.js";
import { ExecutionSimulator } from "../infrastructure/simulation/execution-simulator.js";
import { Rebalancer } from "../infrastructure/rebalancing/rebalancer.js";
import { SystemClock } from "../infrastructure/time/clock.js";
import { IdGenerator } from "../infrastructure/ids/id-generator.js";
import { ArbitrageEngine } from "../domain/services/arbitrage-engine.js";
import { ExecuteArbitrage } from "../application/use-cases/execute-arbitrage.js";
import { ProcessOrderBookUpdate } from "../application/use-cases/process-order-book-update.js";
import { RebalanceInventory } from "../application/use-cases/rebalance-inventory.js";
import { TickRiskAndRebalance } from "../application/use-cases/tick-risk-and-rebalance.js";
import { StartMarketData } from "../application/use-cases/start-market-data.js";
import { StopMarketData } from "../application/use-cases/stop-market-data.js";
import { ControlService } from "../application/use-cases/control-service.js";
import { ApplicationService } from "./application-service.js";
import type { IClock, MarketDataFeedFactory } from "../domain/ports/ports.js";

const log = createLogger("bootstrap");

export interface BootstrapOptions {
  feedFactory?: MarketDataFeedFactory;
  demoFeed?: SyntheticFeed;
  clock?: IClock;
}

export interface AppContext {
  application: ApplicationService;
  start(): void;
  stop(): void;
}

export function bootstrap(options: BootstrapOptions = {}): AppContext {
  const obm = new OrderBookManager();
  const wallets = new WalletBook();
  const store = new Store();
  const policy = new RuntimeTradingPolicy();
  const clock = options.clock ?? new SystemClock();
  const ids = new IdGenerator();
  const risk = new RiskManager(store, policy);
  const exec = new ExecutionSimulator(wallets, policy, ids);
  const executeArbitrage = new ExecuteArbitrage(exec, store, risk);
  const engine = new ArbitrageEngine({
    quotes: obm,
    inventory: wallets,
    store,
    risk,
    opportunityExecutor: executeArbitrage,
    policy,
    clock,
    ids,
  });
  const rebalancer = new Rebalancer(wallets, store, policy, ids);
  const rebalanceInventory = new RebalanceInventory(rebalancer);
  const tickRisk = new TickRiskAndRebalance(engine, rebalanceInventory);
  const recorder = new FeedRecorder();

  const processBook = new ProcessOrderBookUpdate(
    engine,
    recorder,
    (exchange) => runtime.activeExchanges[exchange],
  );

  const demoFeed = options.demoFeed ?? new SyntheticFeed();
  demoFeed.onBook((book) => processBook.run(book));

  const feedFactory = options.feedFactory ?? new ConnectorFactory();
  const marketData = new StartMarketData(
    feedFactory,
    demoFeed,
    (book) => processBook.run(book),
    () => runtime.demoMode,
    (id) => runtime.activeExchanges[id],
  );

  const controls = new ControlService(
    runtime,
    risk,
    obm,
    () => {
      store.reset();
      wallets.reset();
      log.info("state and wallets reset");
    },
    marketData,
    recorder,
  );

  const application = new ApplicationService(store, obm, wallets, controls);
  const stopMarket = new StopMarketData(marketData);

  let tickTimer: NodeJS.Timeout | null = null;

  return {
    application,
    start() {
      marketData.start();
      tickTimer = setInterval(() => tickRisk.tick(Date.now()), 1000);
      log.info(`engine started (demo=${runtime.demoMode})`);
    },
    stop() {
      if (tickTimer) clearInterval(tickTimer);
      stopMarket.run();
      recorder.close();
    },
  };
}

export { config };
