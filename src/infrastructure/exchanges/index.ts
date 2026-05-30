import type { ExchangeId } from "../../domain/entities/index.js";
import type { MarketDataFeed, MarketDataFeedFactory } from "../../domain/ports/ports.js";
import { ExchangeConnector } from "./base.js";
import { KrakenConnector } from "./kraken.js";
import { BybitConnector } from "./bybit.js";
import { OkxConnector } from "./okx.js";
import { BinanceConnector } from "./binance.js";

export function createConnector(id: ExchangeId): ExchangeConnector {
  switch (id) {
    case "kraken":
      return new KrakenConnector();
    case "bybit":
      return new BybitConnector();
    case "okx":
      return new OkxConnector();
    case "binance":
      return new BinanceConnector();
    default: {
      const _exhaustive: never = id;
      throw new Error(`unknown exchange: ${_exhaustive}`);
    }
  }
}

export function createConnectors(): ExchangeConnector[] {
  return [createConnector("kraken"), createConnector("bybit"), createConnector("okx"), createConnector("binance")];
}

/** Real-feed factory: builds a live WS connector per exchange. */
export class ConnectorFactory implements MarketDataFeedFactory {
  create(id: ExchangeId): MarketDataFeed {
    return createConnector(id);
  }
}

export { ExchangeConnector };
