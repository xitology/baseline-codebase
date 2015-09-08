#
# Copyright (c) 2015, Prometheus Research, LLC
#


from setuptools import setup


setup(
    name='rex.platform',
    version='4.9.0',
    description='RexDB Capstone Project',
    long_description=open('README.rst', 'r').read(),
    author='Prometheus Research, LLC',
    author_email='contact@prometheusresearch.com',
    license='AGPLv3',
    classifiers=[
        'Programming Language :: Python :: 2.7',
    ],
    url='https://bitbucket.org/rexdb/rex.platform',
    include_package_data=True,
    install_requires=[
        'HTSQL==2.3.3.20150901',
        'HTSQL-PGSQL==2.3.3.20150901',
        'COGS==0.4.0',
        'rex.action==0.4.0',
        'rex.applet==2.2.0',
        'rex.setup==3.1.0',
        'rex.core==1.11.2',
        'rex.ctl==2.0.2',
        'rex.db==3.3.1',
        'rex.deploy==2.3.2',
        'rex.expression==1.5.2',
        'rex.forms==1.0.0',
        'rex.i18n==0.4.4',
        'rex.instrument==1.0.0',
        'rex.logging==1.0.0',
        'rex.port==1.0.4',
        'rex.restful==1.0.0',
        'rex.urlmap==2.6.2',
        'rex.web==3.5.0',
        'rex.widget==1.1.1',
    ],
)

