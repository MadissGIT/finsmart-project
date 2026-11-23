import sqlalchemy as sa
from alembic import op

revision = "0008_user_birth_date"
down_revision = "0007_category_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "birth_date")
