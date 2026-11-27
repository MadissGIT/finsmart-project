from datetime import date
from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0010_support_welcome_savings"
down_revision = "0009_profile_and_gamification"
branch_labels = None
depends_on = None

# Dates and terms published by the merchants. 9999-12-31 denotes an ongoing programme.
OFFERS = (
    {
        "code": "R-01",
        "category_id": 1,
        "partner_name": "ВкусВилл",
        "title": "20% на любимый продукт",
        "activation": "Назначьте товар в приложении или на сайте ВкусВилла.",
        "benefit": "20%",
        "conditions": "Скидка на выбранный товар действует 7 дней. Нужна карта лояльности. "
        "Условия назначения и исключения указаны на сайте.",
        "discount_percent": 20,
        "valid_until": date.max,
        "affiliate_url": "https://vkusvill.ru/offers/lyubimyy-produkt.html",
    },
    {
        "code": "R-02",
        "category_id": 1,
        "partner_name": "Пятёрочка",
        "title": "Йокими 2 за 399 ₽",
        "activation": "Добавьте игрушку в чек и предъявите карту «Х5 Клуба».",
        "benefit": "400 ₽",
        "conditions": "В магазине или доставке, участвующих в акции, купите товары на сумму "
        "от 1 000 ₽ в том же чеке. Скидка на одну игрушку. Есть исключения.",
        "discount_percent": 0,
        "valid_until": date(2027, 1, 25),
        "affiliate_url": "https://yokimi2.5ka.ru/",
    },
)


def upgrade() -> None:
    for column in ("welcome_started_at", "first_manual_at"):
        op.add_column("users", sa.Column(column, sa.DateTime(timezone=True)))
    op.add_column("goal_contributions", sa.Column("transaction_id", sa.Uuid()))
    op.create_foreign_key(
        "fk_goal_contributions_transaction_id_transactions",
        "goal_contributions",
        "transactions",
        ["transaction_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_goal_contributions_transaction_id", "goal_contributions", ["transaction_id"]
    )
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("attachment_name", sa.String(255)),
        sa.Column("attachment_type", sa.String(32)),
        sa.Column("attachment", sa.LargeBinary()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("user_id", "request_id"),
    )
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])
    discounts = sa.Table("discounts", sa.MetaData(), autoload_with=op.get_bind())
    op.bulk_insert(
        discounts,
        [
            {
                **offer,
                "id": uuid5(NAMESPACE_URL, "finsmart:" + str(offer["code"])),
                "is_demo": False,
            }
            for offer in OFFERS
        ],
    )


def downgrade() -> None:
    discounts = sa.Table("discounts", sa.MetaData(), autoload_with=op.get_bind())
    op.execute(discounts.delete().where(discounts.c.code.in_([offer["code"] for offer in OFFERS])))
    op.drop_table("support_tickets")
    op.drop_constraint("uq_goal_contributions_transaction_id", "goal_contributions", type_="unique")
    op.drop_constraint(
        "fk_goal_contributions_transaction_id_transactions",
        "goal_contributions",
        type_="foreignkey",
    )
    op.drop_column("goal_contributions", "transaction_id")
    op.drop_column("users", "first_manual_at")
    op.drop_column("users", "welcome_started_at")
