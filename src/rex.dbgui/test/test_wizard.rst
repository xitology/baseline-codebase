Generating Wizard
=================

DBGUI could generate wizards on a different database schemas. Here is a set of
examples of the simple schema which includes trunk, branch, cross and facets::


  >>> from rex.core import Rex
  >>> from rex.dbgui import root_wizard, table_wizard
  >>> import yaml
  >>> app = Rex('rex.dbgui_demo', db='pgsql:dbgui_demo', attach_dir='./build')
  >>> def print_wizard(table):
  ...     with app:
  ...         wizard = table_wizard(table)
  ...         assert isinstance(wizard.wizard, object)
  ...         print yaml.safe_dump(table_wizard(table), indent=2,
  ...                              default_flow_style=False)

It can generate the root wizard consisting of just one action::

  >>> with app:
  ...     print root_wizard().wizard  # doctest: +ELLIPSIS
  Wizard(actions={'dbgui': PickTable(doc=undefined, help=undefined, icon=undefined, id='dbgui', kind=undefined, title='Pick Table', width=undefined)}, doc=undefined, help=undefined, icon=undefined, id='dbgui', initial_context=None, kind=undefined, path=Start(then=[Execute(id='1073fbb5beef658458731538f9ecfaec', action='dbgui', then=[], action_instance=PickTable(doc=undefined, help=undefined, icon=undefined, id='dbgui', kind=undefined, title='Pick Table', width=undefined))]), states=<Domain default>, title='DBGUI', width=undefined)

It can generate the wizard for the base trunk table::

  >>> print_wizard('trunk') # doctest: +ELLIPSIS
  /trunk:
    action:
      id: trunk
      type: wizard
      title: 'DBGUI: trunk'
      path:
      - pick-trunk:
        - view-trunk:
          - edit-trunk:
            - replace: ../../../pick-trunk/view-trunk
          - view-facet:
            - edit-facet:
              - replace: ../../view-facet
        - pick-branch:
          - view-branch:
            - edit-branch:
              - replace: ../../../pick-branch/view-branch
          - drop-branch:
          - make-branch:
            - replace: ../../pick-branch/view-branch
        - pick-cross:
          - view-cross:
            - edit-cross:
              - replace: ../../../pick-cross/view-cross
          - drop-cross:
          - make-cross:
            - replace: ../../pick-cross/view-cross
        - drop-trunk:
        - make-trunk:
          - replace: ../../pick-trunk/view-trunk
      - view-source:
      actions:
        pick-trunk:
          type: pick
          title: Pick trunk
          entity:
            trunk: trunk
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - t_id
          search: string(id())~$search
          search_placeholder: Search by ID
        view-trunk:
          type: view
          title: View trunk
          entity:
            trunk: trunk
          fields:
          - t_id
          - t_data
        edit-trunk:
          type: edit
          title: Edit trunk
          entity:
            trunk: trunk
          fields:
          - t_id
          - t_data
        view-facet:
          type: view
          title: View facet
          entity:
            trunk: trunk
          input:
          - trunk: trunk
          fields:
          - facet.f_text
          - facet.f_int
        edit-facet:
          type: edit
          title: Edit facet
          entity:
            trunk: trunk
          input:
          - trunk: trunk
          value:
            trunk: $trunk
          fields:
          - facet.f_text
          - facet.f_int
        pick-branch:
          type: pick
          title: Pick branch
          entity:
            branch: branch
          input:
          - trunk: trunk
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - b_id
          mask: trunk=$trunk
          search: string(id())~$search
          search_placeholder: Search by ID
        view-branch:
          type: view
          title: View branch
          entity:
            branch: branch
          input:
          - trunk: trunk
          fields:
          - b_id
          - b_data
        edit-branch:
          type: edit
          title: Edit branch
          entity:
            branch: branch
          input:
          - trunk: trunk
          value:
            trunk: $trunk
          fields:
          - b_id
          - b_data
        drop-branch:
          type: drop
          title: Drop branch
          entity:
            branch: branch
        make-branch:
          type: make
          title: Make branch
          entity:
            branch: branch
          input:
          - trunk: trunk
          value:
            trunk: $trunk
          fields:
          - b_id
          - b_data
        pick-cross:
          type: pick
          title: Pick cross
          entity:
            cross: cross
          input:
          - trunk: trunk
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - cross_partner
          mask: trunk=$trunk
          search: string(id())~$search
          search_placeholder: Search by ID
        view-cross:
          type: view
          title: View cross
          entity:
            cross: cross
          input:
          - trunk: trunk
          fields:
          - cross_partner
        edit-cross:
          type: edit
          title: Edit cross
          entity:
            cross: cross
          input:
          - trunk: trunk
          value:
            trunk: $trunk
          fields:
          - cross_partner
        drop-cross:
          type: drop
          title: Drop cross
          entity:
            cross: cross
        make-cross:
          type: make
          title: Make cross
          entity:
            cross: cross
          input:
          - trunk: trunk
          value:
            trunk: $trunk
          fields:
          - cross_partner
        drop-trunk:
          type: drop
          title: Drop trunk
          entity:
            trunk: trunk
        make-trunk:
          type: make
          title: Make trunk
          entity:
            trunk: trunk
          fields:
          - t_id
          - t_data
  ...

