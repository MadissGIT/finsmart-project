from alembic import op

revision = "0006_query_indexes"
down_revision = "0005_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_transactions_user_category_date",
        "transactions",
        ["user_id", "category_id", "transaction_date"],
    )
    op.create_index(
        "ix_goal_contributions_goal_date", "goal_contributions", ["goal_id", "created_at", "id"]
    )
    op.drop_index("ix_goal_contributions_goal_id", table_name="goal_contributions")


def downgrade() -> None:
    op.create_index("ix_goal_contributions_goal_id", "goal_contributions", ["goal_id"])
    op.drop_index("ix_goal_contributions_goal_date", table_name="goal_contributions")
    op.drop_index("ix_transactions_user_category_date", table_name="transactions")
