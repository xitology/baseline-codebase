#
# Copyright (c) 2012-2014, Prometheus Research, LLC
#


import sys
import platform
import os, os.path
import errno
import shutil
import stat
import subprocess
import tempfile
import pwd
import json
import email
import distutils.log, distutils.errors
import setuptools
import pkg_resources

from . import download


# npm version used for CommonJS environment
NPM_VERSION = '5.x.x'
YARN_URL = 'https://github.com/yarnpkg/yarn/releases/download/v0.27.5/yarn-0.27.5.js#md5=8d11d9b5186e27a2b93883b9dcde895a'
REACT_SCRIPTS_VERSION = '0.9.5009'

USER = pwd.getpwuid(os.getuid()).pw_name

class install_commonjs(setuptools.Command):

    description = "install commonjs package"

    npm_install_production = True
    force_npm_link = False

    user_options = [
        ('package-location=', None, 'Package location.')
    ]

    def initialize_options(self):
        self.package_location = None

    def finalize_options(self):
        pass

    def _make_dummy_dist(self):
        ei_cmd = self.get_finalized_command('egg_info')
        if not os.path.exists(ei_cmd.egg_info):
            self.run_command('egg_info')
        return pkg_resources.Distribution(
                ei_cmd.egg_base,
                pkg_resources.PathMetadata(
                    ei_cmd.egg_base, ei_cmd.egg_info),
                ei_cmd.egg_name, ei_cmd.egg_version)

    def run(self):
        dist = self._make_dummy_dist()
        install_package(
                dist,
                execute=self.execute,
                dest=self.package_location,
                force_npm_link=self.force_npm_link,
                npm_install_production=self.npm_install_production)


class develop_commonjs(install_commonjs):

    description = "install commonjs package in development mode"

    npm_install_production = False
    force_npm_link = True


def dummy_execute(func, args, message=None):
    if message:
        distutils.log.info(message)
    return func(*args)


def find_executable(executables, title=None):
    if not isinstance(executables, (tuple, list)):
        executables = [executables]
    # Finds the executable in $PATH; excludes wrappers generated by rex.setup.
    paths = os.environ['PATH'].split(os.pathsep)
    # if Python is installed in virtualenv we add its bin/ directory to checked
    # paths
    for executable in executables:
        if hasattr(sys, 'real_prefix'):
            paths.insert(0, os.path.join(sys.prefix, 'bin'))
        for path in paths:
            filename = os.path.join(path, executable)
            if os.path.isfile(filename):
                # Skip `node` and `npm` shims created by `setup_commonjs()`.
                with open(filename, 'rb') as stream:
                    stream.readline()
                    if 'rex.setup' in stream.readline():
                        continue
                return filename
    raise distutils.errors.DistutilsSetupError(
            "cannot find `%s` executable; %s is not installed?"
            % (executable, title or executable.title()))


def get_commonjs_environment():
    # Returns environment variables in which we execute `node` and `npm`.
    env = {}
    if hasattr(sys, 'real_prefix'):
        # If Python is installed in a virtualenv, make sure NodeJS loads and
        # installs modules within the virtualenv tree.
        env['NODE_PATH'] = os.path.join(sys.prefix, 'lib', 'node_modules')
        env['NPM_CONFIG_PREFIX'] = sys.prefix
        env['PATH'] = '%s:%s' % (
            os.path.join(sys.prefix, 'bin'),
            os.environ.get('PATH', '')
        )
    else:
        # Even if we are outside virtualenv, make sure we pick up any
        # environment customizations
        if 'NODE_PATH' in os.environ:
            env['NODE_PATH'] = os.environ['NODE_PATH']
        if 'NPM_CONFIG_PREFIX' in os.environ:
            env['NPM_CONFIG_PREFIX'] = os.environ['NPM_CONFIG_PREFIX']
    return env


