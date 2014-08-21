#
# Copyright (c) 2014, Prometheus Research, LLC
#


from setuptools import setup, find_packages


setup(
    name='rex.i18n_demo',
    version='1.0.0',
    description='Demo package for testing rex.i18n',
    package_dir={'': 'src'},
    packages=find_packages('src'),
    namespace_packages=['rex'],
    setup_requires=[
        'rex.setup',
    ],
    install_requires=[
        'rex.i18n',
    ],
    rex_init='rex.i18n_demo',
    rex_static='static'
)

