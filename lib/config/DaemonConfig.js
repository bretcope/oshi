"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ConfigBase = require('./ConfigBase');
var Util = require('util');

/* =============================================================================
 * 
 * DaemonConfig Class
 *  
 * ========================================================================== */

module.exports = DaemonConfig;
Util.inherits(DaemonConfig, ConfigBase);

/**
 * @param [obj] {object}
 * @constructor
 */
function DaemonConfig (obj)
{
	/** @member {object} */
	this.env = {};
	/** @member {string} */
	this.cwd = process.cwd();

	/** @member {string} */
	this.nodeExec = process.execPath;
	/** @member {string[]} */
	this.nodeArgs = process.execArgv;

	/** @member {number} Default 200 */
	this.initTimeout = 200;

	/** @member {number} Default 4423 */
	this.rpcPort = 4423;
	/** @member {string} Default '0.0.0.0' */
	this.rpcHost = '0.0.0.0';

	/** @member {number} Default 4424 */
	this.eventsPort = 4424;
	/** @member {string} Default '0.0.0.0' */
	this.eventsHost = '0.0.0.0';

	ConfigBase.call(this, obj);
}