def setup_commonjs():
    # Verifies that NodeJS and NPM are available.

    # Find `node` and `npm` executables.
    real_node_path = find_executable(('node', 'nodejs'), 'Node.js')
    real_npm_path = find_executable('npm', 'NPM')

    # When Python is installed in a virtualenv, add shim `node` and
    # `npm` executables to the virtualenv tree.  It is done for convenience
    # of developers working within the virtual environment, we never
    # start these executables in our code.
    env = get_commonjs_environment()
    if env:
        node_path = os.path.join(sys.prefix, 'bin', 'node')
        for (path, real_path) in [(node_path, real_node_path)]:
            if os.path.exists(path):
                continue
            distutils.log.info("creating %s shim" % path)
            stream = open(path, 'w')
            stream.write('#!/bin/sh\n')
            stream.write('# Autogenerated by rex.setup.\n')
            for key, value in sorted(env.items()):
                if key == 'NODE_PATH':
                    # For some reason Node fails if NODE_PATH contains dups
                    stream.write('if [ "${0}" != "{1}" ]; then export {0}="${0}:{1}"; fi\n'.format(key, value))
                else:
                    stream.write('export {0}="{1}"\n'.format(key, value))
            stream.write('exec {} "$@"\n'.format(real_path))
            stream.close()
            mode = os.stat(path).st_mode
            os.chmod(path, stat.S_IMODE(mode|0o111))


def exe(cmd, args,
        cwd=None, daemon=False, env=None, quiet=False, commonjs=True):
    # Executes the command; returns the output or, if `daemon` is set,
    # the process object.
    if commonjs:
        setup_commonjs()
    args = [cmd] + args
    _env = {}
    _env.update(os.environ)
    if commonjs:
        _env.update(get_commonjs_environment())
    if env:
        _env.update(env)
    if not quiet:
        distutils.log.info("Executing %s" % " ".join(args))
    proc = subprocess.Popen(args,
            env=_env, cwd=cwd,
            stdin=subprocess.PIPE,
            stderr=subprocess.PIPE if not daemon else None,
            stdout=subprocess.PIPE if not daemon else None)
    if daemon:
        return proc
    out, err = proc.communicate()
    if proc.wait() != 0:
        if out:
            distutils.log.info(out)
        if err:
            distutils.log.info(err)
        raise distutils.errors.DistutilsSetupError(
                "failed to execute %s" % " ".join(args))
    return out, err


def node(args, cwd=None, daemon=False, env=None, quiet=False):
    # Executes `node args...`.
    result = exe('node', args, cwd=cwd, daemon=daemon, env=env, quiet=quiet)
    if daemon:
        return result
    else:
        out, err = result
        return out


def npm(args, cwd=None, env=None, quiet=False):
    # Executes `npm args...`.
    args = ['--loglevel', 'warn', '--color', 'false'] + args
    out, err = exe('npm', args, cwd=cwd, env=env, quiet=quiet)
    if out:
        log_command_output(out, prefix='STDOUT: ')
    # Check if npm emitted warning such as EPEERINVALID, we consider these to be
    # errors
    if any(line.startswith('npm WARN EPEERINVALID') for line in err.split('\n')):
        if err:
            distutils.log.info(err, prefix='STDERR: ')
        raise distutils.errors.DistutilsSetupError(
                "failed to execute npm %s" % " ".join(args))


YARN_DEFAULT_ARGS = [
    '--silent',
    '--no-progress',
    '--non-interactive',
    '--mutex', 'file:/tmp/.yarn-%s-mutex' % (USER,)
]


def yarn(command, args, cwd=None, env=None, quiet=False):
    # Executes `yarn args...`.
    if command:
        args = command + YARN_DEFAULT_ARGS + args
    else:
        args = YARN_DEFAULT_ARGS + args
    out, err = exe('yarn', args, cwd=cwd, env=env, quiet=quiet)
    if out:
        log_command_output(out, prefix='STDOUT: ')


def log_command_output(output, prefix='> '):
    lines = output.strip().split('\n')
    for line in lines:
        distutils.log.info('%s%s' % (prefix, line))


def static_filename(dist, *path_segments):
    dist = to_dist(dist)
    # Skip packages without CommonJS components.
    if not dist.has_metadata('rex_static.txt'):
        return
    static = dist.get_metadata('rex_static.txt')
    if not os.path.exists(static):
        # rex_static.txt is broken when a dist is installed via wheel dist format
        # so # maybe we can find static dir it in the standard location?
        static = os.path.join(
                sys.prefix, 'share/rex', os.path.basename(static))
        if not os.path.exists(static):
            return
    return os.path.join(static, *path_segments)


