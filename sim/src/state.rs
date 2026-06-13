use tokio::sync::broadcast;

use crate::events::SimEvent;

#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<SimEvent>,
}

impl AppState {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel::<SimEvent>(1024);
        Self { tx }
    }
}
