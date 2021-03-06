#
# Copyright (c) 2015, Prometheus Research, LLC
#


import gc
import sys

from copy import deepcopy
from datetime import datetime

from rex.core import Error, get_settings
from rex.deploy import model as deploy_model

from .assessments import AssessmentLoader
from .config import get_definition, get_management_db_uri
from .connections import get_management_db, get_hosting_cluster, \
    get_mart_etl_db, get_sql_connection
from .definers import Definer
from .mart import Mart
from .processors import Processor
from .purging import purge_mart
from .quota import MartQuota
from .util import extract_htsql_statements, guarded, REQUIRED
from .validators import DataTypeVal


__all__ = (
    'MartCreator',
    'ProcessorInterface',
)


HTSQL_CREATE_INVENTORY = '''{
    definition:=$definition,
    owner:=$owner,
    name:='TBD',
    status:='creation',
    date_creation_started:=$date_creation_started
} :as rexmart_inventory
/:insert'''

HTSQL_UPDATE_STATUS = '''/rexmart_inventory{
    id(),
    status:=$status
}.filter(
    code=$code
)
/:update'''

HTSQL_UPDATE_NAME = '''/rexmart_inventory{
    id(),
    name:=$name
}.filter(
    code=$code
)
/:update'''

HTSQL_UPDATE_COMPLETION_DETAILS = '''/rexmart_inventory{
    id(),
    date_creation_completed:=$date_completed,
    size:=$size
}.filter(
    code=$code
)
/:update'''