It can handle the case when facet table is a parent of some other table::

  >>> print_wizard('trunk_facet_parent_case')
  /trunk_facet_parent_case:
    action:
      id: trunk_facet_parent_case
      type: wizard
      title: 'DBGUI: trunk_facet_parent_case'
      path:
      - pick-trunk-facet-parent-case:
        - view-trunk-facet-parent-case:
          - edit-trunk-facet-parent-case:
            - replace: ../../../pick-trunk-facet-parent-case/view-trunk-facet-parent-case
          - view-facet-parent:
            - edit-facet-parent:
              - replace: ../../view-facet-parent
            - pick-facet-branch:
              - view-facet-branch:
                - edit-facet-branch:
                  - replace: ../../../pick-facet-branch/view-facet-branch
              - drop-facet-branch:
              - make-facet-branch:
                - replace: ../../pick-facet-branch/view-facet-branch
        - drop-trunk-facet-parent-case:
        - make-trunk-facet-parent-case:
          - replace: ../../pick-trunk-facet-parent-case/view-trunk-facet-parent-case
      - view-source:
      actions:
        pick-trunk-facet-parent-case:
          type: pick
          title: Pick trunk_facet_parent_case
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - t_id
          search: string(id())~$search
          search_placeholder: Search by ID
        view-trunk-facet-parent-case:
          type: view
          title: View trunk_facet_parent_case
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - t_id
          - t_data
        edit-trunk-facet-parent-case:
          type: edit
          title: Edit trunk_facet_parent_case
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - t_id
          - t_data
        view-facet-parent:
          type: view
          title: View facet_parent
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - facet_parent.f_text
          - facet_parent.f_int
        edit-facet-parent:
          type: edit
          title: Edit facet_parent
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          value:
            trunk_facet_parent_case: $trunk_facet_parent_case
          fields:
          - facet_parent.f_text
          - facet_parent.f_int
        pick-facet-branch:
          type: pick
          title: Pick facet_branch
          entity:
            facet_branch: facet_branch
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - facet_parent
          - b_id
          mask: facet_parent.trunk_facet_parent_case=$trunk_facet_parent_case
          search: string(id())~$search
          search_placeholder: Search by ID
        view-facet-branch:
          type: view
          title: View facet_branch
          entity:
            facet_branch: facet_branch
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - b_id
          - b_data
        edit-facet-branch:
          type: edit
          title: Edit facet_branch
          entity:
            facet_branch: facet_branch
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          value:
            facet_parent: $trunk_facet_parent_case
          fields:
          - b_id
          - b_data
        drop-facet-branch:
          type: drop
          title: Drop facet_branch
          entity:
            facet_branch: facet_branch
        make-facet-branch:
          type: make
          title: Make facet_branch
          entity:
            facet_branch: facet_branch
          input:
          - trunk_facet_parent_case: trunk_facet_parent_case
          value:
            facet_parent: $trunk_facet_parent_case
          fields:
          - b_id
          - b_data
        drop-trunk-facet-parent-case:
          type: drop
          title: Drop trunk_facet_parent_case
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
        make-trunk-facet-parent-case:
          type: make
          title: Make trunk_facet_parent_case
          entity:
            trunk_facet_parent_case: trunk_facet_parent_case
          fields:
          - t_id
          - t_data
  <BLANKLINE>

