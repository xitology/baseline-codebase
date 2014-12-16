#
# Copyright (c) 2014, Prometheus Research, LLC
#


from setuptools import setup, find_packages


setup(
    name='rex.formbuilder_demo',
    version='1.0.0',
    description='Demo package for testing rex.formbuilder',
    package_dir={'': 'src'},
    packages=find_packages('src'),
    namespace_packages=['rex'],
    setup_requires=[
        'rex.setup',
    ],
    install_requires=[
        'rex.formbuilder',
    ],
    rex_init='rex.formbuilder_demo',
    rex_static='static',
)
