********
Commands
********


Set up the environment::

    >>> from webob import Request
    >>> from pprint import pprint
    >>> from rex.core import Rex
    >>> import sys; cluster = 'pgsql://:5433/mart' if hasattr(sys, 'MART_MULTICLUSTER_TEST') else None
    >>> rex = Rex('rex.mart_demo', mart_hosting_cluster=cluster)
    >>> rex.on()

    >>> from rex.mart import MartCreator, purge_mart
    >>> mc = MartCreator('cmdtest', 'empty')
    >>> _ = mc()
    >>> empty_mart = mc()
    >>> mc = MartCreator('cmdtest', 'some_data')
    >>> _ = mc(); _ = mc()
    >>> some_data_mart = mc()
    >>> mc = MartCreator('otheruser', 'empty')
    >>> empty_mart_other = mc()
    >>> mc = MartCreator('otheruser', 'some_data')
    >>> some_data_mart_other = mc()
    >>> mc = MartCreator('cmdtest', 'just_deploy')
    >>> _ = mc()


Mart Listing API
================

This API will return all Marts the user has access to::

    >>> req = Request.blank('/mart', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json['marts'][0])  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}
    >>> len(resp.json['marts'])
    5
    >>> len([mart for mart in resp.json['marts'] if mart['definition'] == 'some_data'])
    3
    >>> len([mart for mart in resp.json['marts'] if mart['definition'] == 'empty'])
    2

    >>> req = Request.blank('/mart', remote_user='otheruser')
    >>> resp = req.get_response(rex)
    >>> len(resp.json['marts'])
    2
    >>> len([mart for mart in resp.json['marts'] if mart['definition'] == 'some_data'])
    1
    >>> len([mart for mart in resp.json['marts'] if mart['definition'] == 'empty'])
    1


Definition Listing API
======================

This API will return all Definitions the user has access to::

    >>> req = Request.blank('/definition', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)
    {'definitions': [{'description': None, 'id': 'empty', 'label': 'empty'},
                     {'description': 'Make a table and put some data in it',
                      'id': 'some_data',
                      'label': 'some_data'},
                     {'description': 'Make a table and put some data in it with '
                                     'multiple scripts/statements',
                      'id': 'some_more_data',
                      'label': 'some_more_data'},
                     {'description': 'Definition with a broken SQL ETL script',
                      'id': 'broken_sql',
                      'label': 'broken_sql'},
                     {'description': 'Shows everywhere that the parameters can be '
                                     'used',
                      'id': 'some_parameters',
                      'label': 'some_parameters'}]}


Definition Mart Listing API
===========================

This API will return the Marts the user has access to for the specified
definition::

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json['definition'])
    {'description': 'Make a table and put some data in it',
     'id': 'some_data',
     'label': 'some_data'}
    >>> len(resp.json['marts'])
    3
    >>> len([mart for mart in resp.json['marts'] if mart['definition'] == 'some_data'])
    3


Mart Creation API
=================

If enabled, this API will submit asynchronous tasks to initiate Mart creation::

    >>> req = Request.blank('/definition/just_deploy', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    403 Forbidden
    ...

    >>> rex.off()
    >>> rex2 = Rex('rex.mart_demo', mart_allow_runtime_creation=True, mart_hosting_cluster=cluster)
    >>> rex2.on()

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> print(req.get_response(rex2))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    202 Accepted
    Content-Type: application/json
    Content-Length: 118
    Set-Cookie: ...
    <BLANKLINE>
    {"purge_on_failure": true, "leave_incomplete": false, "parameters": {}, "owner": "cmdtest", "definition": "some_data"}

    >>> req = Request.blank('/definition/some_parameters', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"parameters": {"bar": 333}}'
    >>> print(req.get_response(rex2))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    202 Accepted
    Content-Type: application/json
    Content-Length: 134
    Set-Cookie: ...
    <BLANKLINE>
    {"purge_on_failure": true, "leave_incomplete": false, "parameters": {"bar": 333}, "owner": "cmdtest", "definition": "some_parameters"}

    >>> req = Request.blank('/definition/some_parameters', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> print(req.get_response(rex2))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    400 Bad Request
    Content-Type: application/json
    Content-Length: 47
    Set-Cookie: ...
    <BLANKLINE>
    {"error": "Missing required parameter \"bar\""}

    >>> req = Request.blank('/definition/some_more_data', remote_user='cmdtest', method='POST')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> print(req.get_response(rex2))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    403 Forbidden
    ...

    >>> rex2.off()
    >>> rex.on()


Mart-Specific APIs
==================

Accessing the HTSQL endpoint for a specific Mart::

    >>> mart_path = '/mart/' + str(some_data_mart.code)

    >>> req = Request.blank(mart_path, remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    301 Moved Permanently
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...

    >>> rex.off()
    >>> rex2 = Rex('rex.mart_demo', debug=True, mart_htsql_extensions={'tweak.shell': {}}, mart_hosting_cluster=cluster)
    >>> rex2.on()
    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest')
    >>> print(req.get_response(rex2))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    X-Htsql-Shell-Root: http://localhost/mart/...
    Set-Cookie: ...
    >>> rex2.off()
    >>> rex.on()

    >>> req = Request.blank(mart_path + "/foo?col1={'Bob','John'}", remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='POST')
    >>> req.body = b"/foo?col1={'Bob','John'}"
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='POST')
    >>> req.body = b"/foo"
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 263
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
     | Mary             |      |
     | Some             |      |
     | Tom              |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank('/mart/foo/foo', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/mart/999/foo', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/mart/%s/foo' % (empty_mart_other.code,), remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    405 Method Not Allowed
    ...

Accessing the details API for a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='GET')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}

    >>> req = Request.blank('/mart/999/_api', remote_user='cmdtest', method='GET')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/mart/%s/_api' % (some_data_mart_other.code,), remote_user='cmdtest', method='GET')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

Update attributes of a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='PUT')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"pinned": true}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': True,
     'size': ...}

    >>> req.body = b'{"pinned": false}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}


