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
"""create background_template_dash table

Revision ID: 902fdfd7cf60
Revises: 23b142ad1855
Create Date: 2023-08-26 17:32:13.748968

"""

# revision identifiers, used by Alembic.
revision = "902fdfd7cf60"
down_revision = "23b142ad1855"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        "background_templates_dash",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False
        ),
        sa.Column(
            "background_id",
            sa.Integer(),
            sa.ForeignKey("background_templates.id"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_table("background_templates_dash")
