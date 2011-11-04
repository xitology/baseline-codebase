#
# Copyright (c) 2006-2011, Prometheus Research, LLC
# See `LICENSE` for license information, `AUTHORS` for the list of authors.
#


from . import bind, coerce, encode, domain, signature
from htsql.addon import Addon


class TweakINetAddon(Addon):

    name = 'tweak.inet'
    hint = """add support for IPv4 data type"""
    help = """
    This addon adds support for IPv4 data type.  The addon implements:

    - `inet()` constructor which accepts literals in standard IPv4
      dotted notation;
    - standard comparison operators for `inet` values;
    - conversion of `inet` values from/to `string` and `integer` values;
    - arithmetic operations: `inet-integer`, `inet+integer`,
      `inet-inet`.

    Currently, only PostgreSQL backend is supported.
    """

    @classmethod
    def get_extension(cls, app, attributes):
        return 'tweak.inet.%s' % app.htsql.db.engine


