from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text


class QrCodeTable(Model):
    __tablename__ = "qr_code"

    id = Column(Integer, primary_key=True)
    comments = Column(Text, nullable=True)
    coordinates = Column(Text, nullable=True)
    filename = Column(String(300), nullable=True)
