#
# Copyright (c) 2013, Prometheus Research, LLC
#


from cogs import setting, env
from cogs.log import debug, fail
from rex.core import Rex, LatentRex, get_packages, Setting, Error
import shlex
import json


def pair(value):
    # Splits `PARAM=VALUE` into a 2-element tuple.
    if not isinstance(value, str):
        raise ValueError("expected a string")
    if '=' in value:
        return tuple(value.split('=', 1))
    else:
        return (value, True)


def sequence(value):
    # Accepts a sequence of parameters.
    if not value:
        value = []
    if isinstance(value, str):
        value = value.strip()
        if value.startswith('[') and value.endswith(']'):
            value = json.loads(value)
        else:
            value = shlex.split(value)
    if not (isinstance(value, list) and
            all(isinstance(item, basestring) for item in value)):
        raise ValueError("expected a sequence of parameters")
    return value


def collection(value):
    # Accepts a collection of configuration parameters.
    if not value:
        value = {}
    if isinstance(value, str):
        value = value.strip()
        if value.startswith('{') and value.endswith('}'):
            value = json.loads(value)
        else:
            value = dict(pair(item)
                         for item in shlex.split(value))
    if not (isinstance(value, dict) and
            all(isinstance(key, basestring) for key in value)):
        raise ValueError("expected a collection of parameters")
    return value


@setting
def PROJECT(name=None):
    """primary package

    The primary package of the application.
    """
    if not name:
        name = None
    if not (name is None or isinstance(name, str)):
        raise ValueError("expected a project name")
    env.project = name


@setting
def REQUIREMENTS(names=None):
    """additional application components

    Additional packages to include with the application.
    """
    env.requirements = sequence(names)


@setting
def PARAMETERS(config=None):
    """application configuration

    A dictionary with application parameters.
    """
    env.parameters = collection(config)


def make_rex(project=None, require_list=None, set_list=None,
             initialize=True, ensure=None):
    # Creates a RexDB application from command-line parameters
    # and global settings.

    # Form the list of requirements.
    requirements = []
    if project is not None:
        requirements.append(project)
    elif env.project is not None:
        requirements.append(env.project)
    if require_list is not None:
        requirements.extend(require_list)
    requirements.extend(env.requirements)

    # Gather application parameters.
    parameters = {}
    if env.debug:
        parameters['debug'] = True
    parameters.update(env.parameters)
    if set_list is not None:
        parameters.update(set_list)

    # Build the application.
    rex_type = Rex
    if not initialize:
        rex_type = LatentRex
    try:
        app = rex_type(*requirements, **parameters)
    except Error, error:
        raise fail(str(error))
    if ensure is not None:
        with app:
            try:
                packages = get_packages()
            except Error, error:
                raise fail(str(error))
        if ensure not in packages:
            raise fail("package `{}` must be included with the application",
                       ensure)
    return app


