import os.path
from typing import Any, Union

import imageio
import imageio.v2 as imv2
import numpy as np
import qrcode
from flask import current_app
from pdf2image import convert_from_path
from sqlalchemy import text

from superset.comments.models import Comments
from superset.config import IMG_UPLOAD_FOLDER
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database

LIMIT_ROWS = 10000


def get_db(pk: int) -> Any:
    return current_app.appbuilder.get_session.query(Database).get(pk)


def get_db_engine(db_pk: Any, schema: Any) -> Any:
    db = get_db(db_pk)
    engine_db = db._get_sqla_engine(schema)
    return engine_db


# try exept
def get_tables_comments() -> list[Any]:
    tables = current_app.appbuilder.get_session.query(SqlaTable).all()
    list_table = []
    for table in tables:
        extra_column: list[Any] = []
        # if table.extra_comments:
        #     for reference_column, comment_column in \
        #         json.loads(table.extra_comments).items():
        #         extra_column.append(reference_column)
        #         extra_column.append(comment_column)
        list_table.append(
            {
                "id": table.id,
                "name": table.table_name,
                "schema": table.schema,
                "database_id": table.database_id,
                "extra_comments": extra_column,
            }
        )

    return list_table


def get_comments() -> Any:
    comments = current_app.appbuilder.get_session.query(Comments).all()
    return comments


def get_sql_query_comments(query: Any, table_id: int, column_comment: str) -> Any:
    table = get_table_by_id(table_id)
    engine = get_db_engine(table.database_id, table.schema)
    with engine.connect() as conn:
        i = conn.execute(text(f"{query} LIMIT {LIMIT_ROWS};"))
    return i


def get_table_by_id(id: Union[int, str]) -> Any:
    return current_app.appbuilder.get_session.query(SqlaTable).get(id)


def get_comment_by_id(id: Union[int, str]) -> Any:
    return current_app.appbuilder.get_session.query(Comments).get(id)


def get_comment_filter_by(**kwargs: Any) -> Any:
    return current_app.appbuilder.get_session.query(Comments).filter_by(**kwargs).all()


def get_column_filter_by(**kwargs: Any) -> Any:
    return (
        current_app.appbuilder.get_session.query(TableColumn).filter_by(**kwargs).all()
    )


def get_column_by(id: int) -> Any:
    return current_app.appbuilder.get_session.query(TableColumn).get(id)


def make_qr_code(filename: str, data: Any) -> None:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=4,
        border=0.5,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(IMG_UPLOAD_FOLDER + f"{filename}")


def create_filename(num_qr: int) -> Any:
    num = num_qr
    one_num, two_num = 1, 1
    if num > 2000:
        flag_prime = True
        while flag_prime:
            for i in range(1, 2000):
                if not num % i and num / i < 2000:
                    one_num = int(num / i)
                    two_num = i

                    flag_prime = False
                    break
            if flag_prime:
                num -= 1
    else:
        one_num = num
        two_num = 1

    prime = False
    if num != num_qr:
        prime = True

    return one_num, two_num, prime


def convert_pdf_in_img(filename_pdf: str, id_image: int) -> str:
    file_name_pdf = f"{IMG_UPLOAD_FOLDER}{filename_pdf}"
    file_name_image = f"{IMG_UPLOAD_FOLDER}pdf_id_image_{id_image}.jpg"

    page = convert_from_path(file_name_pdf)
    page[0].save(file_name_image, "JPEG")

    if os.path.isfile(file_name_pdf):
        os.remove(file_name_pdf)

    return f"pdf_id_image_{id_image}.jpg"
