"""

    rex.widget
    ==========

    This package provides a widget toolkit for the RexDB platform.

    :copyright: 2014, Prometheus Research, LLC

"""

from __future__ import absolute_import

from rex.core import Setting

from .widget import Widget, NullWidget, GroupWidget
from .action import Action
from .field import IDField, Field, StateField, URLField
from .field import CollectionField, EntityField
from .parse import WidgetDescVal
from .validate import WidgetVal
from .library import Page
from .state import Reference, State, Dep, Unknown, unknown, Reset
from .jsval import JSVal
from .urlmap import WidgetRenderer
from .commands import *
from .template import WidgetTemplate, parse as parse_template

import rex.widget.modern.library


def parse(stream):
    """ Parse YAML stream into a widget instance.

    :param stream: YAML stream to parse
    :type stream: str, unicode, object with read() (e.g. open file)

    :return: widget instance
    :rtype: instance of rex.widget.widget.Widget
    """
    if isinstance(stream, (str, unicode)) or hasattr(stream, 'read'):
        parser = WidgetDescVal()
        stream = parser.parse(stream)
    validator = WidgetVal()
    return validator(stream)


class Logging(Setting):
    """ Parameter specifies logging configuration."""

    name = 'logging'

    def __call__(self, config):
        if config:
            config = dict(*config)
            import logging.config
            logging.config.dictConfig(config)
