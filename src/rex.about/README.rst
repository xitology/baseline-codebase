*********************
REX.ABOUT Usage Guide
*********************

.. contents:: Table of Contents


Overview
========

This package provides the functionality for the RexDB About Screens.

This package is a part of the RexDB |R| platform for medical research data
management.  RexDB is free software created by Prometheus Research, LLC and is
released under the Apache v2 license with a commensurate attribution clause.  For
more information, please visit http://rexdb.org/.

The development of this product was supported by the National Institute of
Mental Health of the National Institutes of Health under Award Number
R43MH099826.

.. |R| unicode:: 0xAE .. registered trademark sign


Usage
=====

This package exposes a RexAction type named ``about`` that will display the
executing package's version, the versions of all the RexDB and non-RexDB
Python packages in the environment, as well as the RexDB license. This action
defines the following additional properties:

``overview``
    Sets the text that is displayed on the "Overview" tab, under the
    application version. Use HTML for formatting. Optional. If not specified,
    no text is displayed.

``license``
    Sets the text that is displayed on the "License" tab. Use HTML for
    formatting. Optional. If not specified, displays the RexDB license.

