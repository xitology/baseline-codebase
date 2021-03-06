
from rex.core import StrVal
from rex.web import Command, Parameter
from rex.db import get_db, Query
from webob import Response
from webob.exc import HTTPNotFound

class DepartmentByIDCommand(Command):

    path = '/department_by_id'
    access = 'anybody'
    parameters = [
            Parameter('id', StrVal(r'\w+')),
    ]

    def render(self, req, id):
        db = get_db()
        department = db.produce("department[$id]", id=id)
        if not department:
            raise HTTPNotFound()
        return Response(json={"code": department.data.code,
                              "name": department.data.name})


class CampusesCommand(Command):

    path = '/campuses'
    access = 'anybody'

    def render(self, req):
        query = Query("/school^campus :as campuses")
        body = query.format('html')
        return Response(body=body)


def answer_query(session):
    db = get_db()
    return db.produce("2+2")

