import type { SimEvent } from "./types";

export const treasuryShockScript: SimEvent[] = [
  {
    kind: "OracleUpdate",
    t_ms: 200,
    symbol: "UST10Y",
    prev: 2.0,
    next: 5.0,
    note: "Treasury yield shock +3.00%",
  },
  {
    kind: "System",
    t_ms: 220,
    risk: "Elevated",
    message: "Yield curve dislocation detected.",
  },
  {
    kind: "MarketEvent",
    t_ms: 800,
    title: "Stablecoin liquidity drains",
    detail: "USDC market depth -20% across major venues.",
  },
  {
    kind: "BrokerAlert",
    t_ms: 1500,
    broker: "Prime Broker Alpha",
    severity: "Warn",
    title: "Collateral devalued",
    detail:
      "Tokenized Treasury haircut 5% → 12%. Posted: $1.20B → $1.14B.",
  },
  {
    kind: "BrokerAlert",
    t_ms: 2200,
    broker: "Prime Broker Alpha",
    severity: "Crit",
    title: "Margin call issued",
    detail: "Open exposure $1.2B, LTV breach 90% → 96%.",
  },
  {
    kind: "System",
    t_ms: 2210,
    risk: "High",
    message: "Prime broker stress.",
  },
  {
    kind: "Liquidation",
    t_ms: 2900,
    position_id: "POS-4471",
    broker: "Prime Broker Alpha",
    notional_usd: 89_000_000,
    price: 1824.0,
    method: "Book",
  },
  {
    kind: "Liquidation",
    t_ms: 3200,
    position_id: "POS-4472",
    broker: "Prime Broker Alpha",
    notional_usd: 64_000_000,
    price: 1810.0,
    method: "Book",
  },
  {
    kind: "Liquidation",
    t_ms: 3500,
    position_id: "POS-4473",
    broker: "Prime Broker Beta",
    notional_usd: 41_000_000,
    price: 1791.0,
    method: "Adl",
  },
  {
    kind: "Insurance",
    t_ms: 3900,
    drawn_usd: 42_000_000,
    balance_usd: 108_000_000,
  },
  {
    kind: "System",
    t_ms: 4400,
    risk: "Critical",
    message: "Cascade contained. Insurance fund $108M / $150M.",
  },
];

export type EventExplain = {
  summary: string;
  cause: string;
  impl: { crate: string; symbol: string; path: string };
};

export function explain(ev: SimEvent): EventExplain | null {
  switch (ev.kind) {
    case "OracleUpdate":
      return {
        summary:
          "An off-chain price publisher reported a new observation. The on-chain oracle deduplicated, dropped stale feeds, and re-aggregated the median index.",
        cause:
          "Treasury yield repriced 3pp in minutes. The oracle's deviation filter let the move through because all publishers agreed.",
        impl: {
          crate: "rdk-oracle",
          symbol: "OracleState::ingest + refresh",
          path: "rdk/crates/oracle/src/state.rs",
        },
      };
    case "MarketEvent":
      return {
        summary:
          "Stablecoin AMMs widened spreads as LPs withdrew. Settlement liquidity halves on rapid yield moves.",
        cause:
          "Higher risk-free rate makes stablecoin LPing unattractive. Capital rotates to T-bills.",
        impl: {
          crate: "rdk-clob",
          symbol: "Book::submit (depth thinning)",
          path: "rdk/crates/clob/src/book.rs",
        },
      };
    case "BrokerAlert":
      return {
        summary:
          "Prime broker collateral was re-valued under the new yield curve. LTV crossed maintenance margin.",
        cause:
          "Tokenized Treasury haircuts widen with volatility. The broker's free equity went negative under the new mark.",
        impl: {
          crate: "princeps-portfolio",
          symbol: "compute_free_equity",
          path: "rdk/princeps/crates/portfolio/src/lib.rs",
        },
      };
    case "Liquidation":
      return {
        summary:
          "Liquidation scanner classified the account as Liquidatable and emitted a close order. Book-cross failed for one position, so ADL took over.",
        cause:
          "Maintenance margin breached. Insurance fund eats the residual shortfall.",
        impl: {
          crate: "rdk-liquidation",
          symbol: "LiquidationScanner::scan",
          path: "rdk/crates/liquidation/src/scanner.rs",
        },
      };
    case "Insurance":
      return {
        summary:
          "Underwater closes drew the insurance fund. Remaining balance is the system's only buffer before socialized losses.",
        cause:
          "Loss = (entry − close) × size. When that exceeds posted collateral, the fund absorbs the gap.",
        impl: {
          crate: "rdk-liquidation",
          symbol: "InsuranceFund::withdraw",
          path: "rdk/crates/liquidation/src/insurance.rs",
        },
      };
    case "System":
      return {
        summary:
          "System risk grade is derived from oracle deviation, open-interest concentration, and insurance fund headroom.",
        cause:
          "Each cascade phase escalates risk one tier. Critical is reached when the insurance fund is drawn against.",
        impl: {
          crate: "neon-sim",
          symbol: "scenarios::treasury_shock::run",
          path: "neon/sim/src/scenarios/treasury_shock.rs",
        },
      };
  }
}
