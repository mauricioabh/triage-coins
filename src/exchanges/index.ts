import { ExchangeConnector } from "./base.js";
import { KrakenConnector } from "./kraken.js";
import { BybitConnector } from "./bybit.js";
import { OkxConnector } from "./okx.js";

export function createConnectors(): ExchangeConnector[] {
  return [new KrakenConnector(), new BybitConnector(), new OkxConnector()];
}

export { ExchangeConnector };
