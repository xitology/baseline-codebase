#
# Copyright (c) 2012-2013, Prometheus Research, LLC
#


from setuptools import setup, find_packages


setup(
    name='rex.core',
    version = "1.0.0",
    description="Foundation of the RexDB platform",
    long_description=open('README.rst', 'r').read(),
    maintainer="Prometheus Research, LLC",
    maintainer_email="contact@prometheusresearch.com",
    license="AGPLv3",
    url="http://bitbucket.org/prometheus/rex.core",
    package_dir={'': 'src'},
    packages=find_packages('src'),
    namespace_packages=['rex'],
    setup_requires=[
        'rex.setup >=1.0, <2',
    ],
    install_requires=[
        'rex.setup >=0.9, <2',
        'pyyaml',
    ],
    extras_require={
        'doc': ['Sphinx'],
        'test': ['pbbt'],
    },
    rex_init='rex.core',
)


