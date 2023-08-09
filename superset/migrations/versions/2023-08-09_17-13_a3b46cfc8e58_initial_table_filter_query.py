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
"""initial table filter query

Revision ID: a3b46cfc8e58
Revises: 6fbf49587a32
Create Date: 2023-08-09 17:13:58.892880

"""

# revision identifiers, used by Alembic.
revision = "a3b46cfc8e58"
down_revision = "6fbf49587a32"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "filter_query",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(5000), nullable=False, unique=True),
        sa.Column("query", sa.String(5000), nullable=False),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("tables.id"), nullable=True),
    )


def downgrade():
    op.drop_table("filter_query")
