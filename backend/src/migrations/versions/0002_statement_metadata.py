"""Preserve normalized bank statement metadata and common merchant spellings."""

import sqlalchemy as sa
from alembic import op

revision = "0002_statements"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None

PATTERNS = {
    1: (
        r"pyaterochka|pyatyorochka|perekrestok|magnit(?!\s*(?:cosmetic|kosmetik))|"
        r"lenta|auchan|vkusvill|samokat|yandex\s*lavka|monetka|diksi|dixy|spar"
    ),
    2: r"yandex\s*(?:go|taxi)|yandex\.go|citymobil|gazpromneft|lukoil|rosneft|tatneft|parking",
    3: r"rostelecom|megafon|beeline|vodokanal|dom\.ru",
    4: r"apteka|zhivika|invitro|helix|planeta\s*zdorov",
    5: r"dodo\s*pizza|dodopizza|burger\s*king|rostics|shokoladnica|yandex\s*(?:eda|eats)|kuper",
    6: r"kinopoisk|yandex\s*plus|spotify|cinema\s*park",
    8: r"magnit\s*(?:cosmetic|kosmetik)|zolotoe\s*yabloko|gold\s*apple|letual|ulybka\s*radugi",
    9: r"перевод\s+между\s+своими\s+счетами",
    10: r"salary|payroll",
}


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("bank_source", sa.String(6), nullable=False, server_default="MANUAL"),
    )
    op.add_column(
        "transactions", sa.Column("raw_description", sa.Text(), nullable=False, server_default="")
    )
    op.add_column("transactions", sa.Column("bank_category_raw", sa.String(255), nullable=True))
    op.add_column(
        "transactions", sa.Column("currency", sa.String(3), nullable=False, server_default="RUB")
    )
    op.create_check_constraint(
        "bank_source", "transactions", "bank_source IN ('TBANK','SBER','VTB','MANUAL')"
    )
    op.create_check_constraint("rub_currency", "transactions", "currency = 'RUB'")
    rules = sa.table(
        "category_rules",
        sa.column("category_id", sa.Integer()),
        sa.column("rule_type", sa.Enum("MCC", "KEYWORD", name="rule_type")),
        sa.column("pattern", sa.String()),
        sa.column("priority", sa.Integer()),
    )
    op.bulk_insert(
        rules,
        [
            {
                "category_id": cid,
                "rule_type": "KEYWORD",
                "pattern": pattern,
                "priority": 10 if cid == 8 else 20,
            }
            for cid, pattern in PATTERNS.items()
        ],
    )


def downgrade() -> None:
    rules = sa.table("category_rules", sa.column("pattern", sa.String()))
    op.execute(rules.delete().where(rules.c.pattern.in_(list(PATTERNS.values()))))
    op.drop_constraint("rub_currency", "transactions", type_="check")
    op.drop_constraint("bank_source", "transactions", type_="check")
    op.drop_column("transactions", "currency")
    op.drop_column("transactions", "bank_category_raw")
    op.drop_column("transactions", "raw_description")
    op.drop_column("transactions", "bank_source")
