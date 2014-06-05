"use strict";

var assert = require('assert');
var Common = require('./helpers/common');
var Oshi = require('..');
var Package = require('../package.json');

suite('Basic Functionality', function ()
{
	var group1, group2;
	var instances = {};
	
	suiteSetup(Common.suiteSetup);
	suiteTeardown(Common.suiteTeardown);
	
	test('Check version', function (done)
	{
		Common.api.version(function (error, version)
		{
			assert(version === Package.version);
			done(error);
		});
	});
	
	test('Prepare group A', function (done)
	{
		Common.api.prepare('test/helpers/simple-test-app.js', function (error, g)
		{
			if (!error)
			{
				group1 = g.config;
				assert(group1.name === 'simple-test-app');
			}
			
			done(error);
		});
	});
	
	test('Launch instance A1', function (done)
	{
		Common.api.start('simple-test-app:5107', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === false);
				
				instances.A1 = info.config;
			}
			
			done(error);
		});
	});
	
	test('Launch instance A2', function (done)
	{
		Common.api.start('simple-test-app:5108', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === false);
				
				instances.A2 = info.config;
			}
			
			done(error);
		});
	});
	
	test('Check status for instance A1', function (done)
	{
		Common.api.status('simple-test-app:5107', function (error, info)
		{
			assert(!error, error);
			assert(info.statusText === 'RUNNING');
			assert(info.statusCode === Oshi.Enums.STATUS.RUNNING);
			
			done();
		});
	});
	
	test('Prepare group B (with config)', function (done)
	{
		var conf = new Oshi.GroupConfig({
			script: 'ready-test-app.js',
			name: 'group 2',
			cwd: require('path').join(__dirname, 'helpers'),
			readyEvent: 'good to go!'
		});
		
		Common.api.prepare(conf, function (error, g)
		{
			if (!error)
			{
				group2 = g.config;
				assert.deepEqual(group2, conf);
			}
			
			done(error);
		});
	});
	
	test('Launch instance B1', function (done)
	{
		Common.api.start('group 2:5117', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === true);
				
				instances.B1 = info.config;
			}

			done(error);
		});
	});
	
	test('Stop instance by name', function (done)
	{
		var ins = instances.A2;
		delete instances.A2;
		Common.api.stop(ins.groupName + ':' + ins.port, function (error, info)
		{
			if (!error)
				assert(info.stopped === true);
			
			done(error);
		});
	});
	
	test('Stop remaining instances', function (done)
	{
		var keys = Object.keys(instances);
		var i = 0;
		stop();
		
		function stop ()
		{
			if (i < keys.length)
			{
				var ins = instances[keys[i]];
				i++;
				Common.api.stop(ins, function (error, info)
				{
					if (error)
					{
						done(error);
					}
					else
					{
						assert(info.stopped === true);
						stop();
					}
				});
			}
			else
			{
				done();
			}
			
		}
	});
});