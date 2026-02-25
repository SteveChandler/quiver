"""Attribution HTML builder for image credits.

Ports the `buildAttributionHtml` function from `scripts/fetch-beach-photos.ts`.
"""

from __future__ import annotations

import html


def build_attribution_html(
    source: str,
    creator_name: str | None = None,
    creator_url: str | None = None,
    license_code: str | None = None,
    license_url: str | None = None,
    title: str | None = None,
) -> str:
    """Build attribution HTML matching the existing TypeScript implementation.

    All user-supplied values are HTML-escaped to prevent stored XSS.

    Output format: '{label} by {by}{license_text} via {source}'

    Examples
    --------
    >>> build_attribution_html("Flickr", creator_name="JohnDoe",
    ...     creator_url="https://flickr.com/people/jd",
    ...     license_code="CC-BY 2.0",
    ...     license_url="https://creativecommons.org/licenses/by/2.0/",
    ...     title="Sunset at Blacks")
    '"Sunset at Blacks" by <a href="https://flickr.com/people/jd" rel="noopener nofollow">JohnDoe</a> \
· <a href="https://creativecommons.org/licenses/by/2.0/" rel="noopener nofollow">CC-BY 2.0</a> via Flickr'
    """
    # by: link if both name+url, plain text if just name, "Unknown" if neither
    if creator_name and creator_url:
        safe_name = html.escape(creator_name)
        safe_url = html.escape(creator_url)
        by = f'<a href="{safe_url}" rel="noopener nofollow">{safe_name}</a>'
    elif creator_name:
        by = html.escape(creator_name)
    else:
        by = "Unknown"

    # license: linked if both code+url, otherwise empty
    if license_code and license_url:
        safe_lcode = html.escape(license_code)
        safe_lurl = html.escape(license_url)
        license_text = (
            f' · <a href="{safe_lurl}" rel="noopener nofollow">{safe_lcode}</a>'
        )
    else:
        license_text = ""

    # label: quoted title or "Image"
    label = f'&quot;{html.escape(title)}&quot;' if title else "Image"

    return f"{label} by {by}{license_text} via {html.escape(source)}"
