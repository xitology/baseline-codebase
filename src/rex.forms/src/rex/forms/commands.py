#
# Copyright (c) 2016, Prometheus Research, LLC
#


import json

from webob import Response
from webob.exc import HTTPNotFound, HTTPBadRequest, HTTPUnauthorized

from rex.core import StrVal
from rex.db import get_db
from rex.instrument import User, InstrumentError
from rex.web import Command, Parameter, authenticate

from .implementation.lookup import REGISTRY
from .util import preview_calculation_results


__all__ = (
    'LookupCommand',
    'PreviewCalculationCommand',
)


# pylint: disable=abstract-method


class LookupCommand(Command):
    path = '/lookup'
    parameters = (
        Parameter('lookup', StrVal()),
        Parameter('query', StrVal(), None),
    )

    def render(self, request, lookup, query):
        # pylint: disable=arguments-differ,unused-argument

        lookup_query = REGISTRY.get_query(lookup)
        if not lookup_query:
            raise HTTPNotFound('Unknown lookup ID "%s"' % (lookup,))

        data = get_db().produce(lookup_query, search=query)
        hits = []
        for rec in data:
            hits.append({
                'value': rec.value,
                'label': rec.label,
            })

        return Response(json={'values': hits})


class PreviewCalculationCommand(Command):
    path = '/calculate/instrument/{instrumentversion_id}'
    parameters = (
        Parameter('instrumentversion_id', StrVal()),
        Parameter('data', StrVal()),
    )

    def render(self, request, instrumentversion_id, data):
        # pylint: disable=arguments-differ

        # Get the User
        login = authenticate(request)
        user = User.get_implementation().get_by_login(login)
        if not user:
            raise HTTPUnauthorized()

        # Parse the Assessment Data
        try:
            data = json.loads(data)
        except ValueError as exc:
            raise HTTPBadRequest(exc.doc)

        # Get the InstrumentVersion
        instrument_version = user.get_object_by_uid(
            instrumentversion_id,
            'instrumentversion',
        )
        if not instrument_version:
            raise HTTPNotFound()

        try:
            results = preview_calculation_results(
                instrument_version,
                instrument_version.calculation_set,
                data,
            )
        except InstrumentError as exc:
            raise HTTPBadRequest(exc.message)
        else:
            return Response(json={
                'results': results,
            })


class PreviewCalculationAssessmentCommand(PreviewCalculationCommand):
    path = '/calculate/assessment/{assessment_id}'
    parameters = (
        Parameter('assessment_id', StrVal()),
        Parameter('data', StrVal()),
    )

    def render(self, request, assessment_id, data):
        # pylint: disable=arguments-differ

        # Get the User
        login = authenticate(request)
        user = User.get_implementation().get_by_login(login)
        if not user:
            raise HTTPUnauthorized()

        # Parse the Assessment Data
        try:
            data = json.loads(data)
        except ValueError as exc:
            raise HTTPBadRequest(exc.doc)

        # Get the Assessment
        assessment = user.get_object_by_uid(assessment_id, 'assessment')
        if not assessment:
            raise HTTPNotFound()

        try:
            results = preview_calculation_results(
                assessment.instrument_version,
                assessment.instrument_version.calculation_set,
                data,
                assessment=assessment,
            )
        except InstrumentError as exc:
            raise HTTPBadRequest(exc.message)
        else:
            return Response(json={
                'results': results,
            })