"Latest" Mart APIs
==================

Accessing the HTSQL endpoint for the latest Mart::

    >>> mart_path = '/definition/some_data/latest'

    >>> req = Request.blank(mart_path, remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    301 Moved Permanently
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...

    >>> req = Request.blank(mart_path + "/foo?col1={'Bob','John'}", remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='POST')
    >>> req.body = b"/foo?col1={'Bob','John'}"
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank('/definition/some_more_data/latest/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/definition/just_deploy/latest/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    405 Method Not Allowed
    ...

Accessing the details API for a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='GET')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}
    >>> latest_some_data = resp.json

    >>> req = Request.blank('/definition/some_more_data/latest/_api', remote_user='cmdtest', method='GET')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/definition/just_deploy/latest/_api', remote_user='cmdtest', method='GET')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

Update attributes of a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='PUT')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"pinned": true}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': True,
     'size': ...}

    >>> req.body = b'{"pinned": false}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}

    >>> req = Request.blank('/definition/empty/latest/_api', remote_user='cmdtest', method='PUT')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"pinned": true}'
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...


"Indexed" Mart APIs
===================

Accessing the HTSQL endpoint for the latest Mart::

    >>> mart_path = '/definition/some_data/2'

    >>> req = Request.blank(mart_path, remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    301 Moved Permanently
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...

    >>> req = Request.blank(mart_path + "/foo?col1={'Bob','John'}", remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='POST')
    >>> req.body = b"/foo?col1={'Bob','John'}"
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    200 OK
    Content-Type: text/plain; charset=UTF-8
    Vary: Accept
    Set-Cookie: ...
    Content-Length: 176
    <BLANKLINE>
     | Foo Bars                |
     +------------------+------+
     | The First Column | Col2 |
    -+------------------+------+-
     | Bob              |      |
     | John             |      |
    <BLANKLINE>
    <BLANKLINE>

    >>> req = Request.blank('/definition/some_data/99/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

    >>> req = Request.blank('/definition/just_deploy/2/', remote_user='cmdtest')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...

    >>> req = Request.blank(mart_path + '/', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    405 Method Not Allowed
    ...

Accessing the details API for a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='GET')
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}
    >>> resp.json['code'] < latest_some_data['code']
    True

    >>> req = Request.blank('/definition/some_data/99/_api', remote_user='cmdtest', method='GET')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    404 Not Found
    ...

Update attributes of a Mart::

    >>> req = Request.blank(mart_path + '/_api', remote_user='cmdtest', method='PUT')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"pinned": true}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': True,
     'size': ...}

    >>> req.body = b'{"pinned": false}'
    >>> resp = req.get_response(rex)
    >>> pprint(resp.json)  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': '...',
     'date_creation_started': '...',
     'definition': 'some_data',
     'name': 'mart_some_data_...',
     'owner': 'cmdtest',
     'pinned': False,
     'size': ...}

    >>> req = Request.blank('/definition/empty/1/_api', remote_user='cmdtest', method='PUT')
    >>> req.headers['Content-Type'] = 'application/json'
    >>> req.body = b'{"pinned": true}'
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...



Purge APIs
==========


Purging a Mart from the system::

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> len(resp.json['marts'])
    3


    >>> req = Request.blank('/definition/some_data/2/_api', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    204 No Content
    Content-Type: application/json
    Content-Length: 0
    Set-Cookie: ...

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> len(resp.json['marts'])
    2


    >>> req = Request.blank('/mart/%s/_api' % (some_data_mart.code,), remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    204 No Content
    Content-Type: application/json
    Content-Length: 0
    Set-Cookie: ...

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> len(resp.json['marts'])
    1


    >>> req = Request.blank('/definition/some_data/latest/_api', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    204 No Content
    Content-Type: application/json
    Content-Length: 0
    Set-Cookie: ...

    >>> req = Request.blank('/definition/some_data', remote_user='cmdtest')
    >>> resp = req.get_response(rex)
    >>> len(resp.json['marts'])
    0


    >>> req = Request.blank('/definition/empty/latest/_api', remote_user='cmdtest', method='DELETE')
    >>> print(req.get_response(rex))  # doctest: +ELLIPSIS, +NORMALIZE_WHITESPACE
    401 Unauthorized
    ...



    >>> rex.off()


