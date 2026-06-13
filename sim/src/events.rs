use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum SimEvent {
    OracleUpdate {
        t_ms: u64,
        symbol: String,
        prev: f64,
        next: f64,
        note: String,
    },
    MarketEvent {
        t_ms: u64,
        title: String,
        detail: String,
    },
    BrokerAlert {
        t_ms: u64,
        broker: String,
        severity: Severity,
        title: String,
        detail: String,
    },
    Liquidation {
        t_ms: u64,
        position_id: String,
        broker: String,
        notional_usd: f64,
        price: f64,
        method: LiqMethod,
    },
    Insurance {
        t_ms: u64,
        drawn_usd: f64,
        balance_usd: f64,
    },
    System {
        t_ms: u64,
        risk: SystemRisk,
        message: String,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warn,
    Crit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LiqMethod {
    Book,
    Adl,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SystemRisk {
    Low,
    Elevated,
    High,
    Critical,
}
