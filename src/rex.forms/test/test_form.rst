****
Form
****

.. contents:: Table of Contents


The semi-abstract base Form class only implements a simple constructor
and string-rendering methods::

    >>> from rex.instrument.interface import Instrument, InstrumentVersion
    >>> instrument = Instrument('fake123', 'My Instrument Title')
    >>> INSTRUMENT = {
    ...     'id': 'urn:test-instrument',
    ...     'version': '1.1',
    ...     'title': 'The InstrumentVersion Title',
    ...     'record': [
    ...         {
    ...             'id': 'q_fake',
    ...             'type': 'text'
    ...         }
    ...     ]
    ... }
    >>> iv = InstrumentVersion('notreal456', instrument, INSTRUMENT, 1)
    >>> from rex.forms.interface import Channel, Form
    >>> channel = Channel('chan135', 'My EDC Application')
    >>> FORM = {
    ...     'instrument': {
    ...         'id': 'urn:test-instrument',
    ...         'version': '1.1',
    ...     },
    ...     'defaultLocalization': 'en',
    ...     'title': {
    ...         'en': 'Our Test Form',
    ...         'fr': u'Ma grande forme'
    ...     },
    ...     'pages': [
    ...         {
    ...             'id': 'page1',
    ...             'elements': [
    ...                 {
    ...                     'type': 'question',
    ...                     'options': {
    ...                         'fieldId': 'q_fake',
    ...                         'text': {
    ...                             'en': 'What is your favorite word?',
    ...                             'fr': u'Quel est votre mot préféré?'
    ...                         },
    ...                     },
    ...                 },
    ...             ],
    ...         },
    ...     ],
    ... }
    >>> form = Form('foo789', channel, iv, FORM)
    >>> form.get_display_name()
    u'Our Test Form'
    >>> unicode(form)
    u'Our Test Form'
    >>> str(form)
    'Our Test Form'
    >>> repr(form)
    "Form(u'foo789', Channel(u'chan135', u'My EDC Application'), InstrumentVersion(u'notreal456', Instrument(u'fake123', u'My Instrument Title'), 1))"

    >>> from copy import deepcopy
    >>> FORM_NOTITLE = deepcopy(FORM)
    >>> FORM_NOTITLE['defaultLocalization'] = 'fr'
    >>> form = Form('foo789', channel, iv, FORM_NOTITLE)
    >>> form.get_display_name()
    u'Ma grande forme'
    >>> del FORM_NOTITLE['title']
    >>> form = Form('foo789', channel, iv, FORM_NOTITLE)
    >>> form.get_display_name()
    u'The InstrumentVersion Title'

    >>> form.as_dict()
    {'instrument_version': {'instrument': {'uid': u'fake123', 'title': u'My Instrument Title'}, 'version': 1, 'uid': u'notreal456'}, 'uid': u'foo789', 'channel': {'uid': u'chan135', 'title': u'My EDC Application'}}
    >>> form.as_json()
    u'{"instrument_version": {"instrument": {"uid": "fake123", "title": "My Instrument Title"}, "version": 1, "uid": "notreal456"}, "uid": "foo789", "channel": {"uid": "chan135", "title": "My EDC Application"}}'


The Channels and InstrumentVersions passed to the constructor must actually be
instances of those classes::

    >>> form = Form('foo789', 'not a channel', iv, FORM)
    Traceback (most recent call last):
      ...
    ValueError: channel must be an instance of Channel
    >>> form = Form('foo789', channel, 'not real', FORM)
    Traceback (most recent call last):
      ...
    ValueError: instrument_version must be an instance of InstrumentVersion


The configuration can be passed to the contructor as either a JSON-encoded
string or the dict equivalent::

    >>> import json
    >>> FORM_JSON = json.dumps(FORM)
    >>> FORM_JSON
    '{"instrument": {"version": "1.1", "id": "urn:test-instrument"}, "defaultLocalization": "en", "pages": [{"elements": [{"type": "question", "options": {"text": {"fr": "Quel est votre mot pr\\u00c3\\u00a9f\\u00c3\\u00a9r\\u00c3\\u00a9?", "en": "What is your favorite word?"}, "fieldId": "q_fake"}}], "id": "page1"}], "title": {"fr": "Ma grande forme", "en": "Our Test Form"}}'
    >>> form = Form('foo789', channel, iv, FORM_JSON)
    >>> form.validate()


The configuration can be retrieved as either a JSON-encoded string or a dict
equivalent::

    >>> form.configuration
    {u'instrument': {u'version': u'1.1', u'id': u'urn:test-instrument'}, u'defaultLocalization': u'en', u'pages': [{u'elements': [{u'type': u'question', u'options': {u'text': {u'fr': u'Quel est votre mot pr\xc3\xa9f\xc3\xa9r\xc3\xa9?', u'en': u'What is your favorite word?'}, u'fieldId': u'q_fake'}}], u'id': u'page1'}], u'title': {u'fr': u'Ma grande forme', u'en': u'Our Test Form'}}
    >>> form.configuration_json
    u'{"instrument": {"version": "1.1", "id": "urn:test-instrument"}, "defaultLocalization": "en", "pages": [{"elements": [{"type": "question", "options": {"text": {"fr": "Quel est votre mot pr\xc3\xa9f\xc3\xa9r\xc3\xa9?", "en": "What is your favorite word?"}, "fieldId": "q_fake"}}], "id": "page1"}], "title": {"fr": "Ma grande forme", "en": "Our Test Form"}}'


Forms can be checked for equality. Note that equality is only defined as
being the same class with the same UID::

    >>> form1 = Form('foo789', channel, iv, FORM)
    >>> form2 = Form('foo999', channel, iv, FORM)
    >>> form3 = Form('foo789', channel, iv, FORM_NOTITLE)
    >>> form1 == form2
    False
    >>> form1 == form3
    True
    >>> form1 != form2
    True
    >>> form1 != form3
    False
    >>> mylist = [form1]
    >>> form1 in mylist
    True
    >>> form2 in mylist
    False
    >>> form3 in mylist
    True
    >>> myset = set(mylist)
    >>> form1 in myset
    True
    >>> form2 in myset
    False
    >>> form3 in myset
    True

    >>> form1 < form2
    True
    >>> form1 <= form3
    True
    >>> form2 > form1
    True
    >>> form3 >= form1
    True
