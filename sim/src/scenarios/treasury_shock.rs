use std::time::Duration;

use rdk_clob::AccountId;
use rdk_funding::{IndexPrice, MarkPrice, Notional, PositionSize};
use rdk_liquidation::{
    AccountSnapshot, InsuranceFund, LiquidationParams, LiquidationScanner, MarginHealth,
    margin_health, notional_value,
};
use rdk_oracle::{FeedId, OracleParams, OracleState, PriceObservation};

use crate::api::Dials;
use crate::events::{LiqMethod, Severity, SimEvent, SystemRisk};
use crate::state::AppState;

pub async fn run(state: AppState, speed: f64, dials: Dials) {
    let tx = state.tx.clone();
    let send = move |ev: SimEvent| {
        let _ = tx.send(ev);
    };

    let pause = |story_ms: u64| Duration::from_millis(((story_ms as f64) / speed) as u64);
    let real = |story_ms: u64| ((story_ms as f64) / speed) as u64;

    let mut oracle = OracleState::new(OracleParams::hyperliquid_default());
    let liq_params = LiquidationParams {
        initial_margin_bps: ((10_000.0 / dials.leverage) as u32).max(50),
        maintenance_margin_bps: ((dials.collateral_ratio * 10_000.0) as u32).max(10),
        liquidation_fee_bps: 150,
    };
    let mut scanner = LiquidationScanner::new(liq_params, InsuranceFund::new(150_000));

    let baseline_drop = 0.11_f64;
    let vol_mult = dials.volatility / baseline_drop;
    let stage1_drop = 0.05 * vol_mult;
    let stage2_drop = baseline_drop * vol_mult;
    let initial_price = 2000_f64;
    let mark1_price = (initial_price * (1.0 - stage1_drop)) as u64;
    let mark2_price = (initial_price * (1.0 - stage2_drop)) as u64;

    let leverage_collateral = |size: i64, entry: u64| -> i64 {
        let notional = (size.unsigned_abs() as f64) * (entry as f64);
        (notional / dials.leverage) as i64
    };

    let accounts = vec![
        AccountSnapshot {
            account: AccountId(4471),
            position_size: PositionSize(1000),
            avg_entry: MarkPrice(2000),
            collateral: Notional(leverage_collateral(1000, 2000)),
        },
        AccountSnapshot {
            account: AccountId(4472),
            position_size: PositionSize(800),
            avg_entry: MarkPrice(1950),
            collateral: Notional(leverage_collateral(800, 1950) * 95 / 100),
        },
        AccountSnapshot {
            account: AccountId(4473),
            position_size: PositionSize(500),
            avg_entry: MarkPrice(1980),
            collateral: Notional(leverage_collateral(500, 1980) * 90 / 100),
        },
    ];

    let base_ts: u64 = 1_700_000_000;

    tokio::time::sleep(pause(200)).await;
    ingest_all(&mut oracle, 2000, base_ts);
    send(SimEvent::OracleUpdate {
        t_ms: real(200),
        symbol: "ETH-INDEX".into(),
        prev: 0.0,
        next: 2000.0,
        note: "Initial aggregation across 3 publisher feeds.".into(),
    });

    tokio::time::sleep(pause(200)).await;
    send(SimEvent::MarketEvent {
        t_ms: real(400),
        title: "Treasury yield repricing".into(),
        detail: "UST10Y 2.00% → 5.00%. Risk-asset discount rates climb.".into(),
    });
    send(SimEvent::System {
        t_ms: real(410),
        risk: SystemRisk::Elevated,
        message: "Yield curve dislocation detected.".into(),
    });

    tokio::time::sleep(pause(600)).await;
    let t1 = base_ts + 10;
    ingest_all(&mut oracle, mark1_price, t1);
    send(SimEvent::OracleUpdate {
        t_ms: real(1000),
        symbol: "ETH-INDEX".into(),
        prev: 2000.0,
        next: mark1_price as f64,
        note: format!("Risk-off flow drags ETH spot -{:.1}%.", stage1_drop * 100.0),
    });

    tokio::time::sleep(pause(500)).await;
    let mark1 = MarkPrice(mark1_price);
    let at_risk = accounts
        .iter()
        .filter(|a| matches!(margin_health(a, mark1, &liq_params), MarginHealth::AtRisk))
        .count();
    if at_risk > 0 {
        send(SimEvent::BrokerAlert {
            t_ms: real(1500),
            broker: "Prime Broker Alpha".into(),
            severity: Severity::Warn,
            title: format!("{at_risk} position(s) at risk"),
            detail: "Margin ratio sits between maintenance and initial. No close yet.".into(),
        });
    }

    tokio::time::sleep(pause(700)).await;
    send(SimEvent::MarketEvent {
        t_ms: real(2200),
        title: "Stablecoin liquidity drains".into(),
        detail: "USDC market depth -20% across major venues.".into(),
    });

    tokio::time::sleep(pause(400)).await;
    let t2 = base_ts + 20;
    ingest_all(&mut oracle, mark2_price, t2);
    send(SimEvent::OracleUpdate {
        t_ms: real(2600),
        symbol: "ETH-INDEX".into(),
        prev: mark1_price as f64,
        next: mark2_price as f64,
        note: format!(
            "Cascade trigger: ETH -{:.1}% from open. Median across all feeds clears deviation filter.",
            stage2_drop * 100.0
        ),
    });
    send(SimEvent::System {
        t_ms: real(2610),
        risk: SystemRisk::High,
        message: "Prime broker stress.".into(),
    });

    tokio::time::sleep(pause(400)).await;
    let mark2 = MarkPrice(mark2_price);
    let report = scanner.scan(&accounts, mark2);

    let mut story_t = 3000u64;
    for record in &report.records {
        let snap = accounts
            .iter()
            .find(|a| a.account == record.account)
            .copied()
            .unwrap_or(accounts[0]);
        let notional = notional_value(&snap, mark2);
        let method = match record.classification {
            MarginHealth::Underwater => LiqMethod::Adl,
            _ => LiqMethod::Book,
        };
        send(SimEvent::Liquidation {
            t_ms: real(story_t),
            position_id: format!("POS-{}", record.account.0),
            broker: broker_for(record.account),
            notional_usd: notional as f64,
            price: mark2.0 as f64,
            method,
        });
        story_t += 250;
    }

    tokio::time::sleep(pause(300)).await;
    let net_drawn = (report.fund_withdrawals - report.fund_deposits).max(0);
    send(SimEvent::Insurance {
        t_ms: real(story_t + 100),
        drawn_usd: net_drawn as f64,
        balance_usd: scanner.fund_balance() as f64,
    });

    tokio::time::sleep(pause(500)).await;
    send(SimEvent::System {
        t_ms: real(story_t + 600),
        risk: SystemRisk::Critical,
        message: format!(
            "Cascade contained. Insurance fund balance ${}.",
            scanner.fund_balance()
        ),
    });
}

fn ingest_all(oracle: &mut OracleState, price: u64, now: u64) {
    for feed_id in 1..=3u32 {
        let obs = PriceObservation::unsigned(FeedId(feed_id), IndexPrice(price), now);
        let _ = oracle.ingest(obs, now);
    }
    let _ = oracle.refresh(now);
}

fn broker_for(account: AccountId) -> String {
    match account.0 % 2 {
        0 => "Prime Broker Beta".into(),
        _ => "Prime Broker Alpha".into(),
    }
}
