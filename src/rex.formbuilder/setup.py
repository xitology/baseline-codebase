#
# Copyright (c) 2014, Prometheus Research, LLC
#

from setuptools import setup, find_packages

setup(
    name='rex.formbuilder',
    version='5.9.3',
    description='A tool for creating and managing the Instruments and Forms in'
    ' a RexDB application.',
    long_description=open('README.rst', 'r').read(),
    author='Prometheus Research, LLC',
    author_email='contact@prometheusresearch.com',
    license='AGPLv3',
    classifiers=[
        'Programming Language :: Python :: 2.7',
    ],
    url='https://bitbucket.org/rexdb/rex.formbuilder-provisional',
    package_dir={'': 'src'},
    packages=find_packages('src'),
    include_package_data=True,
    namespace_packages=['rex'],
    install_requires=[
        'rex.core>=1.10,<2',
        'rex.web>=3.2,<4',
        'rex.instrument>=1.3,<2',
        'rex.expression>=1.5,<2',
        'rex.forms>=2,<3',
        'rex.restful>=1,<2',
        'rex.widget>=3,<4',
        'rex.action>=1,<2',
        'rex.i18n>=0.5,<0.6',
        'rex.form_previewer>=0.2,<0.11',
    ],
    rex_init='rex.formbuilder',
    rex_static='static')
