"use strict";

var athena = require('odyssey').athena;
var Oshi = require('../lib');

var api;
athena.waterfall
(
	[
		function (cb)
		{
			console.log('create');
			Oshi.Api.createApi(cb);
		},
		function (cb, a)
		{
			console.log('api');
			api = a;
			
			api.prepare('simple-test-app.js', cb);
		},
		function (cb, res)
		{
			console.log('prepared');
			console.log(res);
			
			api.start('simple-test-app:5000', cb);
		},
		function (cb, res)
		{
			console.log('started');
			console.log(res);
			
			api.stop('simple-test-app:5000', cb);
		},
		function (cb, res)
		{
			console.log('stopped');
			console.log(res);
			
			cb();
		}
	],
	function (hlog)
	{
		if (api)
		{
			api.kill(function (error)
			{
				console.log('killed');
				process.exit();
			});
		}
		
		if (hlog.failed)
		{
			console.log(hlog);
			console.log(hlog.stack);
		}
	}
);