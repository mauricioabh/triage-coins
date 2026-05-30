import type { StartMarketData } from "./start-market-data.js";

export class StopMarketData {
  constructor(private readonly marketData: StartMarketData) {}

  run(): void {
    this.marketData.stop();
  }
}
