*************
REX.CTL Tasks
*************

.. contents:: Table of Contents


Set up an environment::

    >>> from rex.asynctask import get_transport
    >>> from rex.core import Rex
    >>> from rex.ctl import Ctl, ctl
    >>> import time

    >>> def strip_coveragepy_warnings(output):
    ...     return '\n'.join([
    ...         line
    ...         for line in output.splitlines()
    ...         if not 'Coverage.py warning' in line
    ...     ])


asynctask-workers
=================

There is an ``asynctask-workers`` command that will start worker processes for
the queues configured in the application settings::

    >>> ctl('help asynctask-workers')
    ASYNCTASK-WORKERS - Launches processes for the rex.asynctask workers that are configured.
    Usage: rex asynctask-workers [<project>]
    <BLANKLINE>
    Starts worker processes according to the asynctask_workers setting that
    will continually watch the queues and process tasks as they come across.
    <BLANKLINE>
    Options:
      --require=PACKAGE        : include an additional package
      --set=PARAM=VALUE        : set a configuration parameter
      --scheduler              : if specified, this process will act as the initiator for any ScheduledAsyncTaskWorkers that are configured. This should only be enabled for one process in cluster of workers.
      -q/--quiet               : if specified, no logging output will be produced
    <BLANKLINE>

If no workers are configured, it will bail::

    >>> ctl('asynctask-workers rex.asynctask --set=asynctask_workers={}')
    INFO:AsyncTaskWorkerTask:No workers configured; terminating.

    >>> ctl("asynctask-workers rex.asynctask_demo --set=asynctask_workers='{\"foo\": null}'")
    INFO:AsyncTaskWorkerTask:No workers configured; terminating.


Otherwise, it will launch the configured workers and attach them to their
specified queues::

    >>> worker_ctl = Ctl('asynctask-workers rex.asynctask_demo')
    >>> time.sleep(2)  # give the task a little time to spin up

    >>> rex = Rex('rex.asynctask_demo')
    >>> rex.on()
    >>> transport = get_transport()
    >>> transport.submit_task('foo', {'foo': 1})
    >>> time.sleep(1)

    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching demo_foo_worker to work on queue foo
    INFO:FooWorker:Starting; queue=foo
    DEBUG:FooWorker:Got payload: {u'foo': 1}
    FOO processed: {u'foo': 1}
    DEBUG:FooWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:FooWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete

    >>> transport.get_task('foo') is None
    True

    >>> rex.off()


The ``--quiet`` option will suppress all logging::

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --quiet --set=asynctask_workers='{\"foo\": \"demo_quiet_worker\"}'")
    >>> time.sleep(2)  # give the task a little time to spin up

    >>> rex = Rex('rex.asynctask_demo')
    >>> rex.on()
    >>> transport = get_transport()
    >>> transport.submit_task('foo', {'error': False})
    >>> time.sleep(1)

    >>> strip_coveragepy_warnings(worker_ctl.stop()) == ''
    True

    >>> transport.get_task('foo') is None
    True

    >>> rex.off()


Workers have the ability to resubmit the tasks they receive back into the
queue::

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --set=asynctask_workers='{\"foo\": \"requeue_worker\"}'")
    >>> time.sleep(2)  # give the task a little time to spin up

    >>> rex = Rex('rex.asynctask_demo')
    >>> rex.on()
    >>> transport = get_transport()
    >>> transport.submit_task('foo', {'foo': 1})
    >>> time.sleep(2)

    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching requeue_worker to work on queue foo
    INFO:RequeueWorker:Starting; queue=foo
    DEBUG:RequeueWorker:Got payload: {u'foo': 1}
    REQUEUE processed: {u'foo': 1}
    DEBUG:RequeueWorker:Requeued payload: {'foo': 2}
    REQUEUE requeued
    DEBUG:RequeueWorker:Processing complete
    DEBUG:RequeueWorker:Got payload: {u'foo': 2}
    REQUEUE processed: {u'foo': 2}
    DEBUG:RequeueWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:RequeueWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete

    >>> transport.get_task('foo') is None
    True

    >>> rex.off()


If the ``process()`` method of the ``AsyncTaskWorker`` should happen to raise
an exception, it won't cause the entire worker to die::

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --set=asynctask_workers='{\"foo\": \"demo_error_worker\"}'")
    >>> time.sleep(2)  # give the task a little time to spin up

    >>> rex = Rex('rex.asynctask_demo')
    >>> rex.on()
    >>> transport = get_transport()
    >>> transport.submit_task('foo', {'error': True})
    >>> transport.submit_task('foo', {'error': False})
    >>> time.sleep(1)

    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching demo_error_worker to work on queue foo
    INFO:ErrorWorker:Starting; queue=foo
    DEBUG:ErrorWorker:Got payload: {u'error': True}
    ERROR:ErrorWorker:An unhandled exception occurred while processing the payload
    Traceback (most recent call last):
    ...
    Exception: Oops!
    DEBUG:ErrorWorker:Got payload: {u'error': False}
    ERROR processed: {u'error': False}
    DEBUG:ErrorWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:ErrorWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete

    >>> transport.get_task('foo') is None
    True

    >>> rex.off()