class MartCreator(object):
    """
    A class that encapsulates the process of creating a Mart database.
    """

    def __init__(self, owner, definition):
        """
        :param owner: the owner of the resulting Mart
        :type owner: str
        :param definition: the ID of the definition to use in creation
        :type definition: str
        """

        self.owner = owner
        self.start_date = None
        self.code = None
        self.name = None
        self.database = None
        self.logger = None
        self.assessment_mappings = []
        self.parameters = {}

        if not self.owner:
            raise Error('No owner specified')

        self.definition = get_definition(definition)
        if not self.definition:
            raise Error('Unknown definition "%s"' % (definition,))

    def __call__(
            self,
            purge_on_failure=True,
            leave_incomplete=False,
            logger=None,
            parameters=None):
        """
        Executes the creation of a Mart database.

        :param purge_on_failure:
            whether or not to delete the Mart database if an error was
            encountered during its creation; if not specified, defaults to
            True
        :type purge_on_failure: bool
        :param leave_incomplete:
            whether or not to set the final ``complete`` status on the
            inventory record after creating the Mart; if not specified,
            defaults to False, which means it **will** be marked ``complete``
        :type leave_incomplete: bool
        :param logger:
            the function to call to output a message about the progress of the
            creation
        :type logger: function
        :param parameters:
            the values to the parameters defined in the Mart Definition
        :type parameters: dict
        :returns:
            a dict with the ``name`` of the newly-created Mart, as well as the
            ``code`` of the associated inventory record
        """

        self.parameters = self.validate_parameters(parameters)
        self.close_mart()

        if not MartQuota.top().can_create_mart(self.owner, self.definition):
            raise Error(
                'Creating a "%s" Mart for "%s" would exceed their quota' % (
                    self.definition['id'],
                    self.owner,
                )
            )

        with guarded('While creating Mart database:', self.definition['id']):
            try:
                # Setup
                self.start_date = datetime.now()
                self.logger = logger
                self.log('Mart creation began: %s' % (self.start_date,))
                if self.parameters:
                    self.log(
                        'Parameters: %s' % (
                            ', '.join([
                                '%s=%r' % (key, value)
                                for key, value in list(self.parameters.items())
                            ]),
                        )
                    )
                self.code = self.create_inventory()
                self.name = self.establish_name()

                # Creation
                self.create_mart()

                # Deployment
                self._update_status('deployment')
                self.deploy_structures()

                # Post Deployment ETL
                self._update_status('post_deployment')
                self.log('Executing Post-Deployment ETL...')
                with guarded('While executing Post-Deployment Scripts'):
                    self.execute_etl(self.definition['post_deploy_scripts'])
                self.log('...ETL complete')

                # Assessment ETL
                self._update_status('assessment')
                self.load_assessments()

                # Post Assessment ETL
                self._update_status('post_assessment')
                self.log('Executing Post-Assessment ETL...')
                with guarded('While executing Post-Assessment Scripts'):
                    self.execute_etl(
                        self.definition['post_assessment_scripts'],
                    )
                self.log('...ETL complete')

                # Post-Processors
                self._update_status('processing')
                self.execute_processors(self.definition['processors'])

                # Mark things complete
                self.rename_db()
                self._update_completion_details()
                if not leave_incomplete:
                    self._update_status('complete')

                mart = self._get_mart()
                self.log('Mart creation complete: %s' % (
                    mart.date_creation_completed,
                ))
                self.log('Mart creation duration: %s' % (
                    mart.date_creation_completed - mart.date_creation_started,
                ))
                self.log('Mart database size: %s' % (
                    mart.size,
                ))

                # Clean up old Marts to stay within quota
                MartQuota.top().reap_marts(self.owner, self.definition)

                return mart

            except:  # noqa
                if self.code and purge_on_failure:
                    try:
                        purge_mart(self.code)
                    except:  # noqa
                        # Be quiet so the original exception can raised
                        pass
                raise

            finally:
                self.start_date = None
                self.code = None
                self.name = None
                self.close_mart()
                self.logger = None
                self.assessment_mappings = []
                self.parameters = {}

    def validate_parameters(self, parameters):
        """
        Validates a set of parameters against those expected in this
        MartCreator's definition, and returns the validated/normalized values.

        :param parameters: the parameters to validate
        :type parameters: dict
        :rtype: dict
        """

        parameters = deepcopy(parameters or {})
        validated = {}

        for param in self.definition['parameters']:
            if param['name'] in parameters:
                with guarded('While validating parameter:', param['name']):
                    validator = DataTypeVal.get_validator(param['type'])
                    validated[param['name']] = validator(
                        parameters.pop(param['name']),
                    )

            elif param['default'] is not REQUIRED:
                validated[param['name']] = param['default']

            else:
                raise Error('Missing required parameter "%s"' % (
                    param['name'],
                ))

        if list(parameters.keys()):
            raise Error('Unknown parameters: %s' % (
                ', '.join(list(parameters.keys())),
            ))

        return validated

    def log(self, msg):
        if not self.logger:
            return
        self.logger(msg)

    def _get_mart(self):
        database = get_management_db()
        data = database.produce('/rexmart_inventory[$code]', code=self.code)
        return Mart.from_record(data[0])

    def _do_update(self, query, **parameters):  # pylint: disable=no-self-use
        database = get_management_db()
        database.produce(query, **parameters)

    def _update_name(self, name):
        with guarded('While updating inventory name:', name):
            self._do_update(
                HTSQL_UPDATE_NAME,
                code=self.code,
                name=name,
            )

    def _update_status(self, status):
        with guarded('While updating inventory status:', status):
            self._do_update(
                HTSQL_UPDATE_STATUS,
                code=self.code,
                status=status,
            )

    def _update_completion_details(self):
        size = None
        with guarded('While retrieving database size'):
            self.connect_mart()
            with get_sql_connection(self.database) as sql:
                cursor = sql.cursor()
                try:
                    cursor.execute('select pg_database_size(%s)', (self.name,))
                    rec = cursor.fetchone()
                    if rec:
                        size = rec[0]
                finally:
                    cursor.close()

        with guarded('While updating inventory date'):
            self._do_update(
                HTSQL_UPDATE_COMPLETION_DETAILS,
                code=self.code,
                date_completed=datetime.now(),
                size=size,
            )

    def create_inventory(self):
        with guarded('While creating inventory record'):
            database = get_management_db()
            data = database.produce(
                HTSQL_CREATE_INVENTORY,
                definition=self.definition['id'],
                owner=self.owner,
                date_creation_started=self.start_date,
            )
            return int(str(data.data))

    def establish_name(self):
        if self.definition['base']['type'] == 'existing':
            name = self.definition['base']['target']
        else:
            name_parts = []
            if get_settings().mart_name_prefix:
                name_parts.append(get_settings().mart_name_prefix)
            name_parts.append(self.definition['base']['name_token'])
            name_parts.append(str(self.code))
            name_parts.append('_')
            name_parts.append(self.start_date.strftime('%Y%m%d%H%M%S'))
            name = ''.join(name_parts)

        self._update_name(name)
        return name

    def rename_db(self):
        if not self.definition['base']['fixed_name']:
            return
        fixed_name = self.definition['base']['fixed_name']

        with guarded('While purging previous fixed-name database'):
            database = get_management_db()
            data = database.produce(
                '/rexmart_inventory{code, owner}?name=$name',
                name=fixed_name,
            )
            if len(data) > 1:  # pragma: no cover
                raise Error(
                    'Multiple inventory records have a name of "%s"; unsure'
                    ' what to do' % (
                        fixed_name,
                    )
                )
            elif data:
                if data[0].owner == self.owner:
                    self.log('Purging previous database named "%s"...' % (
                        fixed_name,
                    ))
                    purge_mart(data[0].code)
                else:
                    raise Error(
                        'Cannot set name of Mart to "%s" because a Mart with'
                        ' that name already exists owned by "%s"' % (
                            fixed_name,
                            data[0].owner,
                        )
                    )

        with guarded('While renaming database'):
            self.log('Renaming database to: %s' % (
                fixed_name,
            ))
            cluster = get_hosting_cluster()
            cluster.rename(fixed_name, self.name)
            self._update_name(fixed_name)
            self.name = fixed_name
            self.reconnect_mart()

    def create_mart(self):
        cluster = get_hosting_cluster()
        if self.definition['base']['type'] in ('fresh', 'copy', 'application'):
            self.log('Creating database: %s' % (self.name,))

            to_clone = None
            if self.definition['base']['type'] == 'copy':
                to_clone = self.definition['base']['target']
            elif self.definition['base']['type'] == 'application':
                to_clone = get_management_db_uri().database
            if to_clone:
                if not cluster.exists(to_clone):
                    raise Error(
                        'Database "%s" does not exist' % (
                            to_clone,
                        )
                    )
                self.log('Cloning: %s' % (to_clone,))

            with guarded('While creating database:', self.name):
                cluster.create(self.name, template=to_clone)

        elif self.definition['base']['type'] == 'existing':
            self.log('Using existing database: %s' % (self.name,))
            if not cluster.exists(self.name):
                raise Error(
                    'Database "%s" does not exist' % (
                        self.name,
                    )
                )

        else:  # pragma: no cover
            raise Error('Unknown base type "%s"' % (
                self.definition['base']['type'],
            ))

    def _do_deploy(self, facts, working_dir=None):
        cluster = get_hosting_cluster()
        driver = cluster.drive(self.name)
        if working_dir:
            driver.chdir(working_dir)
        driver(facts)
        driver.commit()
        driver.close()
        self.reconnect_mart()

    def deploy_structures(self):
        if not self.definition['deploy']:
            return

        self.log('Deploying structures...')
        with guarded('While Deploying structures'):
            self._do_deploy(
                self.definition['deploy'],
                working_dir=self.definition.get('base_path'),
            )

    def get_query_params(self, params=None):
        query_params = {}

        if params:
            query_params.update(params)

        query_params.update(self.parameters)

        query_params['OWNER'] = self.owner
        query_params['DEFINITION'] = self.definition['id']

        return query_params

    def execute_etl(self, scripts):
        if not scripts:
            return

        for idx, script in enumerate(scripts):
            self.reconnect_mart()

            idx_label = '#%s' % (idx + 1,)
            self.log('%s script %s...' % (
                script['type'].upper(),
                idx_label,
            ))

            params = self.get_query_params(script['parameters'])

            if script['type'] == 'htsql':
                statements = extract_htsql_statements(script['script'])
                with guarded('While executing HTSQL script:', idx_label):
                    for statement in statements:
                        with guarded('While executing statement:', statement):
                            self.database.produce(statement, **params)

            elif script['type'] == 'sql':
                with guarded('While executing SQL script:', idx_label):
                    with get_sql_connection(self.database) as sql:
                        cursor = sql.cursor()
                        try:
                            cursor.execute(script['script'], params)
                        finally:
                            cursor.close()

            else:  # pragma: no cover
                raise Error('Unknown script type "%s"' % (
                    script['type'],
                ))

    def load_assessments(self):
        if not self.definition['assessments']:
            return

        assessments = []
        for cfg in self.definition['assessments']:
            if cfg.get('dynamic'):
                assessments += Definer.get_assessments(
                    cfg['dynamic'],
                    self.definition['id'],
                    **cfg.get('options', {})
                )
            else:
                assessments.append(cfg)

        for idx, assessment in enumerate(assessments):
            idx_label = '#%s (%s)' % (idx + 1, assessment['name'])
            self.log('Processing Assessment %s' % (idx_label,))

            with guarded('While processing Assessment:', idx_label):
                self.connect_mart()
                params = self.get_query_params()
                loader = AssessmentLoader(assessment, self.database, params)
                self.assessment_mappings.append(loader.mapping)

                with guarded('While deploying Assessment structures'):
                    self.log('...deploying structures')
                    self._do_deploy(loader.get_deploy_facts())

                with guarded('While loading Assessments'):
                    self.log('...loading Assessments')
                    num_loaded = loader.load(self.database)
                    self.log('...%s Assessments loaded' % (
                        num_loaded,
                    ))

                with guarded('While performing Assessment calculations'):
                    self.log('...performing calculations')
                    loader.do_calculations(self.database)

                self.log('...complete')

    def connect_mart(self):
        if not self.database:
            self.database = get_mart_etl_db(self.name)

    def close_mart(self):
        # Force collection of the HTSQL instance to try to avoid corrupting
        # future instances.
        self.database = None
        gc.collect()

    def reconnect_mart(self):
        if self.database:
            self.close_mart()
        self.connect_mart()

    def execute_processors(self, processors):
        if not processors:
            return

        interface = ProcessorInterface(self)
        for processor in processors:
            with guarded('While executing Processor:', processor['id']):
                self.log('Executing Processor %s...' % (processor['id'],))
                Processor.mapped()[processor['id']]()(
                    processor['options'],
                    interface,
                )
                self.log('...complete')


