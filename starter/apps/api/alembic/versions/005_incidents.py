from pathlib import Path
from alembic import op

revision = "005"
down_revision = "004"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("005_incidents.sql").read_text())


def downgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("005_down.sql").read_text())
