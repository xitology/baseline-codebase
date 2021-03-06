*************
Mart Instance
*************


Set up the environment::

    >>> from rex.mart import Mart, MartCreator, get_management_db
    >>> from datetime import datetime
    >>> from pprint import pprint
    >>> from rex.core import Rex
    >>> import sys; cluster = 'pgsql://:5433/mart' if hasattr(sys, 'MART_MULTICLUSTER_TEST') else None
    >>> rex = Rex('rex.mart_demo', mart_hosting_cluster=cluster)
    >>> rex.on()

    >>> def get_mart(code):
    ...     data = get_management_db().produce('/rexmart_inventory[$code]', code=code)
    ...     if data:
    ...         return Mart.from_record(data[0])
    ...     return None


The Mart object is an encapsulation of the information about a Mart database::

    >>> mc = MartCreator('marttest', 'empty')
    >>> mart = mc()
    >>> mart   # doctest: +ELLIPSIS
    Mart(code=..., definition='empty', owner='marttest')

    >>> isinstance(mart.code, int)
    True
    >>> mart.definition_id
    'empty'
    >>> pprint(mart.definition)  # doctest: +ELLIPSIS
    {'assessments': [],
     'base': {'fixed_name': None,
              'name_token': 'empty_',
              'target': None,
              'type': 'fresh'},
     'base_path': '.../rex.mart_demo',
     'deploy': None,
     'description': None,
     'id': 'empty',
     'label': 'empty',
     'parameters': [],
     'post_assessment_scripts': [],
     'post_deploy_scripts': [],
     'processors': [],
     'quota': {'per_owner': 3}}
    >>> mart.owner
    'marttest'
    >>> isinstance(mart.name, str)
    True
    >>> isinstance(mart.date_creation_started, datetime)
    True
    >>> isinstance(mart.date_creation_completed, datetime)
    True
    >>> mart.pinned
    False
    >>> isinstance(mart.size, int)
    True
    >>> mart.size > 0
    True
    >>> mart.status
    'complete'
    >>> mart.usable
    True

    >>> mart.pinned = True
    >>> mart.pinned
    True
    >>> mart = get_mart(mart.code)
    >>> mart.pinned
    True
    >>> mart.pinned = True
    >>> mart.pinned
    True
    >>> mart = get_mart(mart.code)
    >>> mart.pinned
    True
    >>> mart.pinned = False
    >>> mart.pinned
    False
    >>> mart = get_mart(mart.code)
    >>> mart.pinned
    False

    >>> mart.pinned = 'yes'
    Traceback (most recent call last):
        ...
    ValueError: The value of pinned must be boolean

    >>> pprint(mart.as_dict())  # doctest: +ELLIPSIS
    {'code': ...,
     'date_creation_completed': ...,
     'date_creation_started': ...,
     'definition': 'empty',
     'name': 'mart_empty_...',
     'owner': 'marttest',
     'pinned': False,
     'size': ...}
    >>> isinstance(mart.as_dict(json_safe=True)['date_creation_started'], str)
    True
    >>> isinstance(mart.as_dict(json_safe=True)['date_creation_completed'], str)
    True

    >>> mart.purge()
    >>> mart = get_mart(mart.code)
    >>> mart is None
    True


    >>> mart = Mart(999, 'fakedefn', 'marttest', 'dbname', datetime.now(), datetime.now(), False, 123, 'complete')
    >>> mart.definition is None
    True



    >>> rex.off()


