"use strict";

var assert = require('assert');
var Oshi = require('..');

suite('Basic Functionality', function ()
{
	var api;
	var group1, group2;
	var instances = {};
	
	suiteSetup(function (done)
	{
//		new Oshi.Daemon(new Oshi.Config.HostConfig()); // uncomment this, and comment the suiteTeardown to run the daemon inside the same process as the tests
		Oshi.Api.createApi(function (error, a)
		{
			api = a;
			done(error);
		});
	});
	
	suiteTeardown(function (done)
	{
		if (api)
			api.kill(done);
		else
			done();
	});
	
	test('Prepare group A', function (done)
	{
		api.prepare('test/helpers/simple-test-app.js', function (error, g)
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
		api.start('simple-test-app:5107', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === false);
				
				instances.A1 = info;
			}
			
			done(error);
		});
	});
	
	test('Launch instance A2', function (done)
	{
		api.start('simple-test-app:5108', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === false);
				
				instances.A2 = info;
			}
			
			done(error);
		});
	});
	
	test('Prepare group B (with config)', function (done)
	{
		var conf = new Oshi.Config.GroupConfig({
			script: 'ready-test-app.js',
			name: 'group 2',
			cwd: require('path').join(__dirname, 'helpers'),
			readyEvent: 'good to go!'
		});
		
		api.prepare(conf, function (error, g)
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
		api.start('group 2:5117', function (error, info)
		{
			if (!error)
			{
				assert(info.started === true);
				assert(info.restarted === false);
				assert(info.ready === true);
				
				instances.B1 = info;
			}

			done(error);
		});
	});
	
	test('Stop instance by name', function (done)
	{
		var ins = instances.A2;
		delete instances.A2;
		api.stop(ins.group + ':' + ins.port, function (error, info)
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
				api.stop(ins, function (error, info)
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