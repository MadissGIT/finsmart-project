import sqlalchemy as sa
from alembic import op

revision = "0004_goal_details"
down_revision = "0003_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_transactions_user_created_at", "transactions", ["user_id", "created_at"])
    op.add_column(
        "goals", sa.Column("icon", sa.String(32), nullable=False, server_default="target")
    )
    op.add_column(
        "goal_contributions",
        sa.Column("source", sa.String(10), nullable=False, server_default="free_money"),
    )
    op.create_check_constraint(
        "valid_source", "goal_contributions", "source IN ('free_money', 'discount')"
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_user_created_at", table_name="transactions")
    op.drop_constraint("valid_source", "goal_contributions", type_="check")
    op.drop_column("goal_contributions", "source")
    op.drop_column("goals", "icon")
