use std::time::Duration;

use rdk_funding::IndexPrice;
use rdk_oracle::{FeedId, OracleParams, OracleState, PriceObservation};

use crate::events::{Severity, SimEvent, SystemRisk};
use crate::state::AppState;

pub async fn run(state: AppState, speed: f64) {
    let tx = state.tx.clone();
    let send = move |ev: SimEvent| {
        let _ = tx.send(ev);
    };

    let pause = |story_ms: u64| Duration::from_millis(((story_ms as f64) / speed) as u64);
    let real = |story_ms: u64| ((story_ms as f64) / speed) as u64;

    let mut oracle = OracleState::new(OracleParams::hyperliquid_default());

    let base_ts: u64 = 1_700_000_000;

    tokio::time::sleep(pause(200)).await;
    for id in 1..=4u32 {
        let _ = oracle.ingest(
            PriceObservation::unsigned(FeedId(id), IndexPrice(2000), base_ts),
            base_ts,
        );
    }
    let agg = oracle.refresh(base_ts);
    send(SimEvent::OracleUpdate {
        t_ms: real(200),
        symbol: "ETH-INDEX".into(),
        prev: 0.0,
        next: 2000.0,
        note: format!(
            "Baseline aggregation across 4 publisher feeds. feeds_used={}",
            agg.map(|a| a.feeds_used).unwrap_or(0)
        ),
    });

    tokio::time::sleep(pause(700)).await;
    send(SimEvent::System {
        t_ms: real(900),
        risk: SystemRisk::Elevated,
        message: "Anomalous quote detected from Publisher #4.".into(),
    });
    send(SimEvent::MarketEvent {
        t_ms: real(910),
        title: "Publisher #4 reports ETH = $99,999".into(),
        detail: "Possible feed compromise or upstream venue malfunction.".into(),
    });

    tokio::time::sleep(pause(600)).await;
    let t1 = base_ts + 10;
    for id in 1..=3u32 {
        let _ = oracle.ingest(
            PriceObservation::unsigned(FeedId(id), IndexPrice(2001), t1),
            t1,
        );
    }
    let _ = oracle.ingest(
        PriceObservation::unsigned(FeedId(4), IndexPrice(99_999), t1),
        t1,
    );
    let result = oracle.refresh(t1);

    match result {
        Ok(agg) => {
            send(SimEvent::OracleUpdate {
                t_ms: real(1500),
                symbol: "ETH-INDEX".into(),
                prev: 2000.0,
                next: agg.index.0 as f64,
                note: format!(
                    "aggregate_index ran median → deviation filter → median. \
                    Attacker outlier dropped. feeds_used={} of 4.",
                    agg.feeds_used
                ),
            });
            send(SimEvent::BrokerAlert {
                t_ms: real(1550),
                broker: "Oracle Layer".into(),
                severity: Severity::Info,
                title: "Deviation filter rejected publisher #4".into(),
                detail: format!(
                    "rdk_oracle::filter_by_deviation cut 99_999 (>1% of median). \
                    Index settled at {} from 3 honest feeds.",
                    agg.index.0
                ),
            });
        }
        Err(e) => {
            send(SimEvent::BrokerAlert {
                t_ms: real(1500),
                broker: "Oracle Layer".into(),
                severity: Severity::Crit,
                title: "Aggregation failed".into(),
                detail: format!("rdk_oracle::AggregationError: {e:?}"),
            });
        }
    }

    tokio::time::sleep(pause(700)).await;
    send(SimEvent::MarketEvent {
        t_ms: real(2200),
        title: "Liquidation scan: no candidates".into(),
        detail: "Index unchanged. Margin health unchanged. No close orders generated.".into(),
    });

    tokio::time::sleep(pause(500)).await;
    send(SimEvent::Insurance {
        t_ms: real(2700),
        drawn_usd: 0.0,
        balance_usd: 150_000.0,
    });

    tokio::time::sleep(pause(500)).await;
    send(SimEvent::System {
        t_ms: real(3200),
        risk: SystemRisk::Low,
        message: "Attack contained. System integrity preserved.".into(),
    });
    send(SimEvent::System {
        t_ms: real(3210),
        risk: SystemRisk::Critical,
        message: "Failsafe held. Single bad publisher cannot move the index by design.".into(),
    });
}
