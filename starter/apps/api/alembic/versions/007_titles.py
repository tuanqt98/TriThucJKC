from pathlib import Path
from alembic import op

revision = "007"
down_revision = "006"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("007_titles.sql").read_text())


def downgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("007_down.sql").read_text())
