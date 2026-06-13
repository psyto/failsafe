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

#[derive(Debug, Deserialize)]
pub struct RunScenarioReq {
    pub name: String,
    #[serde(default = "default_speed")]
    pub speed: f64,
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
    tokio::spawn(scenarios::run(state, req.name, run_id.clone(), speed));
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