def package_filename(dist, *filename):
    """ Return the absolute path to the JS package embedded in the Python
    package.

    If ``filename`` is provided then it will returned as absolute path to the
    filename inside the package.

    If Python package doesn't have JS package embedded then ``None`` will be
    returned.

    :param dist: Package distribution
    :type dist: pkg_resources.Distribution
    :keyword filename: Optional filename inside the JS package
    """
    static = static_filename(dist)
    if static is None:
        return
    if not os.path.exists(os.path.join(static, 'js', 'package.json')):
        return
    js_filename = os.path.abspath(os.path.join(static, 'js'))
    if filename is not None:
        js_filename = os.path.join(js_filename, *filename)
        if not os.path.exists(js_filename):
            return
    return js_filename


def read(dist, filename):
    filename = package_filename(dist, filename)
    if not filename:
        return None
    with open(filename, 'r') as stream:
        return stream.read()


def read_json(dist, filename):
    filename = package_filename(dist, filename)
    if not filename:
        return None
    with open(filename, 'r') as stream:
        try:
            meta = json.load(stream)
            if not isinstance(meta, dict):
                raise ValueError("an object expected")
        except ValueError as exc:
            raise distutils.errors.DistutilsSetupError(
                    "ill-formed JSON in %s: %s" % (filename, exc))
        else:
            return meta


def validate_package_metadata(filename, meta, expected_name, expected_version):
    """ Validate package metadata against ``expected_name`` and
    ``expected_version``.
    """
    if meta.get('name') != expected_name:
        raise distutils.errors.DistutilsSetupError(
                "unexpected JS package name in %s: expected %s; got %s"
                % (filename, expected_name, meta.get('name')))
    if meta.get('version') != expected_version:
        raise distutils.errors.DistutilsSetupError(
                "unexpected JS package version in %s: expected %s; got %s"
                % (filename, expected_version, meta.get('version')))
    if meta.get('dependencies') and not isinstance(meta['dependencies'], dict):
        raise distutils.errors.DistutilsSetupError(
                "\"dependencies\" key should be a JSON object in %s"
                % filename)
    if meta.get('peerDependencies') and not isinstance(meta['peerDependencies'], dict):
        raise distutils.errors.DistutilsSetupError(
                "\"peerDependencies\" key should be a JSON object in %s"
                % filename)
    if meta.get('devDependencies') and not isinstance(meta['devDependencies'], dict):
        raise distutils.errors.DistutilsSetupError(
                "\"devDependencies\" key should be a JSON object in %s"
                % filename)
    if meta.get('rex'):
        if not isinstance(meta['rex'], dict):
            raise distutils.errors.DistutilsSetupError(
                    "\"rex\" key should be a JSON object in %s"
                    % filename)
        if meta['rex'].get('dependencies') and not isinstance(meta['rex']['dependencies'], dict):
            raise distutils.errors.DistutilsSetupError(
                    "\"rex.dependencies\" key should be a JSON object in %s"
                    % filename)


def bootstrap(execute=dummy_execute):
    """ Bootstrap CommonJS environment.

    This includes installing/updating npm version within the environment,
    installing bunlder with other utilities.
    """
    path = node(['-p',
                 'try { require.resolve("@prometheusresearch/react-scripts/bin/react-scripts.js") } catch (e) {""}'],
                 quiet=True)
    if not path.strip():
        def bootstrap_yarn():
            url, md5_hash = download.parse_url(YARN_URL)
            yarn_data = download.download(url, md5_hash=md5_hash)
            yarn_path = os.path.join(sys.prefix, 'bin', 'yarn')
            with open(yarn_path, 'w') as f:
                f.write(yarn_data)
            yarn_stat = os.stat(yarn_path)
            os.chmod(yarn_path, yarn_stat.st_mode | stat.S_IEXEC)

        def bootstrap_npm():
            npm_path = find_executable('npm', 'npm')
            out, err = exe(npm_path, ['--version'])
            npm_version = out.strip()
            if npm_version[0] not in ('4', '3', '2'):
                npm(['install', '--global', 'npm@2.x.x'])
            npm(['install', '--global', 'npm@' + NPM_VERSION])

        def bootstrap_react_scripts():
            deps = [
                '@prometheusresearch/react-scripts@%s' % REACT_SCRIPTS_VERSION,
                'nan@2.6.2', # this is required for yarn to function propely
            ]
            npm(['install', '--global'] + deps)

        execute(bootstrap_yarn, (), 'Installing yarn')
        execute(bootstrap_npm, (), 'Installing npm')
        execute(bootstrap_react_scripts, (), 'Installing react-scripts')


