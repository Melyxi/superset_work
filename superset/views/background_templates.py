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
from flask_appbuilder.api import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models import core as models
from superset.superset_typing import FlaskResponse
from superset.views.base import DeleteMixin, SupersetModelView


class SharedImagesModelView(  # pylint: disable=too-many-ancestors
    SupersetModelView,
    DeleteMixin,
):
    datamodel = SQLAInterface(models.SharedImages)
    include_route_methods = RouteMethod.CRUD_SET

    class_permission_name = "SharedImages"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    list_title = _("Shared images")
    show_title = _("Show shared images")
    add_title = _("Add shared images")
    edit_title = _("Edit shared images")

    list_columns = ["image_name"]
    edit_columns = ["image_name", "image_uri"]
    add_columns = edit_columns
    label_columns = {"image_name": _("image Name")}

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()


class BackgroundTemplateAsyncModelView(  # pylint: disable=too-many-ancestors
    SharedImagesModelView
):
    include_route_methods = {RouteMethod.API_READ}
    class_permission_name = "SharedImages"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    list_columns = ["image_name", "image_uri"]
