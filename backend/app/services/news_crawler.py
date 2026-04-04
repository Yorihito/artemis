"""
Crawls RSS/Atom feeds from NASA and spaceflight news sources,
filters for Artemis / Orion content, and deduplicates non-NASA items
against NASA items to avoid redundant coverage.
"""
import hashlib
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

from app.models.news import NewsItem

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feed definitions
# ---------------------------------------------------------------------------
FEEDS: list[dict] = [
    # NASA — highest priority; processed first for deduplication
    {
        "source": "NASA",
        "is_nasa": True,
        "url": "https://www.nasa.gov/feed/",
    },
    {
        "source": "NASA",
        "is_nasa": True,
        "url": "https://blogs.nasa.gov/artemis/feed/",
    },
    # Third-party — processed after NASA; duplicates removed
    {
        "source": "SpaceflightNow",
        "is_nasa": False,
        "url": "https://spaceflightnow.com/feed/",
    },
    {
        "source": "SpaceNews",
        "is_nasa": False,
        "url": "https://spacenews.com/feed/",
    },
    {
        "source": "NASASpaceflight",
        "is_nasa": False,
        "url": "https://www.nasaspaceflight.com/feed/",
    },
    {
        "source": "Space.com",
        "is_nasa": False,
        "url": "https://www.space.com/feeds/all",
    },
]

# An article is included only if its title or description contains one of these
KEYWORDS = re.compile(r"\bartemis\b|\borion\b", re.IGNORECASE)

# Non-NASA article is considered a duplicate of a NASA article when Jaccard
# similarity of lowercase word sets is at or above this threshold.
DEDUP_THRESHOLD = 0.45

FETCH_TIMEOUT = 15.0       # seconds per feed
MAX_FEED_BYTES = 2_000_000  # 2 MB safety limit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _item_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _parse_date(text: Optional[str]) -> datetime:
    """Parse RFC-2822 (RSS) or ISO-8601 (Atom) date strings."""
    if not text:
        return datetime.now(timezone.utc)
    text = text.strip()
    try:
        return parsedate_to_datetime(text).astimezone(timezone.utc)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(text.rstrip("Z")).replace(tzinfo=timezone.utc)
    except Exception:
        pass
    return datetime.now(timezone.utc)


def _word_set(title: str) -> set[str]:
    return set(re.findall(r"[a-z]+", title.lower()))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _is_relevant(title: str, description: str) -> bool:
    return bool(KEYWORDS.search(title) or KEYWORDS.search(description))


# ---------------------------------------------------------------------------
# XML parsing (RSS 2.0 and Atom)
# ---------------------------------------------------------------------------

_ATOM_NS = "http://www.w3.org/2005/Atom"


def _parse_feed_xml(xml_text: str, source: str, is_nasa: bool) -> list[NewsItem]:
    items: list[NewsItem] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning(f"XML parse error for {source}: {e}")
        return items

    # Atom feed
    if root.tag == f"{{{_ATOM_NS}}}feed" or root.tag == "feed":
        ns = {"a": _ATOM_NS} if root.tag.startswith("{") else {}
        tag = lambda t: f"{{a}}{t}" if not ns else f"{{{_ATOM_NS}}}{t}"  # noqa: E731
        for entry in root.findall(f"{{{_ATOM_NS}}}entry" if root.tag.startswith("{") else "entry"):
            title_el   = entry.find(f"{{{_ATOM_NS}}}title" if root.tag.startswith("{") else "title")
            link_el    = entry.find(f"{{{_ATOM_NS}}}link"  if root.tag.startswith("{") else "link")
            pub_el     = entry.find(f"{{{_ATOM_NS}}}published" if root.tag.startswith("{") else "published") \
                      or entry.find(f"{{{_ATOM_NS}}}updated"   if root.tag.startswith("{") else "updated")
            summary_el = entry.find(f"{{{_ATOM_NS}}}summary" if root.tag.startswith("{") else "summary")

            title = (title_el.text or "").strip() if title_el is not None else ""
            url = ""
            if link_el is not None:
                url = link_el.get("href", "") or link_el.text or ""
            summary = (summary_el.text or "") if summary_el is not None else ""
            pub = _parse_date(pub_el.text if pub_el is not None else None)

            if title and url and _is_relevant(title, summary):
                items.append(NewsItem(
                    id=_item_id(url),
                    title=title,
                    url=url,
                    published=pub,
                    source=source,
                    is_nasa=is_nasa,
                ))
        return items

    # RSS 2.0
    channel = root.find("channel")
    if channel is None:
        return items
    for item in channel.findall("item"):
        title_el   = item.find("title")
        link_el    = item.find("link")
        pub_el     = item.find("pubDate")
        desc_el    = item.find("description")

        title = (title_el.text or "").strip() if title_el is not None else ""
        url   = (link_el.text   or "").strip() if link_el  is not None else ""
        pub   = _parse_date(pub_el.text if pub_el is not None else None)
        desc  = (desc_el.text or "")           if desc_el  is not None else ""

        if title and url and _is_relevant(title, desc):
            items.append(NewsItem(
                id=_item_id(url),
                title=title,
                url=url,
                published=pub,
                source=source,
                is_nasa=is_nasa,
            ))
    return items


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

async def _fetch_feed(client: httpx.AsyncClient, feed: dict) -> list[NewsItem]:
    url    = feed["url"]
    source = feed["source"]
    try:
        resp = await client.get(url, timeout=FETCH_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        # Enforce size limit
        content = resp.content[:MAX_FEED_BYTES].decode("utf-8", errors="replace")
        items = _parse_feed_xml(content, source, feed["is_nasa"])
        logger.info(f"Feed {source} ({url}): {len(items)} relevant items")
        return items
    except Exception as e:
        logger.warning(f"Failed to fetch feed {source} ({url}): {e}")
        return []


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _deduplicate(nasa_items: list[NewsItem], other_items: list[NewsItem]) -> list[NewsItem]:
    """Return non-NASA items whose title doesn't closely mirror a NASA title."""
    nasa_word_sets = [_word_set(i.title) for i in nasa_items]
    filtered: list[NewsItem] = []
    for item in other_items:
        ws = _word_set(item.title)
        if all(_jaccard(ws, nws) < DEDUP_THRESHOLD for nws in nasa_word_sets):
            filtered.append(item)
    return filtered


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def crawl() -> list[NewsItem]:
    """
    Fetch all feeds, filter for Artemis/Orion keywords, deduplicate, and
    return items sorted newest-first (NASA items take precedence in ordering).
    """
    async with httpx.AsyncClient(headers={"User-Agent": "ArtemisTracker/1.0"}) as client:
        nasa_items: list[NewsItem]  = []
        other_items: list[NewsItem] = []

        for feed in FEEDS:
            items = await _fetch_feed(client, feed)
            if feed["is_nasa"]:
                nasa_items.extend(items)
            else:
                other_items.extend(items)

    # Remove non-NASA items that duplicate NASA coverage
    other_filtered = _deduplicate(nasa_items, other_items)

    # Merge, deduplicate by URL id, sort newest first
    seen: set[str] = set()
    merged: list[NewsItem] = []
    for item in nasa_items + other_filtered:
        if item.id not in seen:
            seen.add(item.id)
            merged.append(item)

    merged.sort(key=lambda x: x.published, reverse=True)
    logger.info(f"Crawl complete: {len(merged)} unique items "
                f"({len(nasa_items)} NASA, {len(other_filtered)} third-party)")
    return merged
