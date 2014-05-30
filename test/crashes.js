"use strict";

var assert = require('assert');
var Athena = require('odyssey').athena;
var Common = require('./helpers/common');
var Oshi = require('..');

suite('Crashes', function ()
{
	var group;

	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);

	test('Immediate Crash should not try to restart', function (done)
	{
		var options;
		Athena.waterfall
		(
			[
				function (cb)
				{
					Common.api.prepare('test/helpers/crash-test-app.js', cb);
				},
				function (cb, g)
				{
					group = g.config;
					options =
					{
						group: group.name,
						port: 6002
					};
					Common.api.start(options, cb);
				},
				function (cb, response)
				{
					assert(response.started === false);
					assert(response.crashed === true);
					
					Common.api.status(options, cb);
				},
				function (cb, response)
				{
					assert(response.statusText === 'STOPPED');
					cb();
				}
			],
			function (hlog)
			{
				done(hlog.failed ? hlog : null);
			}
		);
	});

	test('Immediate Crash should emit handled event', function (done)
	{
		Athena.waterfall
		(
			[
				function (cb)
				{
					Common.api.prepare('test/helpers/crash-test-app.js', cb);
				},
				function (cb, g)
				{
					group = g.config;
					var options =
					{
						group: group.name,
						port: 6002
					};
					Common.api.start(options, function () {});
					
					Common.api.on('exit', { handled: true }, exitHandler);
					
					function exitHandler (info, data)
					{
						assert(info.handled);
						assert(info.event === 'exit');
						assert(data.expected === false);
						assert(data.code === 1);
						
						Common.api.removeListener(exitHandler);
						
						cb();
					}
				}
			],
			function (hlog)
			{
				done(hlog.failed ? hlog : null);
			}
		);
	});

	test('Delayed Crash should emit unhandled event', function (done)
	{
		var options, statusCallback;
		Athena.waterfall
		(
			[
				function (cb)
				{
					Common.api.prepare('test/helpers/crash-test-app.js', cb);
				},
				function (cb, g)
				{
					group = g.config;
					options =
					{
						group: group.name,
						port: 6002,
						args: ['--time', Date.now() + 500]
					};
					Common.api.start(options, function (error, response)
					{
						assert(!error, error);
						assert(response.started);
						assert(!response.crashed);
					});
					
					Common.api.on('exit', { handled: true }, exitHandler);
					
					function exitHandler (info, data)
					{
						assert(info.handled === false);
						assert(info.event === 'exit');
						assert(data.expected === false);
						assert(data.code === 1);
						
						Common.api.removeListener(exitHandler);

						statusCallback = cb;
						Common.api.status(options, cb);
					}
				},
				function (cb, response)
				{
					if (response.statusText === 'STARTING')
					{
						cb.enableReinvoke();
						setTimeout(function ()
						{
							Common.api.status(options, statusCallback);
						}, 20);
						return;
					}
					
					assert(response.statusText === 'RUNNING', 'Process should have been restarted after crash. Status was ' + response.statusText);
					cb();
				}
			],
			function (hlog)
			{
				done(hlog.failed ? hlog : null);
			}
		);
	});
});