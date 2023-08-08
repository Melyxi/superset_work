import datetime
import json
import logging
import os
from typing import Any, Optional, Union

import numpy as np
import pandas as pd
import psycopg2
import sqlalchemy
from flask import current_app, jsonify, request, send_from_directory
from flask_appbuilder import expose, has_access
from sqlalchemy import text
from werkzeug.utils import secure_filename

from superset import app
from superset.comments.models import Comments, FilterQuery
from superset.comments.schemes import comment_schema, comments_schema, filters_schema
from superset.comments.utils import (
    convert_pdf_in_img,
    create_filename,
    get_column_by,
    get_column_filter_by,
    get_comment_by_id,
    get_comment_filter_by,
    get_db,
    get_db_engine,
    get_table_by_id,
    get_tables_comments,
    LIMIT_ROWS,
    make_qr_code,
)
from superset.config import IMG_UPLOAD_FOLDER
from superset.connectors.sqla.models import TableColumn
from superset.databases.utils import get_table_metadata
from superset.extensions import csrf
from superset.models.dashboard import Dashboard
from superset.qrcode.models import QrCodeTable
from superset.superset_typing import FlaskResponse
from superset.utils.date_parser import get_since_until
from superset.views.core import Superset

logger = logging.getLogger("comments")


def sql_comparison(
    sql_request: str, column_comment: Any, table_id: int
) -> Union[None, str]:
    comments = current_app.appbuilder.get_session.query(Comments).all()

    table = get_table_by_id(table_id)
    engine = get_db_engine(table.database_id, table.schema)
    for comment in comments:
        if comment.column_id == column_comment.id and int(table_id) == comment.table_id:
            try:
                with engine.connect() as conn:
                    sql_1 = comment.sql_query
                    res_sql_1 = conn.execute(text(sql_1))
                    sql_2 = sql_request
                    res_sql_2 = conn.execute(text(sql_2))
                    if res_sql_1.fetchall() == res_sql_2.fetchall():
                        return comment.id

            except psycopg2.errors.SyntaxError:
                return "ERROR"

            except sqlalchemy.exc.ProgrammingError:
                return "ERROR"

    return None


config = app.config


def get_comment_columns(table: Any, columns: list[Any]) -> list[Any]:
    column_comments: list[Any] = []
    table_columns_comment = get_column_filter_by(table_id=table.id, is_comment=True)
    for column in table_columns_comment:
        columns.append(
            {
                "name": column.column_name + table.get_postfix_comment(),
                "type": "VARCHAR",
                "longType": "VARCHAR(255)",
                "keys": [],
                "comment": None,
                "id": column.id,
            }
        )
        column_comments.append(column.column_name + table.get_postfix_comment())

    return column_comments


def build_sql(table: Any, data_column: Any, query: str) -> str:
    sql = "SELECT *"

    for column, when_sql in data_column.items():
        sql += ", \n"
        if not when_sql["when_sql"]:
            sql += f'null as "{column}"'
        else:
            sql += "CASE "
            for condition in when_sql["when_sql"]:
                sql += f"when {condition[0]} then " + "'" + f"{condition[1]}" + "'\n "
            sql += f'else null\n end as "{column}"'
    sql += f' \nFROM {table.schema}."{table.table_name}"'
    if query is not None:
        sql += f" WHERE {query} LIMIT {LIMIT_ROWS};"
    else:
        sql += f" LIMIT {LIMIT_ROWS};"
    return sql


def mixin_sql_comments(
    table: Any,
    columns_comment: list[str],
    query: str,
    comments_list: Optional[list[str]] = None,
) -> str:
    table_id = table.id
    comments = get_comment_filter_by(table_id=table_id)
    column_dict: Any = {}
    for column in columns_comment:
        column_dict[column] = {"when_sql": []}
        if comments_list is None:
            for comment in comments:
                get_column = get_column_by(comment.column_id)
                if get_column.column_name + table.get_postfix_comment() == column:
                    when_sql = (
                        comment.sql_query.split("WHERE")[-1]
                        .strip()
                        .rstrip(";")
                        .split("LIMIT")[0]
                    )
                    column_dict[column]["when_sql"].append((when_sql, comment.text))
        else:
            for comment in comments:
                get_column = get_column_by(comment.column_id)
                if get_column.column_name + table.get_postfix_comment() == column:
                    if comment.id in comments_list:
                        when_sql = (
                            comment.sql_query.split("WHERE")[-1]
                            .strip()
                            .rstrip(";")
                            .split("LIMIT")[0]
                        )
                        column_dict[column]["when_sql"].append((when_sql, comment.text))

    sql = build_sql(table, column_dict, query)
    return sql


