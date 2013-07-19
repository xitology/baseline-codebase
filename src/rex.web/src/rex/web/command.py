#
# Copyright (c) 2013, Prometheus Research, LLC
#


from rex.core import Error, guard
from .auth import authorize
from .handle import HandleLocation
from webob.exc import HTTPUnauthorized
import copy


class Parameter(object):
    """
    Describes a form parameter.

    `name`
        Parameter name.
    `validate`
        Callable that validates and normalizes a raw parameter value.
    `default`
        The value to use if the parameter is not provided.  If not set,
        the parameter is mandatory.
    `many`
        If set, allow more than one value for the parameter.  All values
        are passed as a list.
    """

    class _required_type(object):
        # For `sphinx.ext.autodoc`.
        def __repr__(self):
            return "REQUIRED"

    REQUIRED = _required_type()

    def __init__(self, name, validate, default=REQUIRED, many=False):
        self.name = name
        self.validate = validate
        self.default = default
        self.many = many

    def __repr__(self):
        args = []
        args.append(repr(self.name))
        args.append("validate=%r" % self.validate)
        if self.default is not self.REQUIRED:
            args.append("default=%r" % self.default)
        if self.many is not False:
            args.append("many=%r" % self.many)
        return "%s(%s)" % (self.__class__.__name__, ", ".join(args))


class Command(HandleLocation):
    """
    Variant of :class:`.HandleLocation` with support for authorization and
    parameter parsing.
    """

    #: Location of the command.
    path = None
    #: Permission to execute the command.
    access = 'authenticated'
    #: List of form parameters.
    parameters = []

    @classmethod
    def sanitize(cls):
        if cls.path is not None:
            assert cls.render != Command.render, \
                    "abstract method %s.render()" % cls

    def __call__(self, req):
        self.authorize(req)
        try:
            arguments = self.parse(req)
        except Error, error:
            # Report the error in the response.
            return req.get_response(error)
        return self.render(req, **arguments)

    def authorize(self, req):
        # Checks if we have right permissions to execute the command.
        if self.access is not None:
            if not authorize(req, self.access):
                raise HTTPUnauthorized()

    def parse(self, req):
        # Parses query parameters.

        if self.parameters is None:
            # Skip parsing.
            return {}

        arguments = {}
        # Reject unknown paramerers.
        valid_keys = set(parameter.name for parameter in self.parameters)
        for key in req.params.keys():
            if key not in valid_keys:
                raise Error("Received unexpected parameter:", key)
        # Process expected parameters.
        for parameter in self.parameters:
            all_values = req.params.getall(parameter.name)
            if not all_values and parameter.default is Parameter.REQUIRED:
                # Missing mandatory parameter.
                raise Error("Cannot find parameter:", parameter.name)
            elif not all_values:
                # Missing optional parameter.
                value = copy.deepcopy(parameter.default)
            elif len(all_values) > 1 and not parameter.many:
                # Multiple values for a singular parameter.
                raise Error("Got multiple values for a parameter:",
                            parameter.name)
            else:
                with guard("While parsing parameter:", parameter.name):
                    all_values = [parameter.validate(value)
                                  for value in all_values]
                if parameter.many:
                    value = all_values
                else:
                    [value] = all_values
            arguments[parameter.name] = value

        return arguments

    def render(self, req, **arguments):
        """
        Processes the incoming request and parsed form parameters; returns HTTP
        response.

        Implementations must override this method.
        """
        raise NotImplementedError("%s.render()" % self.__class__.__name__)