class Sandbox(object):

    def __init__(self, root, files=None, execute=dummy_execute, format_path=None):
        self.root = root
        self.files = files or {}
        self.execute = execute
        self.format_path = format_path or (lambda p: p)

    def path(self, *p):
        return os.path.join(self.root, *p)

    def __enter__(self):
        self.execute(
                self._create, (),
                'Sandbox (%s) creating' % self.format_path(self.root))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.execute(
                self._remove, (),
                'Sandbox (%s) removing' % self.format_path(self.root))

    def _create(self):
        rm(self.root)
        mkdir(self.root)
        for filename, content in sorted(self.files.items()):
            if content is None:
                continue
            filename = os.path.join(self.root, filename)
            msg = 'Sandbox (%s) writing %s' % (
                self.format_path(self.root),
                os.path.relpath(filename, self.root))
            self.execute(self._write_file, (filename, content), msg)

    def _write_file(self, filename, content):
        mkdir(os.path.dirname(filename))
        with open(filename, 'w') as f:
            if isinstance(content, str):
                f.write(content)
            else:
                f.write(json.dumps(content, indent=2, sort_keys=True))

    def _remove(self):
        rm(self.root)


def install_package(dist, skip_if_installed=False, execute=dummy_execute,
        dest=None,
        force_npm_link=False,
        npm_install_production=True):
    if not isinstance(dist, pkg_resources.Distribution):
        req = dist
        if not isinstance(req, pkg_resources.Requirement):
            req = pkg_resources.Requirement.parse(req)
        dist = get_distribution(req)
    req = to_requirement(dist)
    dest = dest or package_filename(dist)
    if not dest:
        return
    if skip_if_installed and os.path.exists(os.path.join(dest, 'node_modules')):
        return

    def format_path(path):
        return os.path.join('static', 'js', os.path.relpath(path, dest))

    execute(bootstrap, (execute,), 'Initializing JavaScript build environment')

    package = read_json(dist, 'package.json')
    yarn_lock = read(dist, 'yarn.lock')

    if not 'dependencies' in package:
        package['dependencies'] = {}

    files = {
        'package.json': package,
        'yarn.lock': yarn_lock,
    }

    python_dependencies = collect_dependencies(dist)
    for pyname, jsname, jspath in python_dependencies:
        # Read dep's meta and split all py dependencies from there, we do this
        # as those py deps will be included transitively into root package.
        jsmeta = read_json(pyname, 'package.json')
        if 'dependencies' in jsmeta:
            for dep, deprange in list(jsmeta['dependencies'].items()):
                if deprange.startswith('file:./rex_node_modules'):
                    jsmeta['dependencies'].pop(dep)

        package['dependencies'][jsname] = 'file:./rex_node_modules/%s' % jsname
        files['rex_node_modules/%s/package.json' % jsname] = jsmeta

    sandbox = Sandbox(
        os.path.join(dest, '.sandbox'),
        files=files,
        execute=execute,
        format_path=format_path)

    with sandbox as sandbox:

        # Install dependencies (and devDependencies if needed)
        if npm_install_production:
            execute(yarn,
                    (None, ['--production'], sandbox.root),
                    'Installing npm dependencies')
        else:
            execute(yarn,
                    (None, [], sandbox.root),
                    'Installing npm dependencies and devDependencies')

        # Install peerDependencies
        if package.get('peerDependencies'):
            peer_dependencies = list(package['peerDependencies'].items())
            peer_dependencies = ['%s@%s' % (k, v) for k, v in peer_dependencies]
            execute(yarn,
                    (['add'], ['--no-lockfile'] + peer_dependencies, sandbox.root),
                    'Installing npm peerDependencies')

        # Link and/or copy files for python dependencies
        PATHS_TO_IGNORE = set(['node_modules', 'package-lock.json', 'yarn.lock'])
        for pyname, jsname, jspath in python_dependencies:
            is_dev_install = os.path.islink(static_filename(pyname))
            items = os.listdir(jspath)

            for item in items:
                installed_path = sandbox.path('node_modules', jsname, item)
                src_path = os.path.join(jspath, item)
                if item in PATHS_TO_IGNORE:
                    continue
                if is_dev_install or force_npm_link:
                    execute(replace_with_link, (installed_path, src_path),
                            'Linking %s/%s' % (jsname, item))
                elif os.path.isdir(src_path):
                    execute(shutil.copytree, (src_path, installed_path),
                            'Copy tree %s/%s' % (jsname, item))
                else:
                    execute(shutil.copyfile, (src_path, installed_path),
                            'Copy file %s/%s' % (jsname, item))

        def transfer_from_sandbox(name):
            orig = sandbox.path(name)
            target = os.path.join(dest, name)
            execute(rm, (target,),
                    'Removing static/%s' % format_path(target))
            if os.path.exists(orig):
                execute(shutil.move, (orig, target),
                        'Moving static/%s to static/%s' % (format_path(orig), format_path(target)))

        transfer_from_sandbox('node_modules')
        transfer_from_sandbox('yarn.lock')


