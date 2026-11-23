import json
from datetime import date
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0005_catalog"
down_revision = "0004_goal_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("discounts", sa.Column("code", sa.String(10), nullable=True))
    op.create_unique_constraint("uq_discounts_code", "discounts", ["code"])
    for field in ("activation", "benefit", "conditions"):
        op.add_column("discounts", sa.Column(field, sa.Text(), nullable=False, server_default=""))
    op.add_column(
        "discounts", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="true")
    )
    op.create_table(
        "achievements",
        sa.Column("code", sa.String(40), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("icon", sa.String(20), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("condition", sa.Text(), nullable=False),
    )
    op.create_table(
        "user_achievements",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "code",
            sa.String(40),
            sa.ForeignKey("achievements.code", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "earned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    metadata = sa.MetaData()
    discounts = sa.Table("discounts", metadata, autoload_with=op.get_bind())
    achievements = sa.Table("achievements", metadata, autoload_with=op.get_bind())
    seeds = Path(__file__).resolve().parents[3] / "seeds"
    offers = json.loads((seeds / "discounts.json").read_text())
    for offer in offers:
        offer["id"] = uuid5(NAMESPACE_URL, "finsmart:" + offer["code"])
        offer["valid_until"] = date.fromisoformat(offer["valid_until"])
    op.bulk_insert(discounts, offers)
    op.bulk_insert(achievements, json.loads((seeds / "achievements.json").read_text()))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM discounts WHERE code LIKE 'D-%'"))
    op.drop_table("user_achievements")
    op.drop_table("achievements")
    op.drop_constraint("uq_discounts_code", "discounts", type_="unique")
    for field in ("code", "activation", "benefit", "conditions", "is_demo"):
        op.drop_column("discounts", field)
