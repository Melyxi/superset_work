from typing import Any

from flask import current_app
from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import backref, relationship


class Comments(Model):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    sql_query = Column(String(5000), nullable=False)
    column_comment = Column(String(1000), nullable=False)
    reference_column = Column(String(1000), nullable=False)
    text = Column(String(1000), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    time_range = Column(Text, nullable=True)
    short_query = Column(Text, nullable=True)
    column_id = Column(Integer, ForeignKey("table_columns.id"))
    column = relationship(
        "TableColumn",
        backref=backref("columns", cascade="all, delete-orphan"),
        foreign_keys=[column_id],
    )


class FilterQuery(Model):
    """
    FilterQuery in comments
    """

    __tablename__ = "filter_query"

    id = Column(Integer, primary_key=True)
    name = Column(String(5000), nullable=False, unique=True)
    query = Column(String(5000), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)

    @classmethod
    def get_by_id(cls, pk: int) -> "FilterQuery":
        """
        get FilterQuery object
        """
        return current_app.appbuilder.get_session.query(cls).get(pk)

    @classmethod
    def get_all(cls) -> Any:
        """
        all FilterQuery object
        """
        return current_app.appbuilder.get_session.query(cls).all()
