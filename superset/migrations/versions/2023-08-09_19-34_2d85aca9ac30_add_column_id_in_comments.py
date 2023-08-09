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
"""add column id in comments

Revision ID: 2d85aca9ac30
Revises: 5954dc2d9095
Create Date: 2023-08-09 19:34:37.043928

"""

# revision identifiers, used by Alembic.
revision = "2d85aca9ac30"
down_revision = "5954dc2d9095"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sql_query", sa.String(5000), nullable=False),
        sa.Column("column_comment", sa.String(1000), nullable=False),
        sa.Column("reference_column", sa.String(1000), nullable=False),
        sa.Column("text", sa.String(1000), nullable=False),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("tables.id"), nullable=False),
        sa.Column("column_id", sa.Integer, sa.ForeignKey("table_columns.id")),
    )


def downgrade():
    op.drop_column("comments", "column_id")
