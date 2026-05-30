/**
 * OpenAPI 3.0 specification for the Triage Coins REST API.
 *
 * Triage Coins is a **simulated** cross-exchange BTC/USDT arbitrage system.
 * No real funds are at risk — all trades are paper-executed against live order
 * book data from Kraken, Bybit, OKX and Binance (or a synthetic feed in demo mode).
 */

import type { OpenAPIV3 } from "openapi-types";

// ---------------------------------------------------------------------------
// Reusable schema components
// ---------------------------------------------------------------------------

const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  ExchangeId: {
    type: "string",
    enum: ["kraken", "bybit", "okx", "binance"],
    description: "One of the supported exchanges.",
  },

  FeedStatus: {
    type: "string",
    enum: ["connecting", "live", "stale", "down"],
    description: "Connectivity state of the exchange WebSocket feed.",
  },

  CircuitState: {
    type: "string",
    enum: ["running", "paused", "tripped"],
    description:
      "State of the circuit-breaker: `running` = normal, `paused` = manually paused, `tripped` = auto-paused after N consecutive losses.",
  },

  OpportunityStatus: {
    type: "string",
    enum: [
      "executed",
      "executed_partial",
      "rejected_fees",
      "rejected_liquidity",
      "rejected_risk",
      "rejected_flicker",
      "rejected_stale",
      "pending_confirm",
    ],
    description: "Disposition of a detected arbitrage opportunity.",
  },

  BestQuote: {
    type: "object",
    description: "Best bid/ask snapshot for one exchange, as seen by the engine.",
    required: ["exchange", "bid", "bidQty", "ask", "askQty", "recvTs", "status", "ageMs"],
    properties: {
      exchange: { $ref: "#/components/schemas/ExchangeId" },
      bid: { type: "number", nullable: true, description: "Best bid price in USDT (null when feed is down)." },
      bidQty: { type: "number", nullable: true, description: "Quantity available at the best bid (BTC)." },
      ask: { type: "number", nullable: true, description: "Best ask price in USDT (null when feed is down)." },
      askQty: { type: "number", nullable: true, description: "Quantity available at the best ask (BTC)." },
      recvTs: { type: "integer", nullable: true, description: "Local receive timestamp (ms since epoch)." },
      status: { $ref: "#/components/schemas/FeedStatus" },
      ageMs: { type: "integer", nullable: true, description: "Milliseconds since the last update was received." },
    },
  },

  Wallet: {
    type: "object",
    description:
      "Simulated per-exchange wallet. Each exchange starts with pre-positioned USDT **and** BTC so buy/sell legs execute in parallel without on-chain transfers.",
    required: ["exchange", "usdt", "btc"],
    properties: {
      exchange: { $ref: "#/components/schemas/ExchangeId" },
      usdt: { type: "number", description: "USDT balance at this exchange." },
      btc: { type: "number", description: "BTC balance at this exchange." },
    },
  },

  Opportunity: {
    type: "object",
    description:
      "An arbitrage opportunity detected by the engine. May have been executed or rejected for various reasons (fees, liquidity, flicker, stale quotes, risk).",
    required: [
      "id", "ts", "buyExchange", "sellExchange",
      "topBuyAsk", "topSellBid", "volumeBtc",
      "buyVwap", "sellVwap",
      "grossSpread", "grossSpreadPct",
      "feeBuy", "feeSell",
      "netProfit", "netProfitPct",
      "status", "reason", "demo",
    ],
    properties: {
      id: { type: "string" },
      ts: { type: "integer", description: "Detection timestamp (ms epoch)." },
      buyExchange: { $ref: "#/components/schemas/ExchangeId" },
      sellExchange: { $ref: "#/components/schemas/ExchangeId" },
      topBuyAsk: { type: "number", description: "Top-of-book ask price on the buy exchange (USDT)." },
      topSellBid: { type: "number", description: "Top-of-book bid price on the sell exchange (USDT)." },
      volumeBtc: {
        type: "number",
        description: "Volume evaluated (BTC) after applying liquidity depth and wallet inventory caps.",
      },
      buyVwap: {
        type: "number",
        description: "Volume-weighted average buy price after walking the order book depth (USDT). Slippage is embedded here.",
      },
      sellVwap: {
        type: "number",
        description: "Volume-weighted average sell price after walking the order book depth (USDT). Slippage is embedded here.",
      },
      grossSpread: { type: "number", description: "Raw spread (sellVwap − buyVwap) in USDT." },
      grossSpreadPct: { type: "number", description: "Gross spread as a percentage of buyVwap." },
      feeBuy: { type: "number", description: "Taker fee rate for the buy exchange (e.g. 0.0026 for Kraken)." },
      feeSell: { type: "number", description: "Taker fee rate for the sell exchange." },
      netProfit: {
        type: "number",
        description: "Net P&L in USDT: sellVwap·vol·(1−feeSell) − buyVwap·vol·(1+feeBuy). Negative = loss.",
      },
      netProfitPct: { type: "number", description: "Net profit as a percentage of cost basis." },
      status: { $ref: "#/components/schemas/OpportunityStatus" },
      reason: { type: "string", description: "Human-readable explanation of the disposition." },
      demo: {
        type: "boolean",
        description: "True when this opportunity was synthetically injected by the demo feed — never real market data.",
      },
    },
  },

  Trade: {
    type: "object",
    description:
      "A simulated trade that was executed (or partially executed). Includes latency-drift adjustment on both VWAP prices to model realistic fill slippage between detection and execution.",
    required: [
      "id", "ts", "buyExchange", "sellExchange",
      "volumeBtc", "requestedBtc",
      "buyVwap", "sellVwap", "execBuyVwap", "execSellVwap",
      "feeBuy", "feeSell",
      "netProfit", "netProfitPct",
      "partial", "demo",
    ],
    properties: {
      id: { type: "string" },
      ts: { type: "integer", description: "Execution timestamp (ms epoch)." },
      buyExchange: { $ref: "#/components/schemas/ExchangeId" },
      sellExchange: { $ref: "#/components/schemas/ExchangeId" },
      volumeBtc: { type: "number", description: "Actual filled volume (BTC)." },
      requestedBtc: { type: "number", description: "Originally requested volume before partial fill." },
      buyVwap: { type: "number", description: "VWAP at detection time (pre-latency, USDT)." },
      sellVwap: { type: "number", description: "VWAP at detection time (pre-latency, USDT)." },
      execBuyVwap: {
        type: "number",
        description: "Simulated fill price after latency drift on the buy side (USDT). Reflects real-world price movement during order routing.",
      },
      execSellVwap: {
        type: "number",
        description: "Simulated fill price after latency drift on the sell side (USDT).",
      },
      feeBuy: { type: "number" },
      feeSell: { type: "number" },
      netProfit: { type: "number", description: "Realized net P&L in USDT (negative = loss)." },
      netProfitPct: { type: "number" },
      partial: { type: "boolean", description: "True when the fill was limited by order book depth or wallet balance." },
      demo: { type: "boolean" },
    },
  },

  RebalanceEvent: {
    type: "object",
    description:
      "An inter-exchange rebalance triggered to correct inventory drift. Withdrawal fees apply here — not per-trade.",
    required: ["id", "ts", "fromExchange", "toExchange", "asset", "amount", "withdrawalFee", "reason"],
    properties: {
      id: { type: "string" },
      ts: { type: "integer" },
      fromExchange: { $ref: "#/components/schemas/ExchangeId" },
      toExchange: { $ref: "#/components/schemas/ExchangeId" },
      asset: { type: "string", enum: ["BTC", "USDT"] },
      amount: { type: "number" },
      withdrawalFee: { type: "number", description: "Withdrawal fee in the transferred asset." },
      reason: { type: "string" },
    },
  },

  PnlPoint: {
    type: "object",
    description: "A cumulative P&L data point for the time-series chart.",
    required: ["ts", "pnl"],
    properties: {
      ts: { type: "integer", description: "Timestamp (ms epoch)." },
      pnl: { type: "number", description: "Cumulative realized P&L in USDT at this timestamp." },
    },
  },

  EngineStats: {
    type: "object",
    description: "Runtime statistics for the arbitrage engine.",
    required: [
      "uptimeMs", "ticksProcessed", "opportunitiesDetected",
      "tradesExecuted", "tradesRejected",
      "realizedPnl", "consecutiveLosses",
      "circuit", "demoMode", "avgTickMs",
    ],
    properties: {
      uptimeMs: { type: "integer", description: "Engine uptime in milliseconds." },
      ticksProcessed: { type: "integer", description: "Total order-book ticks processed." },
      opportunitiesDetected: { type: "integer" },
      tradesExecuted: { type: "integer" },
      tradesRejected: { type: "integer" },
      realizedPnl: { type: "number", description: "Cumulative realized P&L in USDT." },
      consecutiveLosses: {
        type: "integer",
        description: "Consecutive losing trades since the last reset — triggers the circuit-breaker when it reaches the configured threshold.",
      },
      circuit: { $ref: "#/components/schemas/CircuitState" },
      demoMode: {
        type: "boolean",
        description: "When true the engine consumes a synthetic (clearly-labelled) feed instead of live exchange data.",
      },
      avgTickMs: { type: "number", description: "EWMA of tick processing time in milliseconds." },
    },
  },

  PublicConfig: {
    type: "object",
    description: "Live engine configuration. All fields are read/write unless noted.",
    required: [
      "minNetProfitPct", "maxTradeBtc", "staleMs",
      "flickerConfirmMs", "latencyMs",
      "activeExchanges", "defaults", "takerFees", "withdrawalFeesBtc",
    ],
    properties: {
      minNetProfitPct: {
        type: "number",
        description: "Minimum net profit percentage required to execute a trade. Opportunities below this threshold are rejected as `rejected_fees`.",
      },
      maxTradeBtc: {
        type: "number",
        description: "Maximum BTC volume per simulated trade. Caps partial fills.",
      },
      staleMs: {
        type: "integer",
        description: "Quote age (ms) beyond which a price is considered stale and the opportunity is rejected. Read-only (set via env).",
      },
      flickerConfirmMs: {
        type: "integer",
        description: "Minimum time (ms) a spread must persist before execution. Prevents acting on transient latency artefacts.",
      },
      latencyMs: {
        type: "integer",
        description: "Simulated order-routing latency applied when computing exec VWAP drift. Read-only (set via env).",
      },
      activeExchanges: {
        type: "object",
        additionalProperties: { type: "boolean" },
        description: "Map of exchangeId → enabled. Disabled exchanges are excluded from opportunity detection.",
      },
      defaults: {
        type: "object",
        description: "Factory defaults for the mutable fields.",
        properties: {
          minNetProfitPct: { type: "number" },
          maxTradeBtc: { type: "number" },
          flickerConfirmMs: { type: "integer" },
          activeExchanges: { type: "object", additionalProperties: { type: "boolean" } },
        },
      },
      takerFees: {
        type: "object",
        additionalProperties: { type: "number" },
        description: "Taker fee rates per exchange (e.g. kraken: 0.0026, bybit: 0.001, okx: 0.001, binance: 0.001).",
      },
      withdrawalFeesBtc: {
        type: "object",
        additionalProperties: { type: "number" },
        description: "BTC withdrawal fees per exchange — only relevant for the rebalancer, never charged per trade.",
      },
    },
  },

  StateSnapshot: {
    type: "object",
    description: "Full engine snapshot — same payload pushed over SSE on every tick.",
    required: ["ts", "quotes", "wallets", "stats", "recentOpportunities", "recentTrades", "rebalances", "pnlSeries", "config"],
    properties: {
      ts: { type: "integer", description: "Snapshot timestamp (ms epoch)." },
      quotes: { type: "array", items: { $ref: "#/components/schemas/BestQuote" } },
      wallets: { type: "array", items: { $ref: "#/components/schemas/Wallet" } },
      stats: { $ref: "#/components/schemas/EngineStats" },
      recentOpportunities: { type: "array", items: { $ref: "#/components/schemas/Opportunity" } },
      recentTrades: { type: "array", items: { $ref: "#/components/schemas/Trade" } },
      rebalances: { type: "array", items: { $ref: "#/components/schemas/RebalanceEvent" } },
      pnlSeries: { type: "array", items: { $ref: "#/components/schemas/PnlPoint" } },
      config: { $ref: "#/components/schemas/PublicConfig" },
    },
  },

  SuccessEnvelope: {
    type: "object",
    required: ["success"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: { description: "Response payload (shape depends on the endpoint)." },
    },
    additionalProperties: false,
  },

  SuccessEnvelopeNoData: {
    type: "object",
    required: ["success"],
    properties: {
      success: { type: "boolean", enum: [true] },
    },
    additionalProperties: false,
    example: { success: true },
  },

  ErrorEnvelope: {
    type: "object",
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: { type: "string", description: "Human-readable error message." },
    },
    additionalProperties: false,
    example: { success: false, error: "enabled must be a boolean" },
  },

  DemoControlBody: {
    type: "object",
    required: ["enabled"],
    properties: {
      enabled: {
        type: "boolean",
        description: "`true` to activate the synthetic feed, `false` to return to live data.",
        example: true,
      },
    },
    additionalProperties: false,
  },

  RecordControlBody: {
    type: "object",
    required: ["enabled"],
    properties: {
      enabled: { type: "boolean", description: "Start or stop NDJSON feed recording.", example: false },
    },
    additionalProperties: false,
  },

  ThresholdControlBody: {
    type: "object",
    required: ["pct"],
    properties: {
      pct: {
        type: "number",
        description: "Net profit threshold as a decimal percentage (0.0001–0.01, e.g. `0.0005` = 0.05 %).",
        minimum: 0.0001,
        maximum: 0.01,
        example: 0.0005,
      },
    },
    additionalProperties: false,
  },

  MaxTradeControlBody: {
    type: "object",
    required: ["btc"],
    properties: {
      btc: {
        type: "number",
        description: "Maximum BTC volume per trade (0.01–1.0).",
        minimum: 0.01,
        maximum: 1.0,
        example: 0.05,
      },
    },
    additionalProperties: false,
  },

  ConfigPatch: {
    type: "object",
    description: "Partial update for engine configuration. Only provided fields are changed.",
    properties: {
      minNetProfitPct: { type: "number" },
      maxTradeBtc: { type: "number" },
      flickerConfirmMs: { type: "integer" },
      activeExchanges: {
        type: "object",
        additionalProperties: { type: "boolean" },
        description: "Partial map — only provided exchange entries are updated.",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Reusable response helpers
// ---------------------------------------------------------------------------

function successResponseNoData(description: string): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/SuccessEnvelopeNoData" },
      },
    },
  };
}

