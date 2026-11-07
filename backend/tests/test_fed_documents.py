from datetime import date

from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.fed_policy import FedDocument
from app.services.fed_documents import (
    extract_article_text,
    minutes_url,
    parse_release_dates,
    statement_url,
)

PAGE = """<html><head><script>var x = 1;</script></head><body>
<div id="nav">menu text that must be ignored</div>
<div id="article" class="col-xs-12 col-sm-8">
<h3>Minutes of the Federal Open Market Committee</h3>
<p>The Committee voted to <strong>raise</strong> the range.&nbsp;Return to text</p>
<p>Second paragraph.</p><script>track()</script>
<div>Share</div>
<p>Back to Top</p>
<p class="lastUpdate">Last Update: November 03, 2026</p>
<p>footer junk</p></div></body></html>"""


def test_extract_article_text_keeps_article_only():
    text = extract_article_text(PAGE)
    assert text.splitlines() == [
        "Minutes of the Federal Open Market Committee",
        "The Committee voted to raise the range.",
        "Second paragraph.",
    ]


def test_extract_without_article_is_empty():
    assert extract_article_text("<html><body>404</body></html>") == ""


def test_urls_follow_fed_patterns():
    assert statement_url(date(2026, 9, 16)).endswith("/pressreleases/monetary20260916a.htm")
    assert minutes_url(date(2026, 9, 16)).endswith("/monetarypolicy/fomcminutes20260916.htm")


CAL = """
<a href="/monetarypolicy/files/fomcminutes20260128.pdf">PDF</a> |
<a href="/monetarypolicy/fomcminutes20260128.htm">HTML</a>
<br> (Released February 18, 2026)
<div>next meeting</div>
<a href="/monetarypolicy/fomcminutes20260318.htm">HTML</a><br>
"""


def test_release_dates_only_when_released():
    assert parse_release_dates(CAL) == {date(2026, 1, 28): date(2026, 2, 18)}


def test_upsert_targets_existing_unique_constraint():
    stmt = (
        pg_insert(FedDocument)
        .values(
            doc_type="minutes",
            meeting_date=date(2026, 9, 16),
            url="u",
            text="t",
            text_sha256="h",
        )
        .on_conflict_do_nothing(constraint="uq_fed_document_type_meeting")
    )
    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT ON CONSTRAINT uq_fed_document_type_meeting DO NOTHING" in sql
