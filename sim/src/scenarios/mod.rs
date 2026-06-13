mod oracle_attack;
mod stablecoin_depeg;
mod treasury_shock;

use crate::api::Dials;
use crate::state::AppState;

pub async fn run(state: AppState, name: String, _run_id: String, speed: f64, dials: Dials) {
    match name.as_str() {
        "treasury_shock" => treasury_shock::run(state, speed, dials).await,
        "stablecoin_depeg" => stablecoin_depeg::run(state, speed, dials).await,
        "oracle_attack" => oracle_attack::run(state, speed).await,
        other => tracing::warn!("unknown scenario: {other}"),
    }
}
