import asyncio
import httpx
from ats.data.queue import raw_queue
from ats.config import settings

POLL_INTERVAL = 60  # seconds

_seen_urls: set[str] = set()


def _domain_source(url: str) -> str:
    for domain, label in [
        ("reuters", "reuters"),
        ("bloomberg", "bloomberg"),
        ("coindesk", "coindesk"),
        ("cointelegraph", "cointelegraph"),
    ]:
        if domain in url:
            return label
    return "unknown"


async def news_poller_worker() -> None:
    async with httpx.AsyncClient() as client:
        while True:
            for ticker in settings.crypto_tickers:
                symbol = ticker.replace("USDT", "")
                try:
                    resp = await client.get(
                        "https://newsapi.org/v2/everything",
                        params={
                            "q": symbol,
                            "sortBy": "publishedAt",
                            "pageSize": 10,
                            "apiKey": settings.news_api_key,
                        },
                        timeout=10,
                    )
                    articles = resp.json().get("articles", [])
                    for article in articles:
                        url = article.get("url", "")
                        if url in _seen_urls:
                            continue
                        _seen_urls.add(url)
                        await raw_queue.put({
                            "source": _domain_source(url),
                            "type": "news",
                            "ticker": symbol,
                            "payload": {
                                "title": article.get("title", ""),
                                "description": article.get("description", ""),
                                "url": url,
                                "published_at": article.get("publishedAt"),
                            },
                        })
                except Exception:
                    pass
            await asyncio.sleep(POLL_INTERVAL)
