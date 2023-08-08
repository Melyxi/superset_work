# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""table_columns_reference_table_and_column

Revision ID: 6fbf49587a32
Revises: bf646a0c1501
Create Date: 2023-07-30 14:18:35.305757

"""

# revision identifiers, used by Alembic.
revision = "6fbf49587a32"
down_revision = "bf646a0c1501"

import sqlalchemy as sa
from alembic import op


def upgrade():
    # Добавляем новые столбцы
    op.add_column(
        "table_columns", sa.Column("reference_table", sa.Integer(), nullable=True)
    )
    op.add_column(
        "table_columns", sa.Column("reference_column", sa.Integer(), nullable=True)
    )

    # # Устанавливаем явные внешние ключи с указанием условия соединения (onclause)
    op.create_foreign_key(
        "fk_reference_table", "table_columns", "tables", ["reference_table"], ["id"]
    )
    op.create_foreign_key(
        "fk_reference_column",
        "table_columns",
        "table_columns",
        ["reference_column"],
        ["id"],
        onupdate="CASCADE",
        ondelete="CASCADE",
    )


def downgrade():
    # # Удаляем внешние ключи
    op.drop_constraint("fk_reference_table", "table_columns", type_="foreignkey")
    op.drop_constraint("fk_reference_column", "table_columns", type_="foreignkey")

    # # Удаляем столбцы
    op.drop_column("table_columns", "reference_table")
    op.drop_column("table_columns", "reference_column")