If a worker dies, the master process will restart it::

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --set=asynctask_workers='{\"foo\": \"demo_fragile_worker\"}'")
    >>> time.sleep(1)  # give the task a little time to spin up

    >>> rex = Rex('rex.asynctask_demo')
    >>> rex.on()
    >>> transport = get_transport()
    >>> transport.submit_task('foo', {'die': True})
    >>> time.sleep(2)
    >>> transport.submit_task('foo', {'die': False})
    >>> time.sleep(1)

    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching demo_fragile_worker to work on queue foo
    INFO:FragileWorker:Starting; queue=foo
    DEBUG:FragileWorker:Got payload: {u'die': True}
    FRAGILE DYING!
    ERROR:AsyncTaskWorkerTask:Worker for queue foo died; restarting...
    INFO:AsyncTaskWorkerTask:Launching demo_fragile_worker to work on queue foo
    INFO:FragileWorker:Starting; queue=foo
    DEBUG:FragileWorker:Got payload: {u'die': False}
    FRAGILE processed: {u'die': False}
    DEBUG:FragileWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:FragileWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete

    >>> transport.get_task('foo') is None
    True

    >>> rex.off()


Tasks can be scheduled to execute at particular times::

    >>> from datetime import datetime, timedelta
    >>> def get_next_second(count=1):
    ...     now = datetime.now()
    ...     seconds = []
    ...     for i in range(count):
    ...         seconds.append((now + timedelta(seconds=(4 + (i * 2)))).second)
    ...     return ','.join(map(str, seconds))

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --scheduler --set=asynctask_workers='{\"foo\": null}' --set=asynctask_scheduled_workers='[{\"worker\": \"demo_bar_worker\", \"second\": \"%s\"}]'" % (get_next_second(2),))
    >>> time.sleep(10)  # give the task some time for the tasks to trigger
    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching demo_bar_worker to work on queue scheduled_0_demo_bar_worker
    INFO:AsyncTaskWorkerTask:Scheduling "demo_bar_worker" for {'second': ...}
    INFO:BarWorker:Starting; queue=scheduled_0_demo_bar_worker
    DEBUG:AsyncTaskWorkerTask:Triggering scheduled execution of demo_bar_worker
    DEBUG:BarWorker:Got payload: {}
    BAR processed: {}
    DEBUG:BarWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Triggering scheduled execution of demo_bar_worker
    DEBUG:BarWorker:Got payload: {}
    BAR processed: {}
    DEBUG:BarWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down scheduler
    DEBUG:AsyncTaskWorkerTask:Scheduler dead
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:BarWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --scheduler")
    >>> time.sleep(3)  # give the task a little time to spin up
    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching demo_foo_worker to work on queue foo
    INFO:AsyncTaskWorkerTask:No schedules configured -- not starting scheduler
    INFO:FooWorker:Starting; queue=foo
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:FooWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete


rex.ctl Tasks can be executed on a schedule::

    >>> worker_ctl = Ctl("asynctask-workers rex.asynctask_demo --scheduler --set=asynctask_workers='{\"foo\": null}' --set=asynctask_scheduled_workers='[{\"ctl\": \"demo-noisy-task\", \"second\": \"%s\"}, {\"ctl\": \"demo-quiet-task\", \"second\": \"%s\"}, {\"ctl\": \"demo-crashy-task\", \"second\": \"%s\"}]'" % tuple(get_next_second(3).split(',')))
    >>> time.sleep(12)  # give the task some time for the tasks to trigger
    >>> print strip_coveragepy_warnings(worker_ctl.stop())  # doctest: +ELLIPSIS
    INFO:AsyncTaskWorkerTask:Launching ctl_executor to work on queue scheduled_0_ctl_...
    INFO:AsyncTaskWorkerTask:Launching ctl_executor to work on queue scheduled_0_ctl_...
    INFO:AsyncTaskWorkerTask:Launching ctl_executor to work on queue scheduled_0_ctl_...
    INFO:AsyncTaskWorkerTask:Scheduling "demo-noisy-task" for {'second': ...}
    INFO:AsyncTaskWorkerTask:Scheduling "demo-quiet-task" for {'second': ...}
    INFO:AsyncTaskWorkerTask:Scheduling "demo-crashy-task" for {'second': ...}
    INFO:CtlExecutorWorker:Starting; queue=scheduled_0_ctl_...
    INFO:CtlExecutorWorker:Starting; queue=scheduled_0_ctl_...
    INFO:CtlExecutorWorker:Starting; queue=scheduled_0_ctl_...
    DEBUG:AsyncTaskWorkerTask:Triggering scheduled execution of ctl_executor
    DEBUG:CtlExecutorWorker:Got payload: {u'command': u'demo-noisy-task'}
    INFO:CtlExecutorWorker:Executing Task: demo-noisy-task
    INFO:CtlExecutorWorker:Hello world!
    DEBUG:CtlExecutorWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Triggering scheduled execution of ctl_executor
    DEBUG:CtlExecutorWorker:Got payload: {u'command': u'demo-quiet-task'}
    INFO:CtlExecutorWorker:Executing Task: demo-quiet-task
    DEBUG:CtlExecutorWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Triggering scheduled execution of ctl_executor
    DEBUG:CtlExecutorWorker:Got payload: {u'command': u'demo-crashy-task'}
    INFO:CtlExecutorWorker:Executing Task: demo-crashy-task
    ERROR:CtlExecutorWorker:Failed execution
    Traceback (most recent call last):
    ...
    Error: Received unexpected exit code:
        expected 0; got 1
    With output:
        FATAL ERROR: Oops, I crashed
    <BLANKLINE>
    From:
        rex demo-crashy-task
    DEBUG:CtlExecutorWorker:Processing complete
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down scheduler
    DEBUG:AsyncTaskWorkerTask:Scheduler dead
    DEBUG:AsyncTaskWorkerTask:Termination received; shutting down children
    INFO:CtlExecutorWorker:Terminating
    INFO:CtlExecutorWorker:Terminating
    INFO:CtlExecutorWorker:Terminating
    DEBUG:AsyncTaskWorkerTask:Children dead
    INFO:AsyncTaskWorkerTask:Complete
