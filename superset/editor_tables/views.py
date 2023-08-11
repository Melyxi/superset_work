import datetime
from typing import Any

import numpy as np
import pandas as pd
from flask import current_app, jsonify, request
from flask_appbuilder import expose, has_access
from sqlalchemy import text

from superset.comments.utils import (
    get_column_filter_by,
    get_db,
    get_db_engine,
    get_table_by_id,
    get_tables_comments,
    LIMIT_ROWS,
)
from superset.connectors.sqla.models import TableColumn
from superset.databases.utils import get_table_metadata
from superset.extensions import csrf
from superset.models.slice import Slice
from superset.superset_typing import FlaskResponse
from superset.utils.date_parser import get_since_until
from superset.views.core import Superset


class EditorTablesView(Superset):
    default_view = "editortables"

    # base_permissions = ['can_private', "can_get", "can_info"]

    # @has_access
    @expose("/editor/")
    def editortables(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("tables_table/", methods=["GET"])
    def get_tables(self) -> FlaskResponse:
        tables = get_tables_comments()
        return jsonify(tables)

    @expose("/get_column_comment/<int:table_pk>/", methods=["GET"])
    def get_column_comment(self, table_pk: int) -> str:
        print(table_pk)
        if table_pk:
            list_column = []
            table = get_table_by_id(table_pk)
            table_columns_comment = get_column_filter_by(table_id=table.id)
            for column in table_columns_comment:
                list_column.append(
                    {
                        "name": column.column_name,
                        "id": column.id,
                    }
                )

            return jsonify({"column": list_column})

        return jsonify({"column": []})

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
                            # noinspection PyPackageRequirements
                            if since:
                                sql_str += f" AND {granularity} < {str_time}"
                            else:
                                sql_str += f" {granularity} < {str_time}"
        elif query and time_range is None:
            sql_str += " WHERE " + query.replace(";", "")

        return sql_str + f" LIMIT {LIMIT_ROWS};"

        # {"granularity": "created", "result": {"since": "2017-12-12T00:00:00", "until": "2022-10-27T00:00:00", "timeRange": "2017-12-12 : 2022-10-27"}}
        # topic__last_set >= TO_TIMESTAMP('2017-12-12 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')\n  AND topic__last_set < TO_TIMESTAMP('2022-10-29 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')

    def to_timestamp(self, time: Any) -> str:
        str_time = self.format_time(time)
        return f"TO_TIMESTAMP('{str_time}', 'YYYY-MM-DD HH24:MI:SS.US')"

    @staticmethod
    def format_time(time: Any) -> str:
        if time.find(".") != -1:
            format = "%Y-%m-%dT%H:%M:%S.%f"
        else:
            format = "%Y-%m-%dT%H:%M:%S"
        datetime_str = datetime.datetime.strptime(time, format)
        str_time = datetime_str.strftime("%Y-%m-%d %H:%M:%S.%f")
        return str_time

    def slice_query(self, query: Any) -> Any:
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

    # @has_access
    @expose("/get_table/<int:table>/", methods=["GET", "POST"])
    def get_table(self, table: Any) -> FlaskResponse:
        if table:
            try:
                print(table)
                table = get_table_by_id(table)
                engine_db = get_db_engine(table.database_id, table.schema)
                db = get_db(table.database_id)
                table_info = get_table_metadata(db, table.table_name, table.schema)
                columns = table_info["columns"]

                with engine_db.connect() as conn:
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
                    print(time_range)
                    query = self.build_query_sql(query, time_range, table)

                    df = pd.read_sql_query(query, conn)

                response_data = {
                    "status": "success",
                    "data": df.replace({np.nan: None}).to_dict(orient="records"),
                    "columns": columns,
                }

                return jsonify(response_data)
            except BaseException as e:
                print(str(e))
                response_data = {"status": "error", "data": str(e)}

                return jsonify(response_data)

        return jsonify({}), 404

    # @csrf.exempt
    @expose("/editor_table/<int:slice_id>/", methods=["GET"])
    def editor_table_slice(self, slice_id: int) -> FlaskResponse:
        # Находим виджет
        session = current_app.appbuilder
        slice = session.get_session.query(Slice).get(slice_id)
        # находим таблицу
        table = slice.table
        # находим колонки по таблице
        columns = (
            session.get_session.query(TableColumn)
            .filter(TableColumn.table_id == table.id)
            .all()
        )
        # находим связанные колонки и таблицы
        reference_tables = []
        for col in columns:
            if col.reference_table and col.reference_column:
                table = get_table_by_id(col.reference_table)

                columns = (
                    session.get_session.query(TableColumn)
                    .filter(TableColumn.table_id == table.id)
                    .all()
                )
                description_col = {}
                for column_desc in columns:
                    description_col[column_desc.column_name] = column_desc.description

                db = get_db(table.database_id)
                table_info = get_table_metadata(db, table.table_name, table.schema)
                if table_info.get("columns"):
                    for column_info in table_info["columns"]:
                        column_info["description"] = description_col[
                            column_info["name"]
                        ]

                engine_db = get_db_engine(table.database_id, table.schema)
                col_desc = table_info["columns"][0]["name"]
                print(col_desc)
                insert_query = (
                    table_info["selectStar"].split("LIMIT")[0]
                    + f'ORDER BY "{col_desc}" DESC LIMIT 1;'
                )
                query = text(insert_query)
                with engine_db.connect() as conn:
                    result = conn.execute(query)
                    columns = result.keys()

                    print(columns)
                    # Выводим результаты
                    for row in result:
                        dict_row = dict(zip(columns, row))
                print(dict_row)

                table_info.update(
                    {"id_table": col.reference_table, "table_data": dict_row}
                )

                reference_tables.append(table_info)

        return jsonify(reference_tables), 200

    @csrf.exempt
    @expose("/editor_table_insert/", methods=["POST"])
    def editor_table(self) -> FlaskResponse:
        """
        request data
        {
           "id_table": 1
           "data": {
               "key": value
               ...
           }
        }

        """
        data = request.json
        id_table = data.get("id_table")
        data_query = data.get("data")

        table = get_table_by_id(id_table)
        engine_db = get_db_engine(table.database_id, table.schema)

        keys = list(data_query.keys())

        qute_keys = '","'.join(keys)
        column = f'("{qute_keys}")'
        values_column = f'(:{",:".join(keys)})'
        print(data)
        insert_query = (
            f'INSERT INTO "{table.table_name}" {column} VALUES {values_column};'
        )
        query = text(insert_query)
        try:
            with engine_db.begin() as conn:
                conn.execute(query, **data_query)
        except Exception as e:
            print(e)
            return jsonify({"errors": str(e)}), 400
        return jsonify({}), 200
