"""add_paused_status.

Revision ID: 007
Revises: 006
Create Date: 2025-02-23 20:25:36.729391

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE runstatus ADD VALUE IF NOT EXISTS 'PAUSED'")
    op.execute("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'PAUSED'")


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
