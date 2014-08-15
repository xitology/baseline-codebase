#
# Copyright (c) 2014, Prometheus Research, LLC
#


from rex.core import Error
import urllib


class Constraint(object):
    """
    Represents a constraint over a port arm.

    `path`
        Path in the port tree; a list of arm names.
    `operator`
        The type of the constraint, or ``None`` for the equality constraint.
    `arguments`
        List of constraint arguments.
    """

    @classmethod
    def parse(cls, data):
        # Converts a raw value to `Constraint` instance.

        # `Constraint` instances are returned as is.
        if isinstance(data, Constraint):
            return data
        # Keep for error messages.
        input = data

        # URL-encoded ``<path>``, `<path>=<argument>` or
        # `<path>:<operator>=<argument>`.
        if isinstance(data, str):
            if '=' in data:
                path, arguments = data.split('=', 1)
                path = urllib.unquote(path)
                if ':' in path:
                    path, operator = path.split(':', 1)
                else:
                    operator = None
                arguments = urllib.unquote(arguments)
                if arguments:
                    arguments = [arguments]
                else:
                    arguments = []
            else:
                path = urllib.unquote(data)
                if ':' in path:
                    path, operator = path.split(':', 1)
                else:
                    operator = None
                arguments = []
            data = (path, operator, arguments)

        # Pair `(<path>, <arguments>)` or triple
        # `(<path>, <operator, <arguments>)`.
        if isinstance(data, tuple) and len(data) == 2:
            path, arguments = data
            operator = None
        elif isinstance(data, tuple) and len(data) == 3:
            path, operator, arguments = data
        else:
            raise TypeError(input)

        # `<path>` is a string `'<name>. ... .<name>'` or a list
        # `[<name>, ...]`.
        if isinstance(path, str):
            path = path.decode('utf-8', 'replace')
        if isinstance(path, unicode):
            path = tuple(path.split(u'.'))
        if isinstance(path, tuple):
            path = tuple(name.decode('utf-8', 'replace')
                         if isinstance(name, str) else name
                         for name in path)

        # `<operator>` is a string or `None`.
        if isinstance(operator, str):
            operator = operator.decode('utf-8', 'replace')

        # `<arguments>` is a list of `Value` instances.
        if not isinstance(arguments, list):
            arguments = [arguments]
        return cls(path, operator, arguments)

    def __init__(self, path, operator, arguments):
        self.path = path
        self.operator = operator
        self.arguments = arguments

    def get(self, depth):
        # Returns the path element at position `depth`.
        if len(self.path) > depth:
            return self.path[depth]
        else:
            return None

    def merge(self, arguments):
        # Returns a clone of the constraint with an extra set of arguments.
        return self.__class__(self.path, self.operator,
                              self.arguments+arguments)

    def key(self):
        return (self.path, self.operator)

    def value(self):
        return self.arguments

    def __str__(self):
        # Serialize into a URL-encoded string `<path>:<operator>=<argument>`.
        path = urllib.quote(".".join(name.encode('utf-8')
                            for name in self.path))
        if self.operator is not None:
            operator = ":"+urllib.quote(self.operator.encode('utf-8'))
        else:
            operator = ""
        if not self.arguments:
            arguments = [""]
        else:
            arguments = [argument.encode('utf-8')
                            if isinstance(argument, unicode) else str(argument)
                         for argument in self.arguments]
        return "&".join("%s%s=%s" % (path, operator, urllib.quote(argument))
                        for argument in arguments)

    def __repr__(self):
        return "%s(%r, %r, %r)" % (self.__class__.__name__,
                                   self.path, self.operator, self.arguments)


class ConstraintSet(object):
    """
    Represents a set of constraints at some port arm.
    """

    @classmethod
    def parse(cls, *args, **kwds):
        # Converts input to a set of constraints.
        inputs = []
        for arg in args:
            if isinstance(arg, str):
                inputs.extend(arg.split('&'))
            else:
                inputs.append(arg)
        inputs.extend(sorted(kwds.items()))
        constraints = []
        indexes = {}
        for input in inputs:
            if not input:
                continue
            constraint = Constraint.parse(input)
            if constraint.key() in indexes:
                index = indexes[constraint.key()]
                constraints[index] = \
                        constraints[index].merge(constraint.value())
            else:
                indexes[constraint.key()] = len(constraints)
                constraints.append(constraint)
        return cls(0, constraints)

    def __init__(self, depth, constraints):
        self.depth = depth
        self.constraints = constraints

    def partition(self, parts):
        # Partitions constraints by the next path segment.
        partition = { None: [] }
        partition.update((part, []) for part in parts)
        for constraint in self.constraints:
            name = constraint.get(self.depth)
            if name == u'*':
                for part in parts:
                    partition[part].append(constraint)
            else:
                if name is not None and name not in parts:
                    raise Error("Got unknown arm:", name) \
                          .wrap("While applying constraint:", constraint)
                partition[name].append(constraint)
        partition[None] = ConstraintSet(self.depth, partition[None])
        for part in parts:
            partition[part] = ConstraintSet(self.depth+1, partition[part])
        return partition

    def __len__(self):
        return len(self.constraints)

    def __iter__(self):
        return iter(self.constraints)

    def __str__(self):
        return "&".join(str(constraint) for constraint in self.constraints)

    def __repr__(self):
        return "%s(%r, %r)" % (self.__class__.__name__,
                               self.depth, self.constraints)


