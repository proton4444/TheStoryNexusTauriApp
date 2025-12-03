from __future__ import annotations

import os
from typing import Optional

import httpx


class LlmConfig:
    def __init__(
        self,
        provider: str,
        model: str,
        openai_api_key: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        local_api_url: str = "http://127.0.0.1:1234/v1",
    ):
        self.provider = provider
        self.model = model
        self.openai_api_key = openai_api_key
        self.openrouter_api_key = openrouter_api_key
        self.local_api_url = local_api_url


class CompletionClient:
    def __init__(self, config: LlmConfig):
        self.config = config

    async def complete(self, prompt: str) -> str:
        provider = self.config.provider
        if provider == "stub":
            return f"[stub-llm] {prompt}"
        if provider == "local":
            return await self._complete_local(prompt)
        if provider == "openai":
            return await self._complete_openai(prompt)
        if provider == "openrouter":
            return await self._complete_openrouter(prompt)
        raise ValueError(f"Unsupported provider: {provider}")

    async def _complete_local(self, prompt: str) -> str:
        url = f"{self.config.local_api_url}/chat/completions"
        payload = {
            "model": self.config.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 512,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _complete_openai(self, prompt: str) -> str:
        import openai

        api_key = self.config.openai_api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key missing")

        client = openai.AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model=self.config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
        )
        return resp.choices[0].message.content or ""

    async def _complete_openrouter(self, prompt: str) -> str:
        import openai

        api_key = self.config.openrouter_api_key or os.environ.get(
            "OPENROUTER_API_KEY"
        )
        if not api_key:
            raise ValueError("OpenRouter API key missing")

        client = openai.AsyncOpenAI(
            api_key=api_key, base_url="https://openrouter.ai/api/v1"
        )
        resp = await client.chat.completions.create(
            model=self.config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
        )
        return resp.choices[0].message.content or ""
