"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ConfigBase = require('./ConfigBase');
var Util = require('util');

/* =============================================================================
 * 
 * ChildConfig Class
 *  
 * ========================================================================== */

module.exports = ChildConfig;
Util.inherits(ChildConfig, ConfigBase);

/**
 * @param [options] {object|string} Default options for child, or a shorthand string in
 * the form of 'groupName:port'.
 * @constructor
 */
function ChildConfig (options)
{
	if (typeof options === 'string')
	{
		var str = options;
		options = {};
		var match = /^([^:]+):(\d+)$/.exec(str);
		if (match)
		{
			options.groupName = match[1];
			options.port = Number(match[2]);
		}
	}

	if (!options || typeof options !== 'object')
	{
		throw new TypeError('Child config was not provided.');
	}

	if (!options.groupName || typeof options.groupName !== 'string')
	{
		throw new TypeError('A child config must contain a groupName.');
	}

	if (!options.port || typeof options.port !== 'number')
	{
		throw new TypeError('A port number must be provided for the child config.');
	}

	/** @member {number} */
	this.port = options.port;
	/** @member {string} */
	this.groupName = options.groupName;
	/**
	 * @member args {string[]} Additional arguments which pertain only to a single child instead of the
	 * entire group. These will be concatenated to any GroupConfig#args.
	 */
	this.args = [];
	/** @member {boolean} If true, the --debug flag will be appended to the node.js arguments for this child. */
	this.debug = false;
	/**
	 * @member {boolean} If set to true, attempting to start a process which is already running will
	 * neither cause a restart, nor return an error. Default false
	 */
	this.ifNotRunning = options.ifNotRunning;
	/**
	 * @member{boolean} If set to true, attempting to start a process which is already running will
	 * cause a restart. Default false
	 */
	this.restart = options.restart;

	// merge any additional options into this config object
	this.update(options);
}

/**
 * @param childConfig {ChildConfig}
 */
ChildConfig.prototype.update = function (childConfig)
{
	if (childConfig.args instanceof Array)
		this.args = childConfig.args;

	this.debug = childConfig.debug || this.debug;
	this.ifNotRunning = childConfig.ifNotRunning || this.ifNotRunning;
	this.restart = childConfig.restart || this.restart;
};
