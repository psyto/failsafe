import type { SimEvent } from "./types";

export type ScenarioId = "treasury_shock" | "stablecoin_depeg" | "oracle_attack";

export const SCENARIOS: {
  id: ScenarioId;
  label: string;
  canon: string;
  verb: string;
  tagline: string;
}[] = [
  {
    id: "treasury_shock",
    label: "Treasury Shock",
    canon: "The Yield Spike of 2042-Q3",
    verb: "Replay",
    tagline: "Tokyo Fed surprise +3pp hike. Tachi Capital and Black Ice take hits.",
  },
  {
    id: "stablecoin_depeg",
    label: "Stablecoin Depeg",
    canon: "The USDC Reserve Audit Crisis of 2042-Q4",
    verb: "Replay",
    tagline: "Stablecoin trust event. Kintetsu and Atlas margined positions blow up.",
  },
  {
    id: "oracle_attack",
    label: "Oracle Attack",
    canon: "The Publisher #4 Incident of 2042-Q1",
    verb: "Replay",
    tagline: "One Photon feed reports $99,999. Watch the deviation filter hold.",
  },
];

export function getScript(id: ScenarioId): SimEvent[] {
  switch (id) {
    case "treasury_shock":
      return treasuryShockScript;
    case "stablecoin_depeg":
      return stablecoinDepegScript;
    case "oracle_attack":
      return oracleAttackScript;
  }
}

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
    broker: "Tachi Capital",
    severity: "Warn",
    title: "Collateral devalued",
    detail:
      "Tokenized Treasury haircut 5% → 12%. Posted: $1.20B → $1.14B.",
  },
  {
    kind: "BrokerAlert",
    t_ms: 2200,
    broker: "Tachi Capital",
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
    broker: "Tachi Capital",
    notional_usd: 89_000_000,
    price: 1824.0,
    method: "Book",
  },
  {
    kind: "Liquidation",
    t_ms: 3200,
    position_id: "POS-4472",
    broker: "Black Ice Markets",
    notional_usd: 64_000_000,
    price: 1810.0,
    method: "Book",
  },
  {
    kind: "Liquidation",
    t_ms: 3500,
    position_id: "POS-4473",
    broker: "Tachi Capital",
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

export const stablecoinDepegScript: SimEvent[] = [
  {
    kind: "OracleUpdate",
    t_ms: 200,
    symbol: "USDC",
    prev: 0.0,
    next: 1.0,
    note: "Initial USDC peg sampled across 3 feeds.",
  },
  {
    kind: "MarketEvent",
    t_ms: 600,
    title: "Off-chain stablecoin reserves audit flagged",
    detail: "USDC issuer reserves shortfall rumored. Redemption spreads widen.",
  },
  {
    kind: "System",
    t_ms: 610,
    risk: "Elevated",
    message: "Stablecoin trust event in progress.",
  },
  {
    kind: "OracleUpdate",
    t_ms: 1200,
    symbol: "USDC",
    prev: 1.0,
    next: 0.98,
    note: "USDC drops 2%. AMM-skewed price feeds disagree.",
  },
  {
    kind: "MarketEvent",
    t_ms: 1300,
    title: "Vault NAV $784,000 (share px 9,800 bps)",
    detail: "VaultState::mark_to_market applied; share value tracks USDC-denominated assets.",
  },
  {
    kind: "OracleUpdate",
    t_ms: 2000,
    symbol: "USDC",
    prev: 0.98,
    next: 0.94,
    note: "USDC -6% from peg. Stablecoin liquidity rotates to USDT / DAI.",
  },
  {
    kind: "MarketEvent",
    t_ms: 2050,
    title: "Vault impaired: share px 9,400 bps",
    detail: "Depositors mark-to-market the depeg in real time.",
  },
  {
    kind: "System",
    t_ms: 2070,
    risk: "High",
    message: "Stablecoin-collateralized leverage at risk.",
  },
  {
    kind: "BrokerAlert",
    t_ms: 2550,
    broker: "Kintetsu Synth",
    severity: "Warn",
    title: "3 stablecoin-margined position(s) at risk",
    detail: "Collateral haircut applied as USDC mark drops.",
  },
  {
    kind: "Liquidation",
    t_ms: 3200,
    position_id: "POS-5101",
    broker: "Kintetsu Synth",
    notional_usd: 1_032_000,
    price: 1720,
    method: "Adl",
  },
  {
    kind: "Liquidation",
    t_ms: 3450,
    position_id: "POS-5102",
    broker: "Kintetsu Synth",
    notional_usd: 1_548_000,
    price: 1720,
    method: "Adl",
  },
  {
    kind: "Liquidation",
    t_ms: 3700,
    position_id: "POS-5103",
    broker: "Atlas Vector",
    notional_usd: 688_000,
    price: 1720,
    method: "Adl",
  },
  {
    kind: "Insurance",
    t_ms: 4050,
    drawn_usd: 58_000,
    balance_usd: 92_000,
  },
  {
    kind: "System",
    t_ms: 4550,
    risk: "Critical",
    message: "Cascade contained. Vault share px 9,400 bps, fund $92,000.",
  },
];

export const oracleAttackScript: SimEvent[] = [
  {
    kind: "OracleUpdate",
    t_ms: 200,
    symbol: "ETH-INDEX",
    prev: 0.0,
    next: 2000.0,
    note: "Baseline aggregation across 4 publisher feeds. feeds_used=4",
  },
  {
    kind: "System",
    t_ms: 900,
    risk: "Elevated",
    message: "Anomalous quote detected from Publisher #4.",
  },
  {
    kind: "MarketEvent",
    t_ms: 910,
    title: "Publisher #4 reports ETH = $99,999",
    detail: "Possible feed compromise or upstream venue malfunction.",
  },
  {
    kind: "OracleUpdate",
    t_ms: 1500,
    symbol: "ETH-INDEX",
    prev: 2000.0,
    next: 2001.0,
    note: "aggregate_index ran median → deviation filter → median. Attacker outlier dropped. feeds_used=3 of 4.",
  },
  {
    kind: "BrokerAlert",
    t_ms: 1550,
    broker: "Photon Network",
    severity: "Info",
    title: "Deviation filter rejected publisher #4",
    detail: "rdk_oracle::filter_by_deviation cut 99,999 (>1% of median). Index settled at 2001 from 3 honest feeds.",
  },
  {
    kind: "MarketEvent",
    t_ms: 2200,
    title: "Liquidation scan: no candidates",
    detail: "Index unchanged. Margin health unchanged. No close orders generated.",
  },
  {
    kind: "Insurance",
    t_ms: 2700,
    drawn_usd: 0,
    balance_usd: 150_000,
  },
  {
    kind: "System",
    t_ms: 3200,
    risk: "Low",
    message: "Attack contained. System integrity preserved.",
  },
  {
    kind: "System",
    t_ms: 3210,
    risk: "Critical",
    message: "Failsafe held. Single bad publisher cannot move the index by design.",
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
          crate: "failsafe-sim",
          symbol: "scenarios::treasury_shock::run",
          path: "failsafe/sim/src/scenarios/treasury_shock.rs",
        },
      };
  }
}