It handles the ``user`` table differently (to avoid the naming conflict with
the ``$USER`` variable)::

  >>> print_wizard('user')
  /user:
    action:
      id: user
      type: wizard
      title: 'DBGUI: user'
      path:
      - pick-user:
        - view-user:
          - edit-user:
            - replace: ../../../pick-user/view-user
        - pick-cross-with-named-links:
          - view-cross-with-named-links:
            - edit-cross-with-named-links:
              - replace: ../../../pick-cross-with-named-links/view-cross-with-named-links
          - drop-cross-with-named-links:
          - make-cross-with-named-links:
            - replace: ../../pick-cross-with-named-links/view-cross-with-named-links
        - pick-user-access:
          - view-user-access:
            - edit-user-access:
              - replace: ../../../pick-user-access/view-user-access
          - drop-user-access:
          - make-user-access:
            - replace: ../../pick-user-access/view-user-access
        - drop-user:
        - make-user:
          - replace: ../../pick-user/view-user
      - view-source:
      actions:
        pick-user:
          type: pick
          title: Pick user
          entity:
            _user: user
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - name
          search: string(id())~$search
          search_placeholder: Search by ID
        view-user:
          type: view
          title: View user
          entity:
            _user: user
          fields:
          - name
        edit-user:
          type: edit
          title: Edit user
          entity:
            _user: user
          fields:
          - name
        pick-cross-with-named-links:
          type: pick
          title: Pick cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - _user: user
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - different_link_name
          mask: who=$_user
          search: string(id())~$search
          search_placeholder: Search by ID
        view-cross-with-named-links:
          type: view
          title: View cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - _user: user
          fields:
          - different_link_name
        edit-cross-with-named-links:
          type: edit
          title: Edit cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - _user: user
          value:
            who: $_user
          fields:
          - different_link_name
        drop-cross-with-named-links:
          type: drop
          title: Drop cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
        make-cross-with-named-links:
          type: make
          title: Make cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - _user: user
          value:
            who: $_user
          fields:
          - different_link_name
        pick-user-access:
          type: pick
          title: Pick user_access
          entity:
            user_access: user_access
          input:
          - _user: user
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - code
          mask: user=$_user
          search: string(id())~$search
          search_placeholder: Search by ID
        view-user-access:
          type: view
          title: View user_access
          entity:
            user_access: user_access
          input:
          - _user: user
          fields:
          - code
          - when
        edit-user-access:
          type: edit
          title: Edit user_access
          entity:
            user_access: user_access
          input:
          - _user: user
          value:
            user: $_user
          fields:
          - code
          - when
        drop-user-access:
          type: drop
          title: Drop user_access
          entity:
            user_access: user_access
        make-user-access:
          type: make
          title: Make user_access
          entity:
            user_access: user_access
          input:
          - _user: user
          value:
            user: $_user
          fields:
          - code
          - when
        drop-user:
          type: drop
          title: Drop user
          entity:
            _user: user
        make-user:
          type: make
          title: Make user
          entity:
            _user: user
          fields:
          - name
  <BLANKLINE>

It handles the case when link names are not equal to target table names::

  >>> print_wizard('trunk_with_named_links')
  /trunk_with_named_links:
    action:
      id: trunk_with_named_links
      type: wizard
      title: 'DBGUI: trunk_with_named_links'
      path:
      - pick-trunk-with-named-links:
        - view-trunk-with-named-links:
          - edit-trunk-with-named-links:
            - replace: ../../../pick-trunk-with-named-links/view-trunk-with-named-links
        - pick-cross-with-named-links:
          - view-cross-with-named-links:
            - edit-cross-with-named-links:
              - replace: ../../../pick-cross-with-named-links/view-cross-with-named-links
          - drop-cross-with-named-links:
          - make-cross-with-named-links:
            - replace: ../../pick-cross-with-named-links/view-cross-with-named-links
        - drop-trunk-with-named-links:
        - make-trunk-with-named-links:
          - replace: ../../pick-trunk-with-named-links/view-trunk-with-named-links
      - view-source:
      actions:
        pick-trunk-with-named-links:
          type: pick
          title: Pick trunk_with_named_links
          entity:
            trunk_with_named_links: trunk_with_named_links
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - t_id
          search: string(id())~$search
          search_placeholder: Search by ID
        view-trunk-with-named-links:
          type: view
          title: View trunk_with_named_links
          entity:
            trunk_with_named_links: trunk_with_named_links
          fields:
          - t_id
          - t_data
        edit-trunk-with-named-links:
          type: edit
          title: Edit trunk_with_named_links
          entity:
            trunk_with_named_links: trunk_with_named_links
          fields:
          - t_id
          - t_data
        pick-cross-with-named-links:
          type: pick
          title: Pick cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - trunk_with_named_links: trunk_with_named_links
          fields:
          - expression: string(id())
            label: id()
            type: calculation
            value_key: id
          - who
          mask: different_link_name=$trunk_with_named_links
          search: string(id())~$search
          search_placeholder: Search by ID
        view-cross-with-named-links:
          type: view
          title: View cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - trunk_with_named_links: trunk_with_named_links
          fields:
          - who
        edit-cross-with-named-links:
          type: edit
          title: Edit cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - trunk_with_named_links: trunk_with_named_links
          value:
            different_link_name: $trunk_with_named_links
          fields:
          - who
        drop-cross-with-named-links:
          type: drop
          title: Drop cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
        make-cross-with-named-links:
          type: make
          title: Make cross_with_named_links
          entity:
            cross_with_named_links: cross_with_named_links
          input:
          - trunk_with_named_links: trunk_with_named_links
          value:
            different_link_name: $trunk_with_named_links
          fields:
          - who
        drop-trunk-with-named-links:
          type: drop
          title: Drop trunk_with_named_links
          entity:
            trunk_with_named_links: trunk_with_named_links
        make-trunk-with-named-links:
          type: make
          title: Make trunk_with_named_links
          entity:
            trunk_with_named_links: trunk_with_named_links
          fields:
          - t_id
          - t_data
  <BLANKLINE>