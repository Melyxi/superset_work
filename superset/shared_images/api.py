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
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.models.core import SharedImages
from superset.shared_images.commands.delete import DeleteSharedImageCommand
from superset.shared_images.commands.exceptions import (
    SharedImageDeleteFailedError,
    SharedImageNotFoundError,
)
from superset.shared_images.filters import SharedImagesAllTextFilter
from superset.shared_images.schemas import (
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
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


class SharedImageRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(SharedImages)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "SharedImage"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "shared_image"
    allow_browser_login = True

    show_columns = [
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "image_uri",
        "id",
        "image_name",
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
        "image_uri",
        "id",
        "image_name",
        "description",
        "width",
        "height",
    ]
    add_columns = [
        "image_uri",
        "image_name",
        "description",
        "height",
        "width",
    ]
    edit_columns = add_columns
    order_columns = ["image_name"]

    search_filters = {"image_name": [SharedImagesAllTextFilter]}
    allowed_rel_fields = {"created_by"}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "shared image"
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
        """Delete bulk image
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
            command_delete = DeleteSharedImageCommand(item_ids)
            command_delete.run()
            for uri in command_delete.images_uri:
                if os.path.exists(f"{PATH_BASE}{uri}"):
                    os.remove(f"{PATH_BASE}{uri}")

            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d image template",
                    "Deleted %(num)d image templates",
                    num=len(item_ids),
                ),
            )
        except SharedImageNotFoundError:
            return self.response_404()
        except SharedImageDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    def post_headless(self) -> Response:
        """
        POST/Add item to Model
        """
        image_name = request.form.get("image_name")
        file = request.files.get("image_uri")
        description = request.form.get("description")
        height = request.form.get("height")
        width = request.form.get("width")

        if image_name and file:
            if not os.path.exists(os.path.join(PATH_BASE, BACKGROUNDS_PATH)):
                os.mkdir(os.path.join(PATH_BASE, BACKGROUNDS_PATH))
            filename = secure_filename(file.filename)
            file_path = os.path.join(
                os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
            )
            image_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"

            unique_name = (
                current_app.appbuilder.get_session.query(SharedImages)
                .filter(SharedImages.image_name == image_name)
                .all()
            )
            unique_file = (
                current_app.appbuilder.get_session.query(SharedImages)
                .filter(SharedImages.image_uri == image_uri)
                .all()
            )

            if unique_name or unique_file:
                return self.response_400(message=_("image should be unique"))

            if os.path.exists(file_path):
                filename, file_extension = os.path.splitext(filename)
                filename = (
                    filename + "_" + generate_alphanum_crypt_string(6) + file_extension
                )
                image_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"
            #
            file_path = os.path.join(
                os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
            )

            file.save(file_path)

            save_data = {
                "image_name": image_name,
                "image_uri": image_uri,
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
            image_uri = f"{PATH_BASE}{item.image_uri}"
            if os.path.exists(image_uri):
                os.remove(image_uri)

            self.datamodel.delete(item, raise_exception=True)
            self.post_delete(item)
            return self.response(200, message="OK")
        except IntegrityError as e:
            return self.response_422(message=str(e.orig))

    def put_headless(self, pk: ModelKeyType) -> Response:
        """
        PUT/Edit item to Model
        """
        item = self.datamodel.get(pk, self._base_filters)

        image_name = request.form.get("image_name")
        file = request.files.get("image_uri")
        description = request.form.get("description")
        height = request.form.get("height")
        width = request.form.get("width")

        if image_name and file:
            if not os.path.exists(os.path.join(PATH_BASE, BACKGROUNDS_PATH)):
                os.mkdir(os.path.join(PATH_BASE, BACKGROUNDS_PATH))
            filename = secure_filename(file.filename)
            file_path = os.path.join(
                os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
            )
            image_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"

            unique_name = (
                current_app.appbuilder.get_session.query(SharedImages)
                .filter(SharedImages.image_name == image_name)
                .all()
            )
            unique_file = (
                current_app.appbuilder.get_session.query(SharedImages)
                .filter(SharedImages.image_uri == image_uri)
                .all()
            )

            unique_name = [obj_bg.id for obj_bg in unique_name]
            unique_file = [obj_bg.id for obj_bg in unique_file]

            file_exist = False
            if item.id in unique_file:
                file_exist = True
                unique_file.remove(item.id)

            if item.id in unique_name:
                unique_name.remove(item.id)

            if unique_name or unique_file:
                return self.response_400(message=_("image should be unique"))

            if not file_exist:
                if os.path.exists(file_path):
                    filename, file_extension = os.path.splitext(filename)
                    filename = (
                        filename
                        + "_"
                        + generate_alphanum_crypt_string(6)
                        + file_extension
                    )
                    image_uri = f"/{os.path.join(BACKGROUNDS_PATH, filename)}"
                #
                file_path = os.path.join(
                    os.path.join(PATH_BASE, BACKGROUNDS_PATH), filename
                )

                file.save(file_path)

            save_data = {
                "image_name": image_name,
                "image_uri": image_uri,
                "description": description,
                "height": height,
                "width": width,
            }

            if not item:
                return self.response_404()
            try:
                image_uri = item.image_uri
                data = self._merge_update_item(item, save_data)
                item = self.edit_model_schema.load(data, instance=item)
                if os.path.exists(f"{PATH_BASE}{image_uri}"):
                    os.remove(f"{PATH_BASE}{image_uri}")
            except ValidationError as err:
                return self.response_422(message=err.messages)
            self.pre_update(item)
            try:
                self.datamodel.edit(item, raise_exception=True)
                self.post_update(item)
                return self.response(
                    200,
                    **{
                        API_RESULT_RES_KEY: self.edit_model_schema.dump(
                            item, many=False
                        )
                    },
                )
            except IntegrityError as e:
                return self.response_422(message=str(e.orig))
        return self.response_400(message=_("Wrong give fields"))
