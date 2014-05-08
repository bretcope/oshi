"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ChildProcess = require('child_process');
var FlexEvents = require('flex-events');
var Child = require('./child');

/* =============================================================================
 * 
 * Oshi.Group
 *  
 * ========================================================================== */

module.exports = Group;

function Group (groupConfig)
{
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	var _events = FlexEvents.setup(this);
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */

	this.config = groupConfig;
	this.children = {};

	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	this.destroy = function ()
	{
		for (var i in this.children)
			this.children[i].destroy();
		
		_events.destroy();
	};
}

/* -------------------------------------------------------------------
 * Public Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Group.prototype.start = function (options, callback)
{
	if (typeof options === 'number')
	{
		options = { port: options };
	}
	else if (!options || typeof options.port !== 'number')
	{
		callback(new TypeError('A port number must be specified for each process.'));
		return;
	}

	var child = this.children[options.port];
	if (!child)
		child = this.children[options.port] = new Child(options.port, this);
	
	child.start(options, callback);
};

Group.prototype.stop = function (options, callback)
{
	if (typeof options === 'number')
	{
		options = { port: options };
	}
	else if (!options || typeof options.port !== 'number')
	{
		callback(new TypeError('A port number must be specified for each process.'));
		return;
	}

	var child = this.children[options.port];
	if (!child)
		child = this.children[options.port] = new Child(options.port, this);

	child.stop(options, callback);
};