def collect_dependencies(dist):
    result = []
    seen = {}
    for req, pyname, jsname, jspath in _collect_dependencies(dist):
        if not jsname in seen:
            result.append((pyname, jsname, jspath))
        seen.setdefault(jsname, set()).add(to_requirement(dist).key)
    return result

def _collect_dependencies(dist):
    dist = to_dist(dist)
    req = to_requirement(dist)
    if package_filename(dist, 'bower.json'):
        raise distutils.errors.DistutilsSetupError(
            "Package %s has static/js/bower.json metadata which should be "
            "replaced with package.json metadata starting with Rex Setup 3.0. "
            "See %s for upgrade instructions." % (
                dist, MIGRATION_DOCS))
    filename = package_filename(dist, 'package.json')
    meta = read_json(dist, 'package.json')
    validate_package_metadata(filename, meta, to_js_name(req.key), dist.version)
    if meta:
        mask = meta.get('rex', {}).get('dependencies')
        for pyname in dist.requires():
            jsname = to_js_name(pyname)
            if mask is not None and mask.get(jsname) is False:
                continue
            if not package_filename(pyname, 'package.json'):
                continue
            for _subdeps in _collect_dependencies(pyname):
                yield _subdeps
            yield req, pyname, jsname, package_filename(pyname)


def to_requirement(req):
    if isinstance(req, pkg_resources.Requirement):
        return req
    elif isinstance(req, pkg_resources.Distribution):
        return req.as_requirement()
    else:
        return pkg_resources.Requirement.parse(req)


def to_dist(dist):
    if not isinstance(dist, pkg_resources.Distribution):
        dist = get_distribution(dist)
    if dist is None:
        raise distutils.errors.DistutilsSetupError(
            "failed to find a Python package with embedded JS package: %s" % dist)
    return dist


MIGRATION_DOCS = "https://doc.rexdb.us/rex.setup/3.0.0/guide.html#migrating-from-bower-json-to-package-json"


def replace_with_link(src, dest):
    rm(src)
    os.symlink(dest, src)


def rm(path):
    if os.path.exists(path):
        if os.path.islink(path):
            os.unlink(path)
        elif os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)


def mkdir(path):
    try:
        os.makedirs(path)
    except OSError as err:
        if err.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise


def get_distribution(req):
    # Returns a distribution object for the given requirement string.
    if isinstance(req, pkg_resources.Distribution):
        return req
    if not isinstance(req, pkg_resources.Requirement):
        req = pkg_resources.Requirement.parse(req)
    try:
        return pkg_resources.get_distribution(req)
    except pkg_resources.DistributionNotFound:
        pass


def to_js_name(req):
    if isinstance(req, pkg_resources.Requirement):
        req = req.key
    return req.replace('.', '-').replace('_', '-')
