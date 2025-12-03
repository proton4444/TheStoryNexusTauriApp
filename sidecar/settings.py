from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=9876)
    backend: Literal["stub", "memori"] = Field(default="stub")
    memori_db_path: str = Field(default="memori.db")
    process_id: str = Field(default="storynexus")

    class Config:
        env_prefix = "MEMORI_SIDECAR_"
