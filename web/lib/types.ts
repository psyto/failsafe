export type Severity = "Info" | "Warn" | "Crit";
export type LiqMethod = "Book" | "Adl";
export type SystemRisk = "Low" | "Elevated" | "High" | "Critical";

export type SimEvent =
  | {
      kind: "OracleUpdate";
      t_ms: number;
      symbol: string;
      prev: number;
      next: number;
      note: string;
    }
  | {
      kind: "MarketEvent";
      t_ms: number;
      title: string;
      detail: string;
    }
  | {
      kind: "BrokerAlert";
      t_ms: number;
      broker: string;
      severity: Severity;
      title: string;
      detail: string;
    }
  | {
      kind: "Liquidation";
      t_ms: number;
      position_id: string;
      broker: string;
      notional_usd: number;
      price: number;
      method: LiqMethod;
    }
  | {
      kind: "Insurance";
      t_ms: number;
      drawn_usd: number;
      balance_usd: number;
    }
  | {
      kind: "System";
      t_ms: number;
      risk: SystemRisk;
      message: string;
    };

export type EventWithId = SimEvent & { id: number };

export type CityKpis = {
  population: string;
  digitalAssets: string;
  primeBrokers: number;
  dexs: number;
  risk: SystemRisk;
  insuranceFundUsd: number;
};
