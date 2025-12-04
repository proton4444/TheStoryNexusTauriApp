#[cfg(test)]
mod tests {
    use super::memory_commands::{CompletionRequest, SidecarState};
    use super::*;

    #[tokio::test]
    async fn start_stop_sidecar_is_idempotent() {
        let state = SidecarState::default();
        // Starting without a real python binary should not panic; we expect an error.
        let result = state.start("python-bogus", std::env::current_dir().unwrap(), "127.0.0.1", 9876);
        assert!(result.is_err());
        // Stop should be a no-op even if not started.
        assert!(state.stop().is_ok());
    }

    #[tokio::test]
    async fn completion_request_serializes() {
        let req = CompletionRequest {
            prompt: "hello".into(),
            story_id: "story-1".into(),
            session_id: None,
            inject_limit: Some(1),
            model: None,
            max_tokens: Some(16),
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("story-1"));
        assert!(json.contains("inject_limit"));
    }
}
