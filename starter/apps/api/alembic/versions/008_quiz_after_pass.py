from pathlib import Path
from alembic import op

revision = "008"
down_revision = "007"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("008_quiz_after_pass.sql").read_text())


def downgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("008_down.sql").read_text())
