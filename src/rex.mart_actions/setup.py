#
# Copyright (c) 2016, Prometheus Research, LLC
#


from setuptools import setup, find_packages


setup(
    name='rex.mart_actions',
    version='0.9.1',
    description='A collection of RexAction actions and wizards for exploring'
    'RexMart databases.',
    long_description=open('README.rst', 'r').read(),
    author='Prometheus Research, LLC',
    author_email='contact@prometheusresearch.com',
    license='Apache-2.0',
    classifiers=[
        'Programming Language :: Python :: 2.7',
    ],
    url='https://bitbucket.org/rexdb/rex.mart_actions',
    package_dir={'': 'src'},
    packages=find_packages('src'),
    include_package_data=True,
    namespace_packages=['rex'],
    install_requires=[
        'rex.core',
        'rex.web',
        'rex.widget',
        'rex.action',
        'rex.mart',
        'rex.query',
        'htsql_excel>=0.1.3,<0.2',
        'cachetools>=1,<4',
    ],
    rex_init='rex.mart_actions',
    rex_static='static',
)

