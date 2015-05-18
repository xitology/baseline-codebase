#
# Copyright (c) 2015, Prometheus Research, LLC
#


from copy import deepcopy

from prismh.core import validate_interaction, \
    ValidationError as PrismhValidationError

from rex.core import Extension, AnyVal
from rex.instrument.interface import InstrumentVersion, Channel
from rex.instrument.mixins import Comparable, Displayable, Dictable
from rex.instrument.util import to_unicode, memoized_property, \
    get_implementation

from ..errors import ValidationError
from ..output import dump_interaction_yaml, dump_interaction_json

from copy import deepcopy


__all__ = (
    'Interaction',
)


class Interaction(Extension, Comparable, Displayable, Dictable):
    """
    Represents an SMS Interaction Configuration for a Channel of an
    InstrumentVersion.
    """

    dict_properties = (
        'channel',
        'instrument_version',
    )

    @classmethod
    def validate_configuration(cls, configuration, instrument_definition=None):
        """
        Validates that the specified configuration is a legal SMS Interaction
        Configuration.

        :param configuration: the Interaction configuration to validate
        :type configuration: string or dict
        :param instrument_definition:
            the Common Instrument Definition that the Interaction should be
            validated against
        :type instrument_definition: dict or JSON string
        :raises:
            ValidationError if the specified configuration fails any of the
            requirements
        """

        if isinstance(configuration, basestring):
            try:
                configuration = AnyVal().parse(configuration)
            except ValueError as exc:
                raise ValidationError(
                    'Invalid JSON provided: %s' % unicode(exc)
                )
        if not isinstance(configuration, dict):
            raise ValidationError(
                'Interaction Configurations must be mapped objects.'
            )

        if instrument_definition:
            if isinstance(instrument_definition, basestring):
                try:
                    instrument_definition = AnyVal().parse(
                        instrument_definition
                    )
                except ValueError as exc:
                    raise ValidationError(
                        'Invalid Instrument JSON provided: %s' % unicode(exc)
                    )
            if not isinstance(instrument_definition, dict):
                raise ValidationError(
                    'Instrument Definitions must be mapped objects.'
                )

        try:
            validate_interaction(
                configuration,
                instrument=instrument_definition,
            )
        except PrismhValidationError as exc:
            msg = [
                'The following problems were encountered when validating this'
                ' Interaction:',
            ]
            for key, details in exc.asdict().items():
                msg.append('%s: %s' % (
                    key or '<root>',
                    details,
                ))
            raise ValidationError('\n'.join(msg))


    @classmethod
    def get_by_uid(cls, uid, user=None):
        """
        Retrieves an Interaction from the datastore using its UID.

        Must be implemented by concrete classes.

        :param uid: the UID of the Interaction to retrieve
        :type uid: string
        :param user: the User who should have access to the desired Interaction
        :type user: User
        :raises:
            DataStoreError if there was an error reading from the datastore
        :returns:
            the specified Interaction; None if the specified UID does not exist
        :rtype: Interaction
        """

        raise NotImplementedError()

    @classmethod
    def get_for_task(cls, task, channel, user=None):
        """
        Returns the Interaction to use for the specified combination of Task
        and Channel.

        :param task: the Task the Interaction needs to operate on
        :type task: Task
        :param channel: the Channel the Interaction must be configured for
        :type channel: Channel
        :param user: the User who should have access to the desired Interaction
        :type user: User
        :raises:
            DataStoreError if there was an error reading from the datastore
        :rtype: Interaction
        """

        interactions = cls.find(
            channel=channel,
            instrument_version=task.instrument_version,
            user=user,
            limit=1,
        )
        if interactions:
            return interactions[0]

        return None

    @classmethod
    def find(cls, offset=0, limit=None, user=None, **search_criteria):
        """
        Returns Interactions that match the specified criteria.

        ``search_criteria`` for this method will (at a minimum) support:

        * channel (UID or instance; exact matches)
        * instrument_version (UID or instance; exact matches)

        Must be implemented by concrete classes.

        :param offset:
            the offset in the list of Interactions to start the return set from
            (useful for pagination purposes); if not specified, defaults to 0
        :type offset: int
        :param limit:
            the maximum number of Interactions to return (useful for pagination
            purposes); if not specified, defaults to ``None``, which means no
            limit
        :type limit: int
        :param user: the User who should have access to the desired Interaction
        :type user: User
        :raises:
            DataStoreError if there was an error reading from the datastore
        :rtype: list of Interactions
        """

        raise NotImplementedError()

    @classmethod
    def create(cls, channel, instrument_version, configuration):
        """
        Creates a Interaction in the datastore and returns a corresponding
        Interaction instance.

        Must be implemented by concrete classes.

        :param channel: the Channel the Interaction will belong to
        :type channel: Channel
        :param instrument_version:
            the InstrumentVersion the Interaction is an implementation of
        :type instrument_version: InstrumentVersion
        :param configuration:
            the JSON SMS Interation Configuration for the Interaction
        :type configuration: dict or JSON string
        :raises:
            DataStoreError if there was an error writing to the datastore
        :rtype: Interaction
        """

        raise NotImplementedError()

    def __init__(self, uid, channel, instrument_version, configuration):
        self._uid = to_unicode(uid)

        if not isinstance(channel, (Channel, basestring)):
            raise ValueError(
                'channel must be an instance of Channel or a UID of one'
            )
        self._channel = channel

        if not isinstance(instrument_version, (InstrumentVersion, basestring)):
            raise ValueError(
                'instrument_version must be an instance of InstrumentVersion'
                ' or a UID of one'
            )
        self._instrument_version = instrument_version

        if isinstance(configuration, basestring):
            self._configuration = AnyVal().parse(configuration)
        else:
            self._configuration = deepcopy(configuration)

    @property
    def uid(self):
        """
        The Unique Identifier that represents this Interaction in the
        datastore. Read only.

        :rtype: unicode
        """

        return self._uid

    @memoized_property
    def channel(self):
        """
        The Channel that this Interaction belongs to. Read only.

        :rtype: Channel
        """

        if isinstance(self._channel, basestring):
            channel_impl = get_implementation('channel')
            return channel_impl.get_by_uid(self._channel)
        else:
            return self._channel

    @memoized_property
    def instrument_version(self):
        """
        The InstrumentVersion that this Interaction is an implementation of.
        Read only.

        :rtype: InstrumentVersion
        """

        if isinstance(self._instrument_version, basestring):
            iv_impl = get_implementation('instrumentversion')
            return iv_impl.get_by_uid(self._instrument_version)
        else:
            return self._instrument_version

    @property
    def configuration(self):
        """
        The SMS Interaction Configuration of this Interaction.

        :rtype: dict
        """

        return self._configuration

    @configuration.setter
    def configuration(self, value):
        self._configuration = deepcopy(value)

    @property
    def configuration_json(self):
        """
        The SMS Interaction Configuration of this Interaction.

        :rtype: JSON-encoded string
        """

        return dump_interaction_json(self._configuration)

    @configuration_json.setter
    def configuration_json(self, value):
        self.configuration = AnyVal().parse(value)

    @property
    def configuration_yaml(self):
        """
        The SMS Interaction Configuration of this Interaction.

        :rtype: YAML-encoded string
        """

        return dump_interaction_yaml(self._configuration)

    @configuration_yaml.setter
    def configuration_yaml(self, value):
        self.configuration = AnyVal().parse(value)

    def validate(self, instrument_definition=None):
        """
        Validates that this Interaction is a legal SMS Interaction
        Configuration.

        :param instrument_definition:
            the Common Instrument Definition that the Interaction should be
            validated against; if not specified, the definition found on the
            InstrumentVersion associated with this Interaction will be used
        :type instrument_definition: dict or JSON string
        :raises:
            ValidationError if the Interaction fails any of the requirements
        """

        if (not instrument_definition) and self.instrument_version:
            instrument_definition = self.instrument_version.definition

        return self.__class__.validate_configuration(
            self.configuration,
            instrument_definition=instrument_definition,
        )

    def save(self):
        """
        Persists the Interaction into the datastore.

        Must be implemented by concrete classes.

        :raises:
            DataStoreError if there was an error writing to the datastore
        """

        raise NotImplementedError()

    def get_display_name(self):
        """
        Returns a unicode string that represents this Interaction, suitable for
        use in human-visible places.

        :rtype: unicode
        """

        return unicode(self.instrument_version)

    def __repr__(self):
        return '%s(%r, %r, %r)' % (
            self.__class__.__name__,
            self.uid,
            self.channel,
            self.instrument_version,
        )

