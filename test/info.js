"use strict";

var assert = require('assert');
var Common = require('./helpers/common');
var debug = require('debug')('oshi-test:logging');
var Oshi = require('..');
var Package = require('../package.json');


suite('Process Info', function ()
{
	var procs = {
		'simple-test-app:5107': null,
		'simple-test-app:5108': null,
		'another-test-app:5109': null,
		'another-test-app:5110': null,
	};

	suiteSetup(function (done) 
	{
		Common.suiteSetup(function () 
		{
			var names = Object.keys(procs);
			var pending = names.length;
			function checkDone(name, err, info)
			{
				if (err) return done(err);
				procs[name] = info;
				if (--pending === 0)
					done();
			}

			names.forEach(function (name)
			{
				var parts = name.split(/:/);
				var script = 'test/helpers/' + parts[0] + '.js';
				Common.prepareAndStart(script, name, checkDone.bind(null, name));
			});
		});
	});

	suiteTeardown(function (done) 
	{
		var names = Object.keys(procs);
		var pending = names.length;

		function checkDone(name, err, info)
		{
			if (err) return done(err);
			procs[name] = null;
			if (--pending === 0)
				Common.suiteTeardown(done);
		}

		names.forEach(function (name)
		{
			Common.api.stop(name, checkDone.bind(null, name));
		});
	});

	function infoTest(name, names, cb)
	{
		test(name, function (done)
		{
			Common.api.info(names, function (err, info)
			{
				if (err) return done(err);
				cb(info);
				done();
			});
		});
	}

	suite('Single', function ()
	{
		var name = 'simple-test-app:5107';
		
		infoTest('returns info object', name, function (info)
		{
			debug('info: %j', info);
			assert(!!info, 'info object not returned');
		});

		infoTest('info object has group', name, function (info)
		{
			assert('simple-test-app' in info, 'expected group not found');
			assert(typeof info['simple-test-app'] === 'object', 'group name property is not object');
		});

		infoTest('group object has port', name, function (info)
		{
			var g1 = info['simple-test-app'];
			assert('5107' in g1, 'port number not in group object');
		});

		infoTest('info object looks right', name, function (info)
		{
			var i1 = info['simple-test-app']['5107'];
			assert(typeof i1 === 'object', 'info member is not an object');

			assert('cpu' in i1, 'cpu property not found');
			assert('memory' in i1, 'memory property not found');

			assert(typeof i1.cpu === 'number', 'cpu property is not a number');
			assert(typeof i1.memory === 'number', 'memory property is not a number');
		});
	});

	
	suite('Multiple', function ()
	{
		var names = [
			'simple-test-app:5107', 
			'simple-test-app:5108', 
			'another-test-app:5109',
			'another-test-app:5110'
		];

		infoTest('info object has all groups', names, function (info)
		{
			assert('simple-test-app' in info, 'simple-test-app not found');
			assert('another-test-app' in info, 'another-test-app not found');

			assert(typeof info['simple-test-app'] === 'object', 'simple-test-app name property is not object');
			assert(typeof info['another-test-app'] === 'object', 'another-test-app property is not object');
		});

		infoTest('info object has all children', names, function (info)
		{

			assert(typeof info['simple-test-app'] === 'object', 'simple-test-app name property is not object');
			assert(typeof info['another-test-app'] === 'object', 'another-test-app property is not object');
		});
	});
	
});
