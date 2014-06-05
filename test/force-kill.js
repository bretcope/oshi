"use strict";

var assert = require('assert');
var Athena = require('odyssey').athena;
var Common = require('./helpers/common');
var Oshi = require('..');

suite('Force Kill', function ()
{
	var group;

	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);

	test('Force kill a process', function (done)
	{
		Athena.waterfall
		(
			[
				function (cb)
				{
					group = new Oshi.GroupConfig('test/helpers/force-kill-test-app.js');
					group.useMessageOnWindows = true;
					group.gracefulTimeout = 200;
					Common.api.prepare(group, cb);
				},
				function (cb)
				{
					Common.api.start(group.name + ':6001', cb);
				},
				function (cb)
				{
					Common.api.stop(group.name + ':6001', cb);
				},
				function (cb, response)
				{
					assert(response.forced, 'The process should have been force killed.');
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