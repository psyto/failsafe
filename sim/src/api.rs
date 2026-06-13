use axum::{
    Json, Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};

use crate::scenarios;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/scenario/run", post(scenario_run))
        .route("/api/events", get(events_ws))
}

async fn health() -> &'static str {
    "ok"
}

#[derive(Debug, Deserialize, Clone, Copy)]
pub struct Dials {
    #[serde(default = "default_volatility")]
    pub volatility: f64,
    #[serde(default = "default_leverage")]
    pub leverage: f64,
    #[serde(default = "default_collateral_ratio")]
    pub collateral_ratio: f64,
}

impl Default for Dials {
    fn default() -> Self {
        Self {
            volatility: default_volatility(),
            leverage: default_leverage(),
            collateral_ratio: default_collateral_ratio(),
        }
    }
}

impl Dials {
    pub fn clamped(self) -> Self {
        Self {
            volatility: self.volatility.clamp(0.01, 0.30),
            leverage: self.leverage.clamp(2.0, 50.0),
            collateral_ratio: self.collateral_ratio.clamp(0.001, 0.10),
        }
    }
}

fn default_volatility() -> f64 {
    0.11
}
fn default_leverage() -> f64 {
    10.0
}
fn default_collateral_ratio() -> f64 {
    0.02
}

#[derive(Debug, Deserialize)]
pub struct RunScenarioReq {
    pub name: String,
    #[serde(default = "default_speed")]
    pub speed: f64,
    #[serde(default)]
    pub dials: Dials,
}

fn default_speed() -> f64 {
    1.0
}

#[derive(Debug, Serialize)]
pub struct RunScenarioResp {
    pub run_id: String,
    pub started: bool,
    pub speed: f64,
}

async fn scenario_run(
    State(state): State<AppState>,
    Json(req): Json<RunScenarioReq>,
) -> Json<RunScenarioResp> {
    let run_id = uuid::Uuid::new_v4().to_string();
    let speed = req.speed.clamp(0.25, 4.0);
    let dials = req.dials.clamped();
    tokio::spawn(scenarios::run(
        state,
        req.name,
        run_id.clone(),
        speed,
        dials,
    ));
    Json(RunScenarioResp {
        run_id,
        started: true,
        speed,
    })
}

async fn events_ws(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut rx = state.tx.subscribe();
    while let Ok(ev) = rx.recv().await {
        let payload = match serde_json::to_string(&ev) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if socket.send(Message::Text(payload)).await.is_err() {
            break;
        }
    }
}
