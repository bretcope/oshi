"use strict";

var assert = require('assert');
var Athena = require('odyssey').athena;
var Common = require('./helpers/common');
var Oshi = require('..');
var Package = require('../package.json');

suite('Events', function ()
{
	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);

	test('Event from process', function (done)
	{
		var group;
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
					Common.api.on('message', group.name, function (info, data)
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
							done(error);

						console.log('connected');
					});
				}
			],
			function (hlog)
			{
				done(hlog.failed ? hlog : null);
			}
		);
	});
});