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
import logging
import os
import secrets
import string
from typing import Any

from flask import current_app, request, Response
from flask_appbuilder.api import expose, ModelKeyType, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import protect
from flask_babel import _, ngettext
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from superset import app
from superset.background_templates.commands.delete import (
    DeleteBackgroundTemplateCommand,
)
from superset.background_templates.commands.exceptions import (
    BackgroundTemplateDeleteFailedError,
    BackgroundTemplateNotFoundError,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.css_templates.filters import CssTemplateAllTextFilter
from superset.css_templates.schemas import (
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.extensions import event_logger
from superset.models.core import BackgroundTemplate
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)
API_RESULT_RES_KEY = "result"
BACKGROUNDS_PATH = "static/assets/images/background"
PATH_BASE = app.config["BASE_DIR"]


def generate_alphanum_crypt_string(length: int) -> str:
    letters_and_digits = string.ascii_letters + string.digits
    crypt_rand_string = "".join(
        secrets.choice(letters_and_digits) for i in range(length)
    )
    return crypt_rand_string


class BackgroundTemplateRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(BackgroundTemplate)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "BackgroundTemplate"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "background_template"
    allow_browser_login = True

    show_columns = [
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "background_uri",
        "id",
        "background_name",
        "description",
        "width",
        "height",
    ]
    list_columns = [
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "created_on",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "background_uri",
        "id",
        "background_name",
        "description",
        "width",
        "height",
    ]
    add_columns = [
        "background_uri",
        "background_name",
        "description",
        "height",
        "width",
    ]
    edit_columns = add_columns
    order_columns = ["background_name"]

    search_filters = {"background_name": [CssTemplateAllTextFilter]}
    allowed_rel_fields = {"created_by"}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "background Templates"
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk background Templates
        ---
        delete:
          description: >-
            Deletes multiple css templates in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: CSS templates bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            command_delete = DeleteBackgroundTemplateCommand(item_ids)
            command_delete.run()
            for uri in command_delete.backgrounds_uri:
                if os.path.exists(f"{PATH_BASE}{uri}"):
                    os.remove(f"{PATH_BASE}{uri}")

            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d background template",
                    "Deleted %(num)d background templates",
                    num=len(item_ids),
                ),
            )
        except BackgroundTemplateNotFoundError:
            return self.response_404()
        except BackgroundTemplateDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    def post_headless(self) -> Response:
        """
        POST/Add item to Model
        """
        background_name = request.form.get("background_name")
        file = request.files.get("background_uri")
        description = request.form.get("description")
        height = request.form.get("height")
        width = request.form.get("width")

        if background_name and file:
            if not os.path.exists(os.path.join(PATH_BASE, BACKGROUNDS_PATH)):
                os.mkdir(os.path.join(PATH_BASE, BACKGROUNDS_PATH))
            filename = secure_filename(file.filename)
            file_path = os.path.join(
                os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
            )
            background_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"

            unique_name = (
                current_app.appbuilder.get_session.query(BackgroundTemplate)
                .filter(BackgroundTemplate.background_name == background_name)
                .all()
            )
            unique_file = (
                current_app.appbuilder.get_session.query(BackgroundTemplate)
                .filter(BackgroundTemplate.background_uri == background_uri)
                .all()
            )

            if unique_name or unique_file:
                return self.response_400(message=_("Background should be unique"))

            if os.path.exists(file_path):
                filename, file_extension = os.path.splitext(filename)
                filename = (
                    filename + "_" + generate_alphanum_crypt_string(6) + file_extension
                )
                background_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"
            #
            file_path = os.path.join(
                os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
            )

            file.save(file_path)

            save_data = {
                "background_name": background_name,
                "background_uri": background_uri,
                "description": description,
                "height": height,
                "width": width,
            }

            try:
                item = self.add_model_schema.load(save_data)
            except ValidationError as err:
                return self.response_422(message=err.messages)
            # This validates custom Schema with custom validations
            self.pre_add(item)
            try:
                self.datamodel.add(item, raise_exception=True)
                self.post_add(item)
                return self.response(
                    201,
                    **{
                        API_RESULT_RES_KEY: self.add_model_schema.dump(
                            item, many=False
                        ),
                        "id": self.datamodel.get_pk_value(item),
                    },
                )
            except IntegrityError as e:
                return self.response_422(message=str(e.orig))
        return self.response_400(message=_("Wrong give fields"))

    def delete_headless(self, pk: ModelKeyType) -> Response:
        """
        Delete item from Model
        """
        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            return self.response_404()
        self.pre_delete(item)
        try:
            background_uri = f"{PATH_BASE}{item.background_uri}"
            if os.path.exists(background_uri):
                os.remove(background_uri)

            self.datamodel.delete(item, raise_exception=True)
            self.post_delete(item)
            return self.response(200, message="OK")
        except IntegrityError as e:
            return self.response_422(message=str(e.orig))
