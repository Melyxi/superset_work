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
from __future__ import annotations

import json
import logging
from json import JSONDecodeError
from typing import Any, TYPE_CHECKING

import simplejson
from flask import current_app, g, make_response, request, Response
from flask_appbuilder.api import expose, protect
from flask_babel import gettext as _
from marshmallow import ValidationError
from sqlalchemy import text

from superset import is_feature_enabled, security_manager
from superset.charts.api import ChartRestApi
from superset.charts.commands.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.charts.data.commands.create_async_job_command import (
    CreateAsyncChartDataJobCommand,
)
from superset.charts.data.commands.get_data_command import ChartDataCommand
from superset.charts.data.query_context_cache_loader import QueryContextCacheLoader
from superset.charts.post_processing import apply_post_process
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.comments.models import Comments
from superset.comments.utils import get_column_by
from superset.comments.views import get_db_engine
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.connectors.base.models import BaseDatasource
from superset.connectors.sqla.models import TableColumn
from superset.daos.exceptions import DatasourceNotFound
from superset.exceptions import QueryObjectValidationError
from superset.extensions import event_logger
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.utils.async_query_manager import AsyncQueryTokenException
from superset.utils.core import create_zip, get_user_id, json_int_dttm_ser
from superset.views.base import CsvResponse, generate_download_headers, XlsxResponse
from superset.views.base_api import statsd_metrics

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

logger = logging.getLogger(__name__)


