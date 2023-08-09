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
"""add extra comments

Revision ID: b710e6c34da7
Revises: f7871a58f31f
Create Date: 2023-08-09 18:39:40.586540

"""

# revision identifiers, used by Alembic.
revision = "b710e6c34da7"
down_revision = "f7871a58f31f"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("tables", sa.Column("extra_comments", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tables", "extra_comments")
