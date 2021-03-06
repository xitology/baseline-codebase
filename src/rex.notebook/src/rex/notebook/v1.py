"""

    rex.notebook.v1
    ===============

    Prelude for Rex Jupyter Kernel v1.

    Contains most used utilities for working with Rex.

    :copyright: 2019-present Prometheus Research, LLC

"""

import pandas as pd
import numpy as np  # pandas depends on numpy
from htsql.core import domain
import rex.db
import rex.query
import rex.core

__all__ = ("get_db", "q")


def domain_to_dtype(dom):
    if isinstance(dom, domain.DateDomain):
        return "datetime64[ns]"
    elif isinstance(dom, domain.DateTimeDomain):
        return "datetime64[ns]"
    elif isinstance(dom, domain.BooleanDomain):
        return np.bool
    elif isinstance(dom, domain.IntegerDomain):
        return pd.Int64Dtype()  # this can handle None values
    elif isinstance(dom, domain.FloatDomain):
        return np.float
    elif isinstance(dom, domain.EnumDomain):
        return "category"
    else:
        return "object"


def product_to_df(product):
    data = product.data
    dom = product.meta.domain
    if not isinstance(dom, domain.ListDomain):
        dom = domain.ListDomain(dom)
        data = [data]

    if isinstance(dom.item_domain, domain.RecordDomain):
        columns = []
        dtypes = {}
        for field in dom.item_domain.fields:
            columns.append(field.tag)
            dtypes[field.tag] = domain_to_dtype(field.domain)
        df = pd.DataFrame(data=data, columns=columns)
        df = df.astype(dtypes)
        return df
    else:
        df = pd.DataFrame(data=data)
        df = df.astype(domain_to_dtype(dom.item_domain))
        return df


class Q(rex.query.Q):
    def to_df(self, variables=None, db=None):
        """ Execute query and produce :class:`pandas.DataFrame`."""
        product = self.produce(variables=variables, db=db)
        return product_to_df(product)


class RexNotebookHTSQL(rex.db.RexHTSQL):
    @property
    def q(self):
        """ Query database using Query Builder API.

        Example::

            >>> users = db.q.user.to_df()

        """
        return Q(db=self)

    def produce_df(self, *args, **kwargs):
        """ Produce :class:`pandas.DataFrame` out of HTSQL query.

        Example::

            >>> users = db.produce_df("/user")

        """
        product = self.produce(*args, **kwargs)
        return product_to_df(product)


@rex.core.cached
def get_db(spec=None):
    """
    Builds and returns an HTSQL instance.

    ``spec``
        If ``spec`` is not provided then the primary application database is
        returned.

        If ``spec`` is provided and in the fprm of database URI then it is
        used to connect to the database.

        If ``spec`` is provided and in the form of ``mart:DEFINITION`` then the
        connection to a corresponding mart definition is created.

        Otherwise, returns the named gateway.  If the gateway is not configured,
        raises :exc:`KeyError`.
    """
    if spec is None:
        return RexNotebookHTSQL.configure(name=spec)
    if spec.startswith("mart:"):
        definition = spec[5:] # stripping 'mart:' prefix here
        return get_mart_db(definition)
    else:
        validate = rex.db.setting.HTSQLVal()
        try:
            uri = validate(spec)
        except rex.core.Error:
            uri = None
        if uri is None:
            return RexNotebookHTSQL.configure(name=spec)
        else:
            ext = {"rex_deploy": {}, "tweak.meta": {}}
            uri = uri['htsql']['db']
            return RexNotebookHTSQL(uri, ext)


def get_mart_db(definition):
    try:
        import rex.mart
    except ImportError:
        raise rex.core.Error(
            "rex.mart package is not included with the application"
        )

    db = get_db()
    data = (
        db.q.rexmart_inventory.filter(q.definition == definition)
        .filter(q.status == "complete")
        .sort(q.date_creation_started.desc())
        .first()
        .to_data()
    )
    if not data:
        raise rex.core.Error("No mart found for definition:", definition)
    uri = db.htsql.db.clone(database=str(data.name))
    ext = {"rex_deploy": {}, "tweak.meta": {}}
    return RexNotebookHTSQL(uri, ext)


#: Query Builder API
q = Q()