function successResponse(description: string, dataSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, example?: unknown): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: dataSchema,
          },
          additionalProperties: false,
        },
        ...(example !== undefined ? { example } : {}),
      },
    },
  };
}

const badRequestResponse: OpenAPIV3.ResponseObject = {
  description: "Invalid request body or out-of-range value.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
};

const serverErrorResponse: OpenAPIV3.ResponseObject = {
  description: "Unexpected server error.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      example: { success: false, error: "Internal server error" },
    },
  },
};

function controlBodyResponses(
  okDescription: string,
  dataSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  example: unknown,
): OpenAPIV3.ResponsesObject {
  return {
    "200": successResponse(okDescription, dataSchema, example),
    "400": badRequestResponse,
    "500": serverErrorResponse,
  };
}

// ---------------------------------------------------------------------------
// Full OpenAPI document
// ---------------------------------------------------------------------------

export const openapiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Triage Coins API",
    version: "1.0.0",
    description: `
**Triage Coins** is a real-time BTC/USDT arbitrage detection and simulation engine
that monitors live order books from **Kraken**, **Bybit**, **OKX** and **Binance** simultaneously.

> ⚠️ **Simulated only** — no real funds are ever committed. All trades are paper-executed
> against live (or synthetic demo) market data. The system uses a *pre-positioned inventory
> model*: each exchange holds both USDT and BTC so buy and sell legs run in parallel without
> on-chain transfers.

### Key concepts
| Concept | Detail |
|---|---|
| Profit formula | \`sellVwap·vol·(1−feeSell) − buyVwap·vol·(1+feeBuy)\` |
| Slippage | Embedded in VWAP by walking the order book depth level by level |
| Anti-flicker | Spread must persist \`flickerConfirmMs\` before execution |
| Circuit breaker | Auto-pauses after N consecutive losses |
| Demo mode | Injects synthetic divergences — clearly labelled, never presented as real |
    `.trim(),
    contact: { name: "Triage Coins" },
    license: { name: "MIT" },
  },
  servers: [
    { url: "/", description: "Current host (Railway / local)" },
  ],
  tags: [
    { name: "Monitoring", description: "Health and state inspection." },
    { name: "Streaming", description: "Server-Sent Events real-time feed." },
    { name: "Configuration", description: "Read and update engine parameters." },
    { name: "Control", description: "Pause, resume, reset and mode switches." },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Monitoring"],
        summary: "Health check",
        description:
          "Lightweight endpoint used by Railway (and any uptime monitor) to verify the server is alive. Always returns HTTP 200 while the process is running.",
        operationId: "getHealth",
        responses: {
          "200": successResponse("Server is healthy.", {
            type: "object",
            required: ["status", "ts"],
            properties: {
              status: { type: "string", enum: ["ok"] },
              ts: { type: "integer", description: "Server timestamp (ms epoch)." },
            },
          }, { success: true, data: { status: "ok", ts: 1_700_000_000_000 } }),
          "500": serverErrorResponse,
        },
      },
    },

    "/api/state": {
      get: {
        tags: ["Monitoring"],
        summary: "Full state snapshot",
        description:
          "Returns the complete in-memory engine state as a single JSON document: live quotes from all active exchanges, simulated wallet balances, engine statistics, the last N detected opportunities and executed trades, rebalance history, the cumulative P&L time-series, and the current engine configuration.",
        operationId: "getState",
        responses: {
          "200": successResponse("Current engine state.", { $ref: "#/components/schemas/StateSnapshot" }),
          "500": serverErrorResponse,
        },
      },
    },

    "/api/stream": {
      get: {
        tags: ["Streaming"],
        summary: "SSE real-time feed",
        description:
          "Opens a persistent [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) connection. The server pushes a `StateSnapshot` JSON payload on every engine tick (typically every few hundred milliseconds). The dashboard React app subscribes here — no WebSocket or polling needed.\n\nConnect with `EventSource` or any SSE client. The stream never closes unless the server restarts or the client disconnects.",
        operationId: "getStream",
        responses: {
          "200": {
            description: "SSE stream opened. Each `data:` event carries a JSON-encoded `StateSnapshot`.",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description: "Newline-delimited SSE events. Each `data:` line contains a serialized `StateSnapshot`.",
                },
              },
            },
          },
        },
      },
    },

    "/api/config": {
      get: {
        tags: ["Configuration"],
        summary: "Get engine configuration",
        description:
          "Returns the current mutable and immutable engine parameters: profit threshold, max trade size, flicker window, active exchanges, fee tables and factory defaults.",
        operationId: "getConfig",
        responses: {
          "200": successResponse("Current configuration.", { $ref: "#/components/schemas/PublicConfig" }),
          "500": serverErrorResponse,
        },
      },
      patch: {
        tags: ["Configuration"],
        summary: "Update engine configuration",
        description:
          "Applies a partial update to mutable engine parameters. Only the fields present in the request body are changed; omitted fields retain their current values.\n\nReturns the full updated configuration on success.",
        operationId: "patchConfig",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ConfigPatch" } },
          },
        },
        responses: {
          "200": successResponse("Updated configuration.", { $ref: "#/components/schemas/PublicConfig" }),
          "400": badRequestResponse,
          "500": serverErrorResponse,
        },
      },
    },

    "/api/control/pause": {
      post: {
        tags: ["Control"],
        summary: "Pause the arbitrage engine",
        description:
          "Manually pauses the engine. Opportunities are no longer evaluated and no new trades are executed until `resume` is called. Order book feeds remain connected. This is equivalent to setting the circuit state to `paused`.",
        operationId: "controlPause",
        responses: {
          "200": successResponseNoData("Engine paused."),
          "500": serverErrorResponse,
        },
      },
    },

    "/api/control/resume": {
      post: {
        tags: ["Control"],
        summary: "Resume the arbitrage engine",
        description:
          "Resumes opportunity evaluation after a `pause` or a circuit-breaker trip. The engine immediately re-enters the `running` circuit state.",
        operationId: "controlResume",
        responses: {
          "200": successResponseNoData("Engine resumed."),
          "500": serverErrorResponse,
        },
      },
    },

    "/api/control/reset": {
      post: {
        tags: ["Control"],
        summary: "Reset simulated state",
        description:
          "Resets the simulated wallets back to their initial pre-positioned balances, clears the trade history, resets the cumulative P&L to zero, and restores the consecutive-loss counter. Engine configuration (thresholds, fee tables) is not affected. Useful for starting a clean simulation session.",
        operationId: "controlReset",
        responses: {
          "200": successResponseNoData("State reset."),
          "500": serverErrorResponse,
        },
      },
    },

    "/api/control/demo": {
      post: {
        tags: ["Control"],
        summary: "Enable / disable demo feed",
        description:
          "Switches between the live exchange feeds and the **synthetic demo injector**. When `enabled: true` the engine receives artificially inflated spreads that guarantee visible arbitrage opportunities — clearly labelled with `demo: true` in every event so they are never mistaken for real market signals.\n\n**Note:** Real feeds are paused while demo mode is active.",
        operationId: "controlDemo",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/DemoControlBody" } },
          },
        },
        responses: controlBodyResponses(
          "Demo mode updated.",
          {
            type: "object",
            required: ["demoMode"],
            properties: { demoMode: { type: "boolean" } },
            additionalProperties: false,
          },
          { success: true, data: { demoMode: true } },
        ),
      },
    },

    "/api/control/record": {
      post: {
        tags: ["Control"],
        summary: "Enable / disable feed recording",
        description:
          "Starts or stops recording live order-book events to an NDJSON file on disk for later replay. Useful for capturing real market sessions to run deterministic back-tests without re-connecting to exchanges.",
        operationId: "controlRecord",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RecordControlBody" } },
          },
        },
        responses: controlBodyResponses(
          "Recording state updated.",
          {
            type: "object",
            required: ["recordFeed"],
            properties: { recordFeed: { type: "boolean" } },
            additionalProperties: false,
          },
          { success: true, data: { recordFeed: false } },
        ),
      },
    },

    "/api/control/threshold": {
      post: {
        tags: ["Control"],
        summary: "Set minimum net profit threshold",
        description:
          "Adjusts the minimum net profit percentage an opportunity must exceed to be executed. Lower values detect more opportunities but increase the chance of tiny losses due to fee rounding. Opportunities below this threshold are logged as `rejected_fees`.\n\nEquivalent to `PATCH /api/config` with `{ minNetProfitPct }` but provided as a convenience endpoint.",
        operationId: "controlThreshold",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ThresholdControlBody" } },
          },
        },
        responses: controlBodyResponses(
          "Threshold updated.",
          {
            type: "object",
            required: ["minNetProfitPct"],
            properties: { minNetProfitPct: { type: "number" } },
            additionalProperties: false,
          },
          { success: true, data: { minNetProfitPct: 0.0005 } },
        ),
      },
    },

    "/api/control/max-trade": {
      post: {
        tags: ["Control"],
        summary: "Set maximum trade volume",
        description:
          "Sets the upper bound on BTC volume per simulated trade. The engine also caps volume by available order-book liquidity and wallet inventory — this parameter acts as an additional hard cap.\n\nEquivalent to `PATCH /api/config` with `{ maxTradeBtc }` but provided as a convenience endpoint.",
        operationId: "controlMaxTrade",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/MaxTradeControlBody" } },
          },
        },
        responses: controlBodyResponses(
          "Max trade volume updated.",
          {
            type: "object",
            required: ["maxTradeBtc"],
            properties: { maxTradeBtc: { type: "number" } },
            additionalProperties: false,
          },
          { success: true, data: { maxTradeBtc: 0.05 } },
        ),
      },
    },
  },

  components: {
    schemas,
    responses: {
      BadRequest: badRequestResponse,
      ServerError: serverErrorResponse,
    },
  },
};
