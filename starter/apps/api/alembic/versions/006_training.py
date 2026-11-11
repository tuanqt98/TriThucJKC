from pathlib import Path
from alembic import op

revision = "006"
down_revision = "005"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("006_training.sql").read_text())


def downgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("006_down.sql").read_text())
