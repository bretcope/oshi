"use strict";

var assert = require('assert');
var Athena = require('odyssey').athena;
var Common = require('./helpers/common');
var Oshi = require('..');
var Package = require('../package.json');

suite('Events', function ()
{
	var group;
	
	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);

	test('Event from process', function (done)
	{
		Athena.waterfall
		(
			[
				function (cb)
				{
					Common.api.prepare('test/helpers/message-test-app.js', cb);
				},
				function (cb, g)
				{
					group = g.config;
					
					// setup an event on the API
					Common.api.on('message', { group: group.name, port: group.port }, function (info, data)
					{
						assert(info && typeof info === 'object');
						assert(info.group === group.name);
						assert(info.handled === false);
						assert(info.event === 'message');
						
						assert(data && typeof data === 'object');
						assert(data.message === 'hello');
						
						cb();
					});
					
					Common.api.start(group.name + ':6000', function (error)
					{
						if (error)
							cb(error);
					});
				}
			],
			function (hlog)
			{
				done(hlog.failed ? hlog : null);
			}
		);
	});

	test('Event filtering', function (done)
	{
		Athena.waterfall
		(
			[
				function (cb)
				{
					Common.api.removeListener('message');
					Common.api.stop(group.name + ':6000', cb);
				},
				function (cb)
				{
					var called = 0;
					var expected = 0;

					//filters which should not work
					Common.api.on('message', { group: 'wrong-group' }, unexpectedHandler);
					Common.api.on('message', { group: 'wrong-group', port: 1 }, unexpectedHandler);
					Common.api.on('message', { group: group.name, port: 1 }, unexpectedHandler);
					
					// filters which should work
					Common.api.on('message', expectedHandler);
					expected++;
					Common.api.on('message', { group: group.name }, expectedHandler);
					expected++;
					Common.api.on('message', { group: group.name, port: group.port }, expectedHandler);
					expected++;
					Common.api.on('message', { group: group.name, port: '*' }, expectedHandler);
					expected++;
					Common.api.on('message', { group: '*', port: '*' }, expectedHandler);
					expected++;
					
					Common.api.start(group.name + ':6000', function (error)
					{
						if (error)
							cb(error);
					});
					
					function unexpectedHandler (info)
					{
						console.log(info);
						called = expected + 1; // so that done doesn't get called again
						cb(new Error('Event was not filtered properly'));
					}
					
					function expectedHandler ()
					{
						called++;
						if (called === expected)
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
});