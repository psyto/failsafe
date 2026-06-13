use std::time::Duration;

use rdk_clob::AccountId;
use rdk_funding::{IndexPrice, MarkPrice, Notional, PositionSize};
use rdk_liquidation::{
    AccountSnapshot, InsuranceFund, LiquidationParams, LiquidationScanner, MarginHealth,
    margin_health,
};
use rdk_oracle::{FeedId, OracleParams, OracleState, PriceObservation};
use rdk_vault::{VaultParams, VaultState};

fn share_bps(vault: &VaultState) -> i64 {
    vault.share_price_bps().unwrap_or(10_000)
}

use crate::events::{LiqMethod, Severity, SimEvent, SystemRisk};
use crate::state::AppState;

pub async fn run(state: AppState, speed: f64) {
    let tx = state.tx.clone();
    let send = move |ev: SimEvent| {
        let _ = tx.send(ev);
    };

    let pause = |story_ms: u64| Duration::from_millis(((story_ms as f64) / speed) as u64);
    let real = |story_ms: u64| ((story_ms as f64) / speed) as u64;

    let mut oracle = OracleState::new(OracleParams::hyperliquid_default());
    let liq_params = LiquidationParams::hyperliquid_default();
    let mut scanner = LiquidationScanner::new(liq_params, InsuranceFund::new(150_000));

    let mut vault = VaultState::new(VaultParams { min_deposit: 1_000 });
    let _ = vault.deposit(800_000);

    let accounts = vec![
        AccountSnapshot {
            account: AccountId(5101),
            position_size: PositionSize(600),
            avg_entry: MarkPrice(2000),
            collateral: Notional(140_000),
        },
        AccountSnapshot {
            account: AccountId(5102),
            position_size: PositionSize(900),
            avg_entry: MarkPrice(2000),
            collateral: Notional(190_000),
        },
        AccountSnapshot {
            account: AccountId(5103),
            position_size: PositionSize(400),
            avg_entry: MarkPrice(2010),
            collateral: Notional(72_000),
        },
    ];

    let base_ts: u64 = 1_700_000_000;

    tokio::time::sleep(pause(200)).await;
    ingest_usdc(&mut oracle, 10_000, base_ts);
    send(SimEvent::OracleUpdate {
        t_ms: real(200),
        symbol: "USDC".into(),
        prev: 0.0,
        next: 1.0000,
        note: "Initial USDC peg sampled across 3 feeds.".into(),
    });

    tokio::time::sleep(pause(400)).await;
    send(SimEvent::MarketEvent {
        t_ms: real(600),
        title: "Off-chain stablecoin reserves audit flagged".into(),
        detail: "USDC issuer reserves shortfall rumored. Redemption spreads widen.".into(),
    });
    send(SimEvent::System {
        t_ms: real(610),
        risk: SystemRisk::Elevated,
        message: "Stablecoin trust event in progress.".into(),
    });

    tokio::time::sleep(pause(600)).await;
    ingest_usdc(&mut oracle, 9_800, base_ts + 5);
    send(SimEvent::OracleUpdate {
        t_ms: real(1200),
        symbol: "USDC".into(),
        prev: 1.0000,
        next: 0.9800,
        note: "USDC drops 2%. AMM-skewed price feeds disagree.".into(),
    });
    vault.mark_to_market(784_000);
    send(SimEvent::MarketEvent {
        t_ms: real(1300),
        title: format!(
            "Vault NAV ${} (share px {} bps)",
            vault.total_assets().0,
            share_bps(&vault)
        ),
        detail: "VaultState::mark_to_market applied; share value tracks USDC-denominated assets."
            .into(),
    });

    tokio::time::sleep(pause(700)).await;
    ingest_usdc(&mut oracle, 9_400, base_ts + 10);
    send(SimEvent::OracleUpdate {
        t_ms: real(2000),
        symbol: "USDC".into(),
        prev: 0.9800,
        next: 0.9400,
        note: "USDC -6% from peg. Stablecoin liquidity rotates to USDT / DAI.".into(),
    });
    vault.mark_to_market(752_000);
    send(SimEvent::MarketEvent {
        t_ms: real(2050),
        title: format!("Vault impaired: share px {} bps", share_bps(&vault)),
        detail: "Depositors mark-to-market the depeg in real time.".into(),
    });
    send(SimEvent::System {
        t_ms: real(2070),
        risk: SystemRisk::High,
        message: "Stablecoin-collateralized leverage at risk.".into(),
    });

    tokio::time::sleep(pause(500)).await;
    let mark_post = MarkPrice(1880);
    let at_risk = accounts
        .iter()
        .filter(|a| matches!(margin_health(a, mark_post, &liq_params), MarginHealth::AtRisk))
        .count();
    if at_risk > 0 {
        send(SimEvent::BrokerAlert {
            t_ms: real(2550),
            broker: "Prime Broker Alpha".into(),
            severity: Severity::Warn,
            title: format!("{at_risk} stablecoin-margined position(s) at risk"),
            detail: "Collateral haircut applied as USDC mark drops.".into(),
        });
    }

    tokio::time::sleep(pause(700)).await;
    let mark_liq = MarkPrice(1720);
    let report = scanner.scan(&accounts, mark_liq);
    let mut story_t = 3200u64;
    for record in &report.records {
        let snap = accounts
            .iter()
            .find(|a| a.account == record.account)
            .copied()
            .unwrap_or(accounts[0]);
        let notional = rdk_liquidation::notional_value(&snap, mark_liq);
        let method = match record.classification {
            MarginHealth::Underwater => LiqMethod::Adl,
            _ => LiqMethod::Book,
        };
        send(SimEvent::Liquidation {
            t_ms: real(story_t),
            position_id: format!("POS-{}", record.account.0),
            broker: "Prime Broker Alpha".into(),
            notional_usd: notional as f64,
            price: mark_liq.0 as f64,
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
            "Cascade contained. Vault share px {} bps, fund ${}.",
            share_bps(&vault),
            scanner.fund_balance()
        ),
    });
}

fn ingest_usdc(oracle: &mut OracleState, price_x10000: u64, now: u64) {
    for feed_id in 1..=3u32 {
        let obs = PriceObservation::unsigned(FeedId(feed_id), IndexPrice(price_x10000), now);
        let _ = oracle.ingest(obs, now);
    }
    let _ = oracle.refresh(now);
}
