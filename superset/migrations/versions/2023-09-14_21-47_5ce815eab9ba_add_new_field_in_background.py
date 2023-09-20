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
"""add new field in background

Revision ID: 5ce815eab9ba
Revises: 902fdfd7cf60
Create Date: 2023-09-14 21:47:07.255474

"""

# revision identifiers, used by Alembic.
revision = "5ce815eab9ba"
down_revision = "902fdfd7cf60"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("shared_images", sa.Column("width", sa.String, nullable=True))
    op.add_column("shared_images", sa.Column("height", sa.String, nullable=True))
    op.add_column("shared_images", sa.Column("description", sa.String, nullable=True))


def downgrade():
    op.drop_column("shared_images", "height")
    op.drop_column("shared_images", "width")
    op.drop_column("shared_images", "description")
