import sqlalchemy as sa
from alembic import op

revision = "0007_category_limits"
down_revision = "0006_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "category_limits",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("amount BETWEEN 0.01 AND 999999999999.99", name="positive_amount"),
    )


def downgrade() -> None:
    op.drop_table("category_limits")
