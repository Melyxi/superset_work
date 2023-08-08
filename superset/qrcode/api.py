import base64
import json
import logging
from typing import Union

from flask import current_app
from flask_appbuilder.api import BaseApi, expose, safe
from flask_appbuilder.security.decorators import protect
from flask_babel import lazy_gettext as _

from superset import is_feature_enabled
from superset.config import IMG_UPLOAD_FOLDER
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.commands.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.qrcode.models import QrCodeTable
from superset.superset_typing import FlaskResponse

logger = logging.getLogger(__name__)


class QrCodeApi(BaseApi):
    """
    view for qrcode for mobil app
    """

    route_base = "/api/v1/"

    # base_permissions = ['can_get_qr_comment']

    @expose("/get_comments/<int:id_qr>/")
    @protect(allow_browser_login=False)
    @safe
    def get_qr_comment(self, id_qr: Union[int, None] = None) -> FlaskResponse:
        if id_qr:
            qr_code = current_app.appbuilder.get_session.query(QrCodeTable).get(id_qr)
            if qr_code:
                if qr_code.comments and qr_code.coordinates:
                    file_dashboard = json.loads(qr_code.filename)[1]
                    with open(f"{IMG_UPLOAD_FOLDER}{file_dashboard}", "rb") as f:
                        file = base64.b64encode(f.read())

                    comments = json.loads(qr_code.comments)
                    coordinates = json.loads(qr_code.coordinates)
                    id_dashboard = coordinates["header"].get("id_dashboard")
                    if is_feature_enabled("DASHBOARD_RBAC"):
                        try:
                            DashboardDAO.get_by_id_or_slug(id_dashboard)
                        except DashboardAccessDeniedError:
                            logger.warning(_("Dashboard forbidden"))
                            return self.response_403()
                        except DashboardNotFoundError:
                            logger.warning(_("Dashboard not found"))
                            return self.response_404()

                    for coordinate in coordinates["charts"]:
                        for comment in comments:
                            if int(coordinate["slice_id"]) == comment["slice_id"]:
                                coordinate["comments"] = comment["comments"]
                    return self.response(
                        200, **{"coordinates": coordinates, "file": file}
                    )
                else:
                    return self.response(404, **{})

            return self.response(404, **{})

        return self.response(404, **{})
