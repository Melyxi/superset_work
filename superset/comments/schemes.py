import json
from typing import Any

from marshmallow import Schema

from superset.comments.utils import get_column_by, get_table_by_id


class CommentSchema(Schema):
    class Meta:
        fields = (
            "sql_query",
            "text",
            "id",
            "table_id",
            "short_query",
            "time_range",
            "column_id",
        )

    @staticmethod
    def short_query(data: dict[str, str]) -> None:
        index_where = data["sql_query"].find("WHERE")
        res_query = data["sql_query"][index_where + 5 :].replace(";", "").strip()

        data["short_sql_query"] = res_query

    def dump(self, *args: Any, **kwargs: Any) -> Any:
        data = super().dump(*args, **kwargs)
        if not self.many:
            data["time_range"] = (
                None if data["time_range"] is None else json.loads(data["time_range"])
            )
            column_comment = get_column_by(data["column_id"])
            table = get_table_by_id(data["table_id"])
            data["column_comment"] = (
                column_comment.column_name + table.get_postfix_comment()
            )
            self.short_query(data)
        else:
            for item in data:
                column_comment = get_column_by(item["column_id"])
                table = get_table_by_id(item["table_id"])
                item["column_comment"] = (
                    column_comment.column_name + table.get_postfix_comment()
                )
                item["time_range"] = (
                    None
                    if item["time_range"] is None
                    else json.loads(item["time_range"])
                )
                self.short_query(item)
        return data


comment_schema = CommentSchema()
comments_schema = CommentSchema(many=True)


class FilterSchema(Schema):
    class Meta:
        fields = ("id", "name", "query", "table_id")


filter_schema = FilterSchema()
filters_schema = FilterSchema(many=True)
