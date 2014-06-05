"use strict";

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