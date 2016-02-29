#
# Copyright (c) 2016, Prometheus Research, LLC
#


from htsql.core import domain

from rex.action import typing
from rex.core import Validate, Error
from rex.core import RecordVal, SeqVal, StrVal, OneOfVal
from rex.mart import MartAccessPermissions
from rex.web import authenticate
from rex.widget import Field, computed_field, raw_widget

from .base import MartAction
from .filter import MartIntroAction
from .tool import MartTool


__all__ = (
    'GuideIntroAction',
    'GuideFilterAction',
    'GuideProjectAction',
    'GuideExportAction',
)


def reflect_table_fields(database, table):
    product = database.produce('/%s/:describe' % table)
    fields = product.meta.domain.item_domain.fields
    validate_column = ColumnVal()
    return [validate_column(f.tag) for f in fields]


class FilterVal(Validate):
    _validate = RecordVal(
        ('title', StrVal(), None),
        ('hint', StrVal(), None),
        ('expression', StrVal()),
    )

    def __call__(self, value):
        return self._validate(value)


class ColumnVal(Validate):
    _validate_record = RecordVal(
        ('title', StrVal(), None),
        ('expression', StrVal()),
    )

    _validate = OneOfVal(StrVal(), _validate_record)

    def __call__(self, value):
        if isinstance(value, self._validate_record.record_type):
            return value
        if isinstance(value, basestring):
            value = {'title': value, 'expression': value}
        return self._validate(value)


class GuideMartTool(MartTool):
    name = 'guide'

    @classmethod
    def is_enabled_for_mart(cls, mart):
        return True


class GuideIntroAction(MartIntroAction):
    name = 'mart-guide'
    tool = 'guide'

    def __init__(self, **values):
        super(GuideIntroAction, self).__init__(**values)
        if not self.icon:
            self.icon = 'bookmark'


class GuideAction(MartAction):
    definition = Field(
        StrVal(),
        doc="""
        Mart Definiton to use.
        """)

    table = Field(
        StrVal(),
        doc="""
        Mart table to query.
        """)

    @computed_field
    def table_fields(self, req):
        mart = self.get_mart_for_reflection(req)
        if not mart:
            return None
        database = self.get_mart_db(mart)
        return reflect_table_fields(database, self.table)

    def get_mart_for_reflection(self, req):
        user = authenticate(req)
        permissions = MartAccessPermissions.top()
        marts = permissions.get_marts_for_user(
            user,
            definition_id=self.definition,
        )
        return marts[0] if marts else None

    def context(self):
        ictx = {'mart': typing.number}
        ictx.update({
            self.get_definition_context(self.definition): typing.anytype,
        })
        octx = {}
        return ictx, octx


FILTERS = {
    domain.BooleanDomain: {
        'widget': 'rex-mart-actions/lib/guide/filter/BooleanFilter',
    },
    domain.TextDomain: {
        'widget': 'rex-mart-actions/lib/guide/filter/TextFilter',
    },
    domain.EnumDomain: {
        'widget': 'rex-mart-actions/lib/guide/filter/EnumFilter',
        'props': lambda d: {'labels': d.labels},
    },
}


class GuideFilterAction(GuideAction):
    """
    Allows a user to choose from a list of configured filters to apply to their
    query.
    """

    name = 'mart-guide-filter'
    js_type = 'rex-mart-actions/lib/guide/FilterDataset'

    filters = Field(
        SeqVal(FilterVal()),
        transitionable=False,
        doc="""
        Filter definitions.
        """)

    @computed_field
    def filter_elements(self, req):
        mart = self.get_mart_for_reflection(req)
        if not mart:
            return None

        database = self.get_mart_db(mart)
        query = '/%s{%s}/:describe' % (
            self.table,
            ', '.join(f.expression for f in self.filters),
        )
        meta = database.produce(query).meta.domain.item_domain

        compiled = []
        for field, filt in zip(meta.fields, self.filters):
            cfg = FILTERS.get(field.domain.__class__)
            if not cfg:
                raise Error(
                    'filter expression type is not currently supported:',
                    filt.expression,
                )

            props = {
                'title': filt.title,
                'expression': filt.expression,
            }
            if cfg.get('props'):
                props.update(cfg['props'](field.domain))

            widget = raw_widget(
                cfg['widget'],
                **props
            )
            compiled.append(widget)

        return compiled


class GuideProjectAction(GuideAction):
    """
    Allows a user to select the columns to return in their query.
    """

    name = 'mart-guide-project'
    js_type = 'rex-mart-actions/lib/guide/ProjectDataset'

    fields = Field(
        SeqVal(ColumnVal()), default=[],
        transitionable=False,
        doc="""
        Column definitions.
        """)

    @computed_field
    def all_fields(self, req):
        mart = self.get_mart_for_reflection(req)
        if not mart:
            return None
        database = self.get_mart_db(mart)
        return reflect_table_fields(database, self.table) + self.fields


class GuideExportAction(GuideAction):
    """
    Allows a user to download the results of their query as a file.
    """

    name = 'mart-guide-export'
    js_type = 'rex-mart-actions/lib/guide/ExportDataset'

    fields = Field(
        SeqVal(ColumnVal()), default=[],
        doc="""
        Column definitions.
        """)

