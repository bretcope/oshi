
"use strict";

var assert = require('assert');
var Common = require('./helpers/common');
var Oshi = require('..');
var Package = require('../package.json');
var Path = require('path');
var Fs = require('fs');

function prepareAndStart(script, group, callback)
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
}

function clearLogFiles()
{
	var files = Fs.readdirSync(Path.resolve('logs'));
	files.forEach(function (file)
	{
		try
		{
			Fs.unlinkSync(Path.resolve('logs', file));
		}
		catch (e) { /* don't bother */ }
	});
}

suite('Log files', function ()
{
	
	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);

	suiteSetup(clearLogFiles);
	suiteTeardown(clearLogFiles);

	test('Process creates log file', function (done)
	{
		prepareAndStart('test/helpers/simple-test-app.js', 'simple-test-app:5107', function (error, info)
		{
			if (error) return done(error);
			
			assert(Fs.existsSync(Path.resolve('logs', 'simple-test-app_5107.out.log')));
			assert(Fs.existsSync(Path.resolve('logs', 'simple-test-app_5107.err.log')));
			
			done();
		});
	});
});
