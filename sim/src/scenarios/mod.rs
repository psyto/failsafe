mod treasury_shock;

use crate::state::AppState;

pub async fn run(state: AppState, name: String, _run_id: String) {
    match name.as_str() {
        "treasury_shock" => treasury_shock::run(state).await,
        other => tracing::warn!("unknown scenario: {other}"),
    }
}
