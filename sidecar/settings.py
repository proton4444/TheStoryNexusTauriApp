from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_prefix="MEMORI_SIDECAR_")

    host: str = Field(default="127.0.0.1")
    port: int = Field(default=9876)
    backend: Literal["stub", "memori"] = Field(default="stub")
    memori_db_path: str = Field(default="memori.db")
    process_id: str = Field(default="storynexus")

    # LLM configuration for completion endpoint (placeholder until LLM wiring)
    llm_provider: Literal["openai", "openrouter", "local", "stub"] = Field(
        default="stub"
    )
    llm_model: str = Field(default="gpt-4o-mini")
    openai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    local_api_url: str = Field(default="http://127.0.0.1:1234/v1")
    stub_embeddings: bool = Field(default=False)
