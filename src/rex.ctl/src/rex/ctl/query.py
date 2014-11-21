#
# Copyright (c) 2013, Prometheus Research, LLC
#


from cogs import task, argument, option
from cogs.log import fail
from .common import make_rex, pair
from .shell import extension
from rex.core import Error, get_packages
from rex.db import get_db
import htsql.core.error
import sys
import os


@task
class QUERY:
    """run an HTSQL query

    The `query` task executes an HTSQL query against the application
    database.

    This task takes one argument: the name of the primary RexDB package.
    Alternatively, the package could be specified using `project` setting.

    Use option `--require` or setting `requirements` to specify additional
    packages to include with the application.

    Use option `--set` or setting `parameters` to specify configuration
    parameters of the application.

    Use option `--extend` (`-E`) to enable an HTSQL extension.

    Use option `--gateway` (`-G`) to connect to a secondary application
    database.

    Use option `--input` (`-i`) to read the query from a file.  If `--input`
    is not provided, the query is read from the standard input.  You may
    specify the option multiple times.

    Use option `--output` (`-o`) to write the query output to a file.

    Use option `--format` (`-f`) to specify the format of the output.
    Valid formats include: `txt`, `html`, `xml`, `csv`, `json`, `raw`.
    """

    project = argument(str, default=None)
    require = option(None, str, default=[], plural=True,
            value_name="PACKAGE",
            hint="include an additional package")
    set = option(None, pair, default={}, plural=True,
            value_name="PARAM=VALUE",
            hint="set a configuration parameter")
    extend = option('E', extension, default=[], plural=True,
            value_name="EXT:PARAM=VALUE",
            hint="include an HTSQL extension")
    gateway = option('G', str, default=None,
            value_name="NAME",
            hint="connect to a gateway database")
    input = option('i', str, default=[], plural=True,
            value_name="FILE",
            hint="read query from a file")
    output = option('o', str, default=None,
            value_name="FILE",
            hint="write query output to a file")
    format = option('f', str, default=None,
            value_name="FORMAT",
            hint="set output format")
    define = option('D', pair, default={}, plural=True,
            value_name="PARAM=VALUE",
            hint="set a query parameter")

    def __init__(self, project, require, set, extend, gateway,
                 input, output, format, define):
        self.project = project
        self.require = require
        self.set = set
        self.extend = list(extend)
        self.gateway = gateway
        self.input = input
        self.output = output
        self.format = format
        self.define = define

    def __call__(self):
        # Build the application and extract HTSQL configuration.
        set_list = dict(self.set)
        if self.extend:
            set_list['htsql_extensions'] = self.extend
        app = make_rex(self.project, self.require, self.set, False,
                       ensure='rex.db')
        try:
            with app:
                db = get_db(self.gateway)
                packages = get_packages()
        except Error, error:
            raise fail(str(error))
        if db is None:
            raise fail("unknown gateway: `{}`", self.gateway)
        if not self.input:
            sources = ['-']
        else:
            sources = self.input
        product = None
        parameters = dict(self.define)
        with db, db.transaction():
            try:
                for source in sources:
                    if source == '-':
                        stream = sys.stdin
                    elif ':' in source and source.split(':')[0] in packages:
                        stream = packages.open(source)
                    else:
                        stream = open(source)
                    product = db.produce(stream, parameters) or product
                if product is not None and (self.format is not None or
                                            self.output is not None):
                    format = self.format or os.path.splitext(self.output)[1][1:]
                    format = db.accept(format)
                    stream = (open(self.output, 'w')
                              if self.output not in [None, '-']
                              else sys.stdout)
                    for chunk in db.emit(format, product):
                        stream.write(chunk)
            except htsql.core.error.Error, error:
                raise fail(str(error))


