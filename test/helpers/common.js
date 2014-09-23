"use strict";

var assert = require('assert');
var Oshi = require('../..');

var daemon = null;
var IN_PROCESS = true; // whether to run the tests as a daemon, or in-process

var Common = module.exports;

Common.api = null;

Common.suiteSetup = function (done)
{
	if (IN_PROCESS && !daemon)
		daemon = new Oshi.Daemon(new Oshi.DaemonConfig());

	Oshi.Api.createApi(function (error, a)
	{
		Common.api = a;
		done(error);
	});
};

Common.suiteTeardown = function (done)
{
	var api = Common.api;
	Common.api = null;
	if (api && !IN_PROCESS)
		api.kill(done);
	else
		done();
};

Common.prepareAndStart = function (script, group, callback)
{
	Common.api.prepare(script, function (error, g)
	{
		if (error) return callback(error);

		Common.api.start(group, function (error, info)
		{
			if (error) return callback(error);

			assert(info.started === true);
			assert(info.restarted === false);
			assert(info.ready === false);

			callback(null, info);
		});
	});
};
