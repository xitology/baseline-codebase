#
# Copyright (c) 2014, Prometheus Research, LLC
#


from setuptools import setup, find_packages


setup(
    name='rex.instrument',
    version='1.2.0',
    description='Class interfaces and framework for using EDC components',
    long_description=open('README.rst', 'r').read(),
    author='Prometheus Research, LLC',
    author_email='contact@prometheusresearch.com',
    license='AGPLv3',
    classifiers=[
        'Programming Language :: Python :: 2.7',
    ],
    url='https://bitbucket.org/rexdb/rex.instrument-provisional',
    package_dir={'': 'src'},
    packages=find_packages('src'),
    include_package_data=True,
    namespace_packages=['rex'],
    entry_points={
        'rex.ctl': [
            'instrument = rex.instrument.ctl',
            'calculationset = rex.instrument.calculationsetctl'
        ],
    },
    install_requires=[
        'rex.core>=1.4,<2',
        'rex.ctl>=2,<3',
        'rios.core>=0.5,<0.6',
        'pytz>=0a',
    ],
    rex_init='rex.instrument',
)

