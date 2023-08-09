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
"""add new column comments in dashboard

Revision ID: ea1809de53da
Revises: a3b46cfc8e58
Create Date: 2023-08-09 17:17:51.977651

"""

# revision identifiers, used by Alembic.
revision = "ea1809de53da"
down_revision = "a3b46cfc8e58"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("dashboards", sa.Column("comments", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("dashboards", "comments")