class ProcessorInterface(object):
    """
    A proxy object that is given to Processors in order to interact with the
    main MartCreator object.
    """

    def __init__(self, creator):
        self._creator = creator

    def get_htsql(self):
        """
        Retrieves an HTSQL connection to the Mart database.

        :rtype: rex.db.RexHTSQL
        """

        self._creator.connect_mart()
        return self._creator.database

    def get_deploy_driver(self):
        """
        Retrieves a rex.deploy Driver for the Mart database.

        :rtype: rex.deploy.fact.Driver
        """

        cluster = get_hosting_cluster()
        driver = cluster.drive(self._creator.name)
        return driver

    def get_deploy_model(self):
        """
        Retrieves a rex.deploy Model for the Mart database.

        :rtype: rex.deploy.image.ModelSchema
        """

        driver = self.get_deploy_driver()
        model = deploy_model(driver)
        driver.close()
        return model

    def get_assessment_mappings(self):
        """
        Retrieves the Assessment mappings generated to create the Assessment
        tables in this Mart.

        :rtype: rex.mart.tables.PrimaryTable
        """

        return self._creator.assessment_mappings

    def deploy_facts(self, facts):
        """
        Executes the specified list of rex.deploy facts in the Mart database.

        :param facts: the facts to execute
        :type facts: list
        """

        # pylint: disable=protected-access
        self._creator._do_deploy(facts)

    def log(self, message):
        """
        Outputs a message to the Mart creation log.

        :param message: the message to output
        :type message: str
        """

        self._creator.log(message)

