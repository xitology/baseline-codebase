#
# Copyright (c) 2013, Prometheus Research, LLC
#


from .context import get_rex
from .cache import Cache, cached
from .extension import Extension
from .package import get_packages
from .setting import get_settings
from .wsgi import get_wsgi
from .error import Error


class Rex(object):
    """
    Creates a RexDB application.

    `requirements`
        Packages to include.  Each requirement is one of:

        * a :class:`.Package` object;
        * a requirement specification in format understood by ``setuptools``;
        * a module name;
        * a path to a directory (must end with ``/``).

    `parameters`
        Setting values.
    """

    def __init__(self, *requirements, **parameters):
        self.requirements = requirements
        self.parameters = parameters
        self.cache = Cache()
        self.initialize()

    def initialize(self):
        # Calls `Initialize` implementations.
        with self:
            try:
                for initialize_type in Initialize.one_per_package():
                    initialize = initialize_type()
                    initialize()
            except Error, error:
                if self.requirements:
                    error.wrap("While initializing RexDB application:",
                               "\n".join(str(requirement)
                                         for requirement in self.requirements))
                else:
                    error.wrap("While initializing RexDB application")
                if self.parameters:
                    error.wrap("With parameters:",
                               "\n".join("%s: %r" % (key, self.parameters[key])
                                         for key in sorted(self.parameters)))
                raise

    def on(self):
        """
        Activates the application.

        You can also apply ``with`` statement on the application object to make
        the application active while the ``with`` block is executed.
        """
        get_rex.push(self)

    def off(self):
        """
        Deactivates the application.
        """
        get_rex.pop(self)

    def __enter__(self):
        self.on()

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.off()

    def __call__(self, environ, start_response):
        """
        WSGI entry point.
        """
        with self:
            wsgi = get_wsgi()
            output = wsgi(environ, start_response)
        # FIXME: must not call any extensions!
        return output

    def __repr__(self):
        args = ["%r" % item for item in self.requirements] + \
               ["%s=%r" % (key, self.parameters[key])
                for key in sorted(self.parameters)]
        return "%s(%s)" % (self.__class__.__name__, ", ".join(args))


class Initialize(Extension):
    """
    Interface for initializing RexDB applications.

    This interface is invoked when a new :class:`Rex` object is
    created.  No more than one implementation per package should be
    defined.
    """

    @classmethod
    @cached
    def one_per_package(cls):
        """
        Returns a list of implementations.
        """
        extensions = []
        for package in reversed(get_packages()):
            package_extensions = cls.by_package(package)
            assert len(package_extensions) <= 1, \
                    "too many implementations per package: %s" \
                    % package_extensions
            extensions.extend(package_extensions)
        return extensions

    def __call__(self):
        """
        Initializes the application.

        Implementations must override this method.
        """
        # Fail early if there are any problems with packages or configuration.
        get_packages()
        get_settings()
        get_wsgi()


