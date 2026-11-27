import sqlalchemy as sa
from alembic import op

revision = "0009_profile_and_gamification"
down_revision = "0008_user_birth_date"
branch_labels = None
depends_on = None

# Existing awards and their point values are preserved.
BADGES = (
    ("BADGE_EXPENSES_10", "Вошёл в ритм", "Бронза", "📝", 10, "Запишите 10 расходов вручную"),
    ("BADGE_EXPENSES_25", "Знаток расходов", "Серебро", "📊", 20, "Запишите 25 расходов вручную"),
    ("BADGE_DEPOSITS_3", "Есть привычка", "Бронза", "🌱", 10, "Пополните копилки 3 раза"),
    ("BADGE_DEPOSITS_10", "Уверенный вкладчик", "Золото", "🐷", 25, "Пополните копилки 10 раз"),
    ("BADGE_CHALLENGES_3", "Три победы", "Платина", "🏅", 35, "Завершите 3 челленджа"),
)


def upgrade() -> None:
    op.add_column("users", sa.Column("goal", sa.String(16)))
    op.add_column("users", sa.Column("income_range", sa.String(16)))
    op.add_column(
        "users",
        sa.Column("preferences_saved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "user_challenges",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("code", sa.String(40), primary_key=True),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("reward_points", sa.Integer(), nullable=False, server_default="0"),
    )
    achievements = sa.Table("achievements", sa.MetaData(), autoload_with=op.get_bind())
    columns = ("code", "title", "level", "icon", "points", "condition")
    op.bulk_insert(achievements, [dict(zip(columns, badge, strict=True)) for badge in BADGES])


def downgrade() -> None:
    achievements = sa.Table("achievements", sa.MetaData(), autoload_with=op.get_bind())
    op.execute(achievements.delete().where(achievements.c.code.in_([badge[0] for badge in BADGES])))
    op.drop_table("user_challenges")
    for column in ("preferences_saved", "income_range", "goal"):
        op.drop_column("users", column)