class CommentView(Superset):
    """
    Comment view for table
    """

    default_view = "comment"

    # base_permissions = ['can_private', "can_get", "can_info"]

    @has_access
    @expose("/comment/")
    def comment(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("tables/", methods=["GET"])
    def get_tables(self) -> FlaskResponse:
        tables = get_tables_comments()
        return jsonify(tables)

    # new
    @expose("/get_column_comment/<int:table_pk>/", methods=["GET"])
    def get_column_comment(self, table_pk: int) -> FlaskResponse:
        if table_pk:
            list_column = []
            table = get_table_by_id(table_pk)
            table_columns_comment = get_column_filter_by(
                table_id=table.id, is_comment=True
            )
            for column in table_columns_comment:
                list_column.append(
                    {
                        "name": column.column_name + table.get_postfix_comment(),
                        "type": "VARCHAR",
                        "longType": "VARCHAR(255)",
                        "keys": [],
                        "comment": None,
                        "id": column.id,
                    }
                )

            return jsonify({"column": list_column})

        return jsonify({"column": []})

    def to_timestamp(self, time: str) -> str:
        str_time = self.format_time(time)
        return f"TO_TIMESTAMP('{str_time}', 'YYYY-MM-DD HH24:MI:SS.US')"

    @staticmethod
    def format_time(time: str) -> str:
        if time.find(".") != -1:
            format = "%Y-%m-%dT%H:%M:%S.%f"
        else:
            format = "%Y-%m-%dT%H:%M:%S"
        datetime_str = datetime.datetime.strptime(time, format)
        str_time = datetime_str.strftime("%Y-%m-%d %H:%M:%S.%f")
        return str_time

    def build_query_sql(self, query: Any, time_range: Any, table: Any) -> str:
        sql_str = f'SELECT * FROM {table.schema}."{table.table_name}"'
        if not query:
            query = None

        if query and time_range:
            sql_str += f" WHERE {query}"
            granularity = time_range.get("granularity")
            if granularity:
                if time_range.get("result"):
                    since = time_range["result"].get("since")
                    until = time_range["result"].get("until")
                    if since:
                        str_time = self.to_timestamp(since)
                        sql_str += f" AND {granularity} >= {str_time}"
                    if until:
                        str_time = self.to_timestamp(until)
                        sql_str += f" AND {granularity} < {str_time}"

        elif query is None and time_range:
            granularity = time_range.get("granularity")
            if granularity:
                if time_range.get("result"):
                    since = time_range["result"].get("since")
                    until = time_range["result"].get("until")
                    if since and until:
                        sql_str += " WHERE "
                        if since:
                            str_time = self.to_timestamp(since)
                            sql_str += f" {granularity} >= {str_time}"
                        if until:
                            str_time = self.to_timestamp(until)
                            if since:
                                sql_str += f" AND {granularity} < {str_time}"
                            else:
                                sql_str += f" {granularity} < {str_time}"
        elif query and time_range is None:
            sql_str += " WHERE " + query.replace(";", "")

        return sql_str + f" LIMIT {LIMIT_ROWS};"

        # {"granularity": "created", "result": {"since": "2017-12-12T00:00:00", "until": "2022-10-27T00:00:00", "timeRange": "2017-12-12 : 2022-10-27"}}
        # topic__last_set >= TO_TIMESTAMP('2017-12-12 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')\n  AND topic__last_set < TO_TIMESTAMP('2022-10-29 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')

    def slice_query(self, query: str) -> Union[str, None]:
        where = query.find("WHERE")
        if where == -1:
            return None
        else:
            limit = query.find("LIMIT")

            if limit == -1:
                res_query = query[where + 5 :].replace(";", "").strip()
                return res_query
            else:
                res_query = query[where + 5 : limit].replace(";", "").strip()

                return res_query

    @has_access
    @expose("/add_comment/", methods=["POST"])
    def add_comment(self) -> FlaskResponse:
        data = request.json
        table_pk = data["db_value"]
        comment_value = data["comment_value"]
        query = data.get("query")
        time_range = data.get("time_range")
        column_id = data["column_id"]
        table = get_table_by_id(table_pk)

        column_comment = get_column_by(column_id)

        if time_range:
            since, until = get_since_until(time_range.get("timeRange"))
            result_time_range = {
                "since": since.isoformat() if since else "",
                "until": until.isoformat() if until else "",
                "timeRange": time_range.get("timeRange"),
            }
            time_range["result"] = result_time_range

        sql_query = self.build_query_sql(query, time_range, table)
        id_comment = sql_comparison(sql_query, column_comment, table_pk)

        if id_comment == "ERROR":
            response = {"status": "error", "message": "Error"}
            return jsonify(response)

        if id_comment is not None:
            comments = get_comment_by_id(id_comment)
            comments.text = comment_value
            sesh = current_app.appbuilder.get_session
            sesh.add(comments)
            sesh.commit()
            response = {"status": "success", "message": "Update comment"}
            return jsonify(response)
        else:
            comments = Comments(
                sql_query=sql_query,
                column_comment="test",
                reference_column="test",
                text=comment_value,
                table_id=int(table_pk),
                short_query=query,
                time_range=json.dumps(time_range),
                column_id=column_id,
            )
            sesh = current_app.appbuilder.get_session
            sesh.add(comments)
            sesh.commit()
            response = {"status": "success", "message": "Create new comment"}
            return jsonify(response)

    @has_access
    @expose("/get_table/<int:table>/", methods=["GET", "POST"])
    def get_table(self, table: Any) -> FlaskResponse:
        if table:
            try:
                table = get_table_by_id(table)
                engine_db = get_db_engine(table.database_id, table.schema)
                db = get_db(table.database_id)
                table_info = get_table_metadata(db, table.table_name, table.schema)
                columns = table_info["columns"]

                columns_comment = get_comment_columns(table, columns)
                with engine_db.connect() as conn:
                    comments_list = request.json.get("comments_list")
                    if comments_list:
                        comments_list = [int(i) for i in comments_list]
                    query = request.json.get("query")
                    time_range = request.json.get("time_range")

                    if time_range:
                        since, until = get_since_until(time_range.get("timeRange"))
                        result_time_range = {
                            "since": since.isoformat() if since else "",
                            "until": until.isoformat() if until else "",
                            "timeRange": time_range.get("timeRange"),
                        }
                        time_range["result"] = result_time_range

                    query = self.build_query_sql(query, time_range, table)
                    query = self.slice_query(query)

                    if not columns_comment:
                        df = pd.read_sql_query(
                            f"SELECT * FROM "
                            f'{table.schema}."{table.table_name}" '
                            f"LIMIT {LIMIT_ROWS};",
                            conn,
                        )
                    else:
                        sql = mixin_sql_comments(
                            table,
                            columns_comment,
                            query=query,
                            comments_list=comments_list,
                        )
                        df = pd.read_sql_query(sql, conn)

                table_columns_comment = get_column_filter_by(
                    table_id=table.id, is_comment=True
                )
                extra_comment_column = []
                for column_comment in table_columns_comment:
                    extra_comment_column.append(column_comment.column_name)
                    extra_comment_column.append(
                        column_comment.column_name + table.get_postfix_comment()
                    )

                response_data = {
                    "status": "success",
                    "data": df.replace({np.nan: None}).to_dict(orient="records"),
                    "columns": columns,
                    "extra_columns": extra_comment_column,
                }

                return jsonify(response_data)
            except BaseException as e:
                print(str(e))
                response_data = {"status": "error", "data": str(e)}

                return jsonify(response_data)

        return jsonify({}), 404

    @has_access
    @expose("/post_comment_null/", methods=["POST"])
    def comment_null(self) -> FlaskResponse:
        data = request.json
        table_pk = data["db_value"]
        query = data["query"]
        column_id = data["column_id"]
        table = get_table_by_id(table_pk)
        time_range = data.get("time_range")
        if time_range:
            since, until = get_since_until(time_range.get("timeRange"))
            result_time_range = {
                "since": since.isoformat() if since else "",
                "until": until.isoformat() if until else "",
                "timeRange": time_range.get("timeRange"),
            }
            time_range["result"] = result_time_range

        column_comment = get_column_by(column_id)

        sql_query = self.build_query_sql(query, time_range, table)
        id_comment = sql_comparison(sql_query, column_comment, table_pk)

        if id_comment == "ERROR":
            response = {"status": "error", "message": "Error"}
            return jsonify(response)

        if id_comment is not None:
            comments = get_comment_by_id(id_comment)
            sesh = current_app.appbuilder.get_session
            sesh.delete(comments)
            sesh.commit()
            response = {"status": "success", "message": "Delete comment"}
            return jsonify(response)
        else:
            response = {"status": "success", "message": "No comment"}
            return jsonify(response)

    @expose("/get_comments_list/<int:id_table>/", methods=["GET"])
    def get_comments_list(self, id_table: Union[int, None] = None) -> FlaskResponse:
        if id_table:
            comments = (
                current_app.appbuilder.get_session.query(Comments)
                .join(TableColumn)
                .filter(Comments.table_id == id_table)
                .filter(TableColumn.is_comment == True)
                .all()
            )

            data = comments_schema.dump(comments)
            return jsonify(data)

        return jsonify({}), 404

    @has_access
    @expose("/get_comments_api/<int:id_comment>/", methods=["GET", "DELETE"])
    def get_comment_api(self, id_comment: int) -> FlaskResponse:
        if comment := get_comment_by_id(id_comment):
            if request.method == "GET":
                data = comment_schema.dump(comment)
                return jsonify(data), 200
            if request.method == "DELETE":
                try:
                    sesh = current_app.appbuilder.get_session
                    sesh.delete(comment)
                    sesh.commit()
                    return jsonify({"status": "success"}), 200
                except BaseException:
                    return jsonify({}), 404

        return jsonify({}), 404

    # контроллеры для работы с фильтрами
    @expose("/add_filter/", methods=["POST"])
    def add_filter(self) -> FlaskResponse:
        query = request.json.get("query")
        table_id = request.json.get("table_id")
        name = request.json.get("name")

        if query and name:
            try:
                filter_query = FilterQuery(name=name, query=query, table_id=table_id)
                sesh = current_app.appbuilder.get_session
                sesh.add(filter_query)
                sesh.commit()
            except psycopg2.errors.UniqueViolation:
                return jsonify(
                    {
                        "status": "error",
                        "message": "Фильтер с таким именем " "уже существует",
                    }
                )
            except sqlalchemy.exc.IntegrityError:
                return jsonify(
                    {
                        "status": "error",
                        "message": "Фильтер с таким именем " "уже существует",
                    }
                )

            return jsonify({"status": "success"})

        return jsonify({"status": "error"})

    @expose("/delete_filter/<int:id_filter>/", methods=["DELETE"])
    def delete_filter(self, id_filter: Union[int, None] = None) -> FlaskResponse:
        """
        Delete filter in comment
        """
        if id_filter is not None:
            try:
                filter_query = FilterQuery.get_by_id(id_filter)
                sesh = current_app.appbuilder.get_session
                sesh.delete(filter_query)
                sesh.commit()
            except sqlalchemy.orm.exc.UnmappedInstanceError:
                return jsonify({"status": "error"}), 404

            return jsonify({"status": "success"})

        return jsonify({"status": "error"})

    @expose("/list_filters/", methods=["GET"])
    def list_filters(self) -> FlaskResponse:
        filters_query = FilterQuery.get_all()
        filters_query = filters_schema.dump(filters_query)
        return jsonify({"status": "success", "data": filters_query})

    @expose("/get_qr_code/<int:id_dashboard>/", methods=["GET", "POST"])
    def qr_code(self, id_dashboard: int) -> FlaskResponse:
        if request.method == "POST":
            coordinates = request.form.get("coordinates")
            file = request.files["file"]

            # if coordinates:
            #     coordinates = json.dumps(coordinates)
        else:
            coordinates = None
        dashboard = current_app.appbuilder.get_session.query(Dashboard).get(
            id_dashboard
        )

        uploads = os.path.join(current_app.root_path, IMG_UPLOAD_FOLDER)

        if dashboard:
            extra_comments = dashboard.comments
            qr_code = (
                current_app.appbuilder.get_session.query(QrCodeTable)
                .filter_by(comments=extra_comments, coordinates=coordinates)
                .first()
            )
            if qr_code:
                file_qr = json.loads(qr_code.filename)

                return send_from_directory(directory=uploads, filename=file_qr[0])

            else:
                comments = QrCodeTable(comments=extra_comments, coordinates=coordinates)
                sesh = current_app.appbuilder.get_session
                sesh.add(comments)
                sesh.flush()
                id_qr = comments.id
                filename = f"qr_code_{id_qr}.png"

                make_qr_code(filename, str(id_qr))

                filename_pdf = secure_filename(file.filename)
                file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename_pdf))

                file_image = convert_pdf_in_img(filename_pdf, id_qr)

                comments.filename = json.dumps([filename, file_image])
                sesh.add(comments)
                sesh.commit()
                return send_from_directory(directory=uploads, filename=filename)

        return jsonify({})
