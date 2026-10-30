from pathlib import Path
from alembic import op

revision = "003"
down_revision = "002"


def upgrade():
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("003_sprint01.sql").read_text())


def downgrade():
    # Restore backup if 003 has collected real acknowledgements/quiz histories.
    op.get_bind().connection.driver_connection.execute(Path(__file__).with_name("003_down.sql").read_text())
