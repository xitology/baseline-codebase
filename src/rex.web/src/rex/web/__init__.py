#
# Copyright (c) 2013, Prometheus Research, LLC
#


"""
This package provides web stack for the RexDB platform: custom URL handlers,
rendering static resources, templates, sessions, authentication and
authorization mechanism.
"""


from .auth import authenticate, authorize, Authenticate, Authorize
from .command import Command, Parameter
from .csrf import (trusted, retain_csrf_token, make_csrf_meta_tag,
        make_csrf_input_tag)
from .handle import HandleLocation, HandleFile, HandleError
from .route import MountSetting, Route
from .secret import SecretSetting
from .template import (get_jinja, render_to_response, HandleTemplate,
        jinja_filter_json, jinja_filter_urlencode)


