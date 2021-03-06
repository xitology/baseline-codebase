#
# Copyright (c) 2015, Prometheus Research, LLC
#


from .config import get_definition
from .connections import get_management_db, get_mart_db
from .purging import purge_mart


__all__ = (
    'Mart',
)


class Mart(object):
    """
    Encapsulates the details of a completed Mart instance, and provides some
    actions that can be invoked on that instance.
    """

    @classmethod
    def from_record(cls, record):
        """
        Creates a new Mart instance based on a record retrieved from the
        ``rexmart_inventory`` table.

        :param record: the record to build the Mart instance from
        :type record: htsql.core.domain.Record
        :rtype: Mart
        """

        return cls(
            record.code,
            record.definition,
            record.owner,
            record.name,
            record.date_creation_started,
            record.date_creation_completed,
            record.pinned,
            record.size,
            record.status,
        )

    def __init__(
            self,
            code,
            definition_id,
            owner,
            name,
            date_creation_started,
            date_creation_completed,
            pinned,
            size,
            status):
        self._code = code
        self._definition_id = definition_id
        self._owner = owner
        self._name = name
        self._date_creation_started = date_creation_started
        self._date_creation_completed = date_creation_completed
        self._pinned = pinned
        self._size = size
        self._status = status

    @property
    def code(self):
        """
        The unique ID of the Mart in the system. Read only.

        :rtype: int
        """

        return self._code

    @property
    def definition_id(self):
        """
        The ID of the Definition that was used to create the Mart. Read only.

        :rtype: str
        """

        return self._definition_id

    @property
    def definition(self):
        """
        The Definition that was used to create the Mart. Read only.

        :rtype: dict
        """

        return get_definition(self.definition_id)

    @property
    def owner(self):
        """
        The owner of the Mart. Read only.

        :rtype: str
        """

        return self._owner

    @property
    def name(self):
        """
        The name of the database that contains the Mart. Read only.

        :rtype: str
        """

        return self._name

    @property
    def date_creation_started(self):
        """
        The date/time when the creation process for the Mart started. Read
        only.

        :rtype: datetime.datetime
        """

        return self._date_creation_started

    @property
    def date_creation_completed(self):
        """
        The date/time when the creation process for the Mart completed. Read
        only.

        :rtype: datetime.datetime
        """

        return self._date_creation_completed

    @property
    def pinned(self):
        """
        Indicates whether or not this Mart is "pinned", meaning that automated
        purging processes will ignore this Mart.

        :rtype: bool
        """

        return self._pinned

    @pinned.setter
    def pinned(self, value):
        if not isinstance(value, bool):
            raise ValueError('The value of pinned must be boolean')
        if value != self.pinned:
            get_management_db().produce(
                '/rexmart_inventory[$code]{id(), $pinned :as pinned}/:update',
                code=self.code,
                pinned=value,
            )
        self._pinned = value

    @property
    def size(self):
        """
        The size of the database that contains the Mart in bytes. Read only.

        :rtype: int
        """

        return self._size

    @property
    def status(self):
        """
        The creation state of the Mart. Read only.

        :rtype: str
        """

        return self._status

    @property
    def usable(self):
        """
        Indicates whether or not this Mart has finished the creation process
        and can be used by an end-user. Read only.

        :rtype: bool
        """

        return self.status == 'complete'

    def purge(self):
        """
        Deletes the Mart and its associated inventory record from the system.
        """

        purge_mart(self.code)

    def get_htsql(self, extensions=None):
        """
        Retrieves an HTSQL connection to the Mart database.

        :param extensions:
            the HTSQL extensions to enable/configure, in addition to those
            defined by the ``mart_htsql_extension`` setting
        :type extensions: dict
        :rtype: rex.db.RexHTSQL
        """

        return get_mart_db(self.name, extensions=extensions)

    def as_dict(self, json_safe=False):
        """
        Creates a dictionary representation of the data in this object.

        :param json_safe:
            indicates whether or not the values stored in resulting dict should
            be compatible with the default JSON encoder. If not specified,
            defaults to True
        :type json_safe: bool

        :rtype: dict
        """

        result = {
            'code': self.code,
            'definition': self.definition_id,
            'owner': self.owner,
            'name': self.name,
            'date_creation_started': self.date_creation_started,
            'date_creation_completed': self.date_creation_completed,
            'pinned': self.pinned,
            'size': self.size,
            'status': self.status,
        }

        if json_safe:
            result['date_creation_started'] = \
                result['date_creation_started'].strftime('%Y-%m-%dT%H:%M:%S')
            result['date_creation_completed'] = \
                result['date_creation_completed'].strftime('%Y-%m-%dT%H:%M:%S')

        return result

    def __repr__(self):
        return 'Mart(code=%r, definition=%r, owner=%r)' % (
            self.code,
            self.definition_id,
            self.owner,
        )

