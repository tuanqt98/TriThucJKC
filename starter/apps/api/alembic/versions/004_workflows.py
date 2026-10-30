from pathlib import Path
from alembic import op

revision = "004"
down_revision = "003"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("004_workflows.sql").read_text())


def downgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("004_down.sql").read_text())