class ChartDataRestApi(ChartRestApi):
    include_route_methods = {"get_data", "data", "data_from_cache"}

    @expose("/<int:pk>/data/", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def get_data(self, pk: int) -> Response:
        """
        Takes a chart ID and uses the query context stored when the chart was saved
        to return payload data response.
        ---
        get:
          description: >-
            Takes a chart ID and uses the query context stored when the chart was saved
            to return payload data response.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The chart ID
          - in: query
            name: format
            description: The format in which the data should be returned
            schema:
              type: string
          - in: query
            name: type
            description: The type in which the data should be returned
            schema:
              type: string
          - in: query
            name: force
            description: Should the queries be forced to load from the source
            schema:
                type: boolean
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()

        try:
            json_body = json.loads(chart.query_context)
        except (TypeError, json.decoder.JSONDecodeError):
            json_body = None

        if json_body is None:
            return self.response_400(
                message=_(
                    "Chart has no query context saved. Please save the chart again."
                )
            )

        # override saved query context
        json_body["result_format"] = request.args.get(
            "format", ChartDataResultFormat.JSON
        )
        json_body["result_type"] = request.args.get("type", ChartDataResultType.FULL)
        json_body["force"] = request.args.get("force")

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound as error:
            return self.response_404()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if (
            is_feature_enabled("GLOBAL_ASYNC_QUERIES")
            and query_context.result_format == ChartDataResultFormat.JSON
            and query_context.result_type == ChartDataResultType.FULL
        ):
            return self._run_async(json_body, command)

        try:
            form_data = json.loads(chart.params)
        except (TypeError, json.decoder.JSONDecodeError):
            form_data = {}

        return self._get_data_response(
            command=command, form_data=form_data, datasource=query_context.datasource
        )

    @expose("/data", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def data(self) -> Response:
        """
        Takes a query context constructed in the client and returns payload
        data response for the given query.
        ---
        post:
          description: >-
            Takes a query context constructed in the client and returns payload data
            response for the given query.
          requestBody:
            description: >-
              A query context consists of a datasource from which to fetch data
              and one or many query objects.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/ChartDataQueryContextSchema"
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            202:
              description: Async job details
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataAsyncResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        json_body = None
        if request.is_json:
            json_body = request.json
        elif request.form.get("form_data"):
            # CSV export submits regular form data
            try:
                json_body = json.loads(request.form["form_data"])
            except (TypeError, json.JSONDecodeError):
                pass

        if json_body is None:
            return self.response_400(message=_("Request is not JSON"))

        try:
            query_context = self._create_query_context_from_form(json_body)
            command = ChartDataCommand(query_context)
            command.validate()
        except DatasourceNotFound as error:
            return self.response_404()
        except QueryObjectValidationError as error:
            return self.response_400(message=error.message)
        except ValidationError as error:
            return self.response_400(
                message=_(
                    "Request is incorrect: %(error)s", error=error.normalized_messages()
                )
            )

        # TODO: support CSV, SQL query and other non-JSON types
        if (
            is_feature_enabled("GLOBAL_ASYNC_QUERIES")
            and query_context.result_format == ChartDataResultFormat.JSON
            and query_context.result_type == ChartDataResultType.FULL
        ):
            return self._run_async(json_body, command)

        form_data = json_body.get("form_data")
        return self._get_data_response(
            command, form_data=form_data, datasource=query_context.datasource
        )

    @expose("/data/<cache_key>", methods=("GET",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".data_from_cache",
        log_to_statsd=False,
    )
    def data_from_cache(self, cache_key: str) -> Response:
        """
        Takes a query context cache key and returns payload
        data response for the given query.
        ---
        get:
          description: >-
            Takes a query context cache key and returns payload data
            response for the given query.
          parameters:
          - in: path
            schema:
              type: string
            name: cache_key
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            cached_data = self._load_query_context_form_from_cache(cache_key)
            # Set form_data in Flask Global as it is used as a fallback
            # for async queries with jinja context
            setattr(g, "form_data", cached_data)
            query_context = self._create_query_context_from_form(cached_data)
            command = ChartDataCommand(query_context)
            command.validate()
        except ChartDataCacheLoadError:
            return self.response_404()
        except ValidationError as error:
            return self.response_400(
                message=_("Request is incorrect: %(error)s", error=error.messages)
            )

        return self._get_data_response(command, True)

    def _run_async(
        self, form_data: dict[str, Any], command: ChartDataCommand
    ) -> Response:
        """
        Execute command as an async query.
        """
        # First, look for the chart query results in the cache.
        result = None
        try:
            result = command.run(force_cached=True)
            if result is not None:
                return self._send_chart_response(result)
        except ChartDataCacheLoadError:
            pass

        # Otherwise, kick off a background job to run the chart query.
        # Clients will either poll or be notified of query completion,
        # at which point they will call the /data/<cache_key> endpoint
        # to retrieve the results.
        async_command = CreateAsyncChartDataJobCommand()
        try:
            async_command.validate(request)
        except AsyncQueryTokenException:
            return self.response_401()

        result = async_command.run(form_data, get_user_id())
        return self.response(202, **result)

    def _send_chart_response(
        self,
        result: dict[Any, Any],
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
    ) -> Response:
        result_type = result["query_context"].result_type
        result_format = result["query_context"].result_format

        # Post-process the data so it matches the data presented in the chart.
        # This is needed for sending reports based on text charts that do the
        # post-processing of data, eg, the pivot table.
        if result_type == ChartDataResultType.POST_PROCESSED:
            result = apply_post_process(result, form_data, datasource)

        if result_format in ChartDataResultFormat.table_like():
            # Verify user has permission to export file
            if not security_manager.can_access("can_csv", "Superset"):
                return self.response_403()

            if not result["queries"]:
                return self.response_400(_("Empty query result"))

            is_csv_format = result_format == ChartDataResultFormat.CSV

            if len(result["queries"]) == 1:
                # return single query results
                data = result["queries"][0]["data"]
                if is_csv_format:
                    return CsvResponse(data, headers=generate_download_headers("csv"))

                return XlsxResponse(data, headers=generate_download_headers("xlsx"))

            # return multi-query results bundled as a zip file
            def _process_data(query_data: Any) -> Any:
                if result_format == ChartDataResultFormat.CSV:
                    encoding = current_app.config["CSV_EXPORT"].get("encoding", "utf-8")
                    return query_data.encode(encoding)
                return query_data

            files = {
                f"query_{idx + 1}.{result_format}": _process_data(query["data"])
                for idx, query in enumerate(result["queries"])
            }
            return Response(
                create_zip(files),
                headers=generate_download_headers("zip"),
                mimetype="application/zip",
            )

        if result_format == ChartDataResultFormat.JSON:
            response_data = simplejson.dumps(
                {"result": result["queries"]},
                default=json_int_dttm_ser,
                ignore_nan=True,
            )
            resp = make_response(response_data, 200)
            resp.headers["Content-Type"] = "application/json; charset=utf-8"
            return resp

        return self.response_400(message=f"Unsupported result_format: {result_format}")

    @staticmethod
    def _db_intersect_sql(datasource: Any, sql_result: str) -> bool:
        engine = get_db_engine(datasource.database_id, datasource.schema)

        with engine.connect() as conn:
            try:
                result = conn.execute(text(sql_result))
                rows = result.fetchall()
            except BaseException as e:
                print(f"Error: {str(e)}")
                rows = []
        if rows:
            return True
        return False

    def _get_query_comparison(
        self, result: Any, query_comment: str, datasource: Any
    ) -> Any:
        try:
            result_intersect_sql = []
            for query in result["queries"]:
                res_query = query["query"]

                index_select_column = len("SELECT")
                index_from = res_query.find("FROM")
                index_limit = res_query.find("LIMIT")
                index_group_by = res_query.find("GROUP BY")

                select_column = res_query[index_select_column:index_from].replace(
                    ";", ""
                )
                group_by = ""
                if index_group_by != -1:
                    if index_limit != -1:
                        group_by = res_query[index_group_by:index_limit].replace(
                            ";", ""
                        )
                    else:
                        group_by = res_query[index_group_by:].replace(";", "")

                if index_limit != -1:
                    sql_select1 = res_query.replace(";", "").rstrip("\n")
                else:
                    sql_select1 = res_query.replace(";", "").rstrip("\n")

                index_comment_from = query_comment.find("FROM")

                index_limit_comment = query_comment.find("LIMIT")
                if index_limit_comment == -1:
                    where_comment = (
                        query_comment[index_comment_from:-1].rstrip(";") + "\n"
                    )
                    limit_sql_comment = ""
                else:
                    where_comment = (
                        query_comment[index_comment_from:index_limit_comment].rstrip(
                            ";"
                        )
                        + "\n"
                    )
                    limit_sql_comment = (
                        query_comment[index_limit_comment:].rstrip(";") + "\n"
                    )

                sql_select2 = (
                    query_comment[:index_select_column]
                    + select_column
                    + where_comment
                    + group_by
                    + limit_sql_comment
                    + ";"
                )

                sql_result = (
                    "(" + sql_select1 + ")" + "\nINTERSECT\n" + "(" + sql_select2 + ")"
                )
                res = sql_result.replace(";", "") + ";"
                intersect_sql = self._db_intersect_sql(datasource, res)
                result_intersect_sql.append(intersect_sql)

            return result_intersect_sql
        except KeyError as e:
            return False

    def _get_comments_in_slice(
        self, result: Any, datasource: Any, form_data: Any
    ) -> Any:
        if datasource.__tablename__ == "tables":
            try:
                comments = (
                    current_app.appbuilder.get_session.query(Comments)
                    .join(TableColumn)
                    .filter(Comments.table_id == datasource.id)
                    .filter(TableColumn.is_comment == True)
                    .all()
                )

                comments_in_column = []
                for comment in comments:
                    # проверка на колонку
                    column = get_column_by(comment.column_id)
                    queries = result.get("queries")
                    if queries:
                        colnames_list = []
                        if form_data.get("metrics"):
                            for metric in form_data.get("metrics"):
                                if isinstance(metric, dict):
                                    colnames_list.append(
                                        metric["column"]["column_name"]
                                    )
                        for query in queries:
                            colnames = query.get("colnames")
                            if colnames:
                                colnames_list.extend(colnames)
                        if form_data.get("granularity_sqla"):
                            colnames_list.append(form_data.get("granularity_sqla"))

                        flag_include_column = False
                        for column_chart in colnames_list:
                            if column.column_name in column_chart:
                                flag_include_column = True
                                break

                        if flag_include_column:
                            comparison = self._get_query_comparison(
                                result, comment.sql_query, datasource
                            )
                            if comparison:
                                comments_in_column.append(
                                    {
                                        "column": column.column_name
                                        + datasource.get_postfix_comment(),
                                        "comment": comment.text,
                                    }
                                )

                return comments_in_column
            except JSONDecodeError as e:
                print("Error: ", str(e))

    @staticmethod
    def _add_comment_dashboard(form_data: Any, comments_in_column: Any) -> None:
        dashboard_id = form_data.get("dashboardId")
        slice_id = form_data.get("slice_id")

        if dashboard_id and slice_id:
            slice_name = (
                current_app.appbuilder.get_session.query(Slice).get(slice_id).slice_name
            )

            dashboard = current_app.appbuilder.get_session.query(Dashboard).get(
                dashboard_id
            )
            cur_slice_id = (
                current_app.appbuilder.get_session.query(dashboard_slices)
                .filter_by(dashboard_id=dashboard_id)
                .all()
            )
            cur_slice_id = [item[2] for item in cur_slice_id]
            dashboard_comments = dashboard.comments

            if dashboard_comments is not None:
                dashboard_comments = json.loads(dashboard_comments)
                for item in dashboard_comments:
                    if item.get("slice_id") not in cur_slice_id:
                        dashboard_comments.remove(item)
            else:
                dashboard_comments = []

            slice_comments = {
                "slice_id": slice_id,
                "slice_name": slice_name,
                "comments": comments_in_column,
            }
            for item in dashboard_comments:
                if slice_comments["slice_id"] == item["slice_id"]:
                    dashboard_comments.remove(item)
            dashboard_comments.append(slice_comments)
            dashboard_comments = json.dumps(dashboard_comments)
            dashboard.comments = dashboard_comments
            sesh = current_app.appbuilder.get_session
            sesh.add(dashboard)
            sesh.commit()

    def _add_comment(self, result: Any, datasource: Any, form_data: Any) -> None:
        if datasource is not None:
            get_comments = self._get_comments_in_slice(result, datasource, form_data)
            self._add_comment_dashboard(form_data, get_comments)
            if get_comments:
                if result.get("queries"):
                    result["queries"][0].update({"extra_comments": get_comments})

    def _get_data_response(
        self,
        command: ChartDataCommand,
        force_cached: bool = False,
        form_data: dict[str, Any] | None = None,
        datasource: BaseDatasource | Query | None = None,
    ) -> Response:
        try:
            result = command.run(force_cached=force_cached)
        except ChartDataCacheLoadError as exc:
            return self.response_422(message=exc.message)
        except ChartDataQueryFailedError as exc:
            return self.response_400(message=exc.message)

        self._add_comment(result, datasource, form_data)

        return self._send_chart_response(result, form_data, datasource)

    # pylint: disable=invalid-name, no-self-use
    def _load_query_context_form_from_cache(self, cache_key: str) -> dict[str, Any]:
        return QueryContextCacheLoader.load(cache_key)

    # pylint: disable=no-self-use
    def _create_query_context_from_form(
        self, form_data: dict[str, Any]
    ) -> QueryContext:
        try:
            return ChartDataQueryContextSchema().load(form_data)
        except KeyError as ex:
            raise ValidationError("Request is incorrect") from ex
        except ValidationError as error:
            raise error
