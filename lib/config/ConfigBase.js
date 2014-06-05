"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

//

/* =============================================================================
 * 
 * Base Config Class
 *  
 * ========================================================================== */

module.exports = ConfigBase;

/**
 *
 * @param obj
 * @constructor
 */
function ConfigBase (obj)
{
	var prefix;
	var env;

	if (!obj)
	{
		env = process.env;
		prefix = getPrefix(this);
	}
	else
	{
		prefix = '';
		env = obj;
	}

	var props = Object.getOwnPropertyNames(this);

	var p;
	for (var i in props)
	{
		p = props[i];
		if (prefix + p in env)
		{
			if (typeof this[p] === 'number')
				this[p] = Number(env[prefix + p]);
			else
				this[p] = env[prefix + p]
		}
	}
}

/* -------------------------------------------------------------------
 * Public Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

ConfigBase.prototype.toEnv = function ()
{
	var ret = {};
	dotNotation(this, getPrefix(this), ret);
	return ret;
};
/* -------------------------------------------------------------------
 * Helper Functions << no methods >>
 * ---------------------------------------------------------------- */

//converts nested properties into a flat object with sub-keys separated with dots
function dotNotation (origObj, prefix, newObj)
{
	var keys = Object.keys(origObj);
	var k, v;
	for (var i in keys)
	{
		k = keys[i];
		v = origObj[k];
		if (v && typeof v === 'object')
			dotNotation(v, prefix + k + '.', newObj);
		else
			newObj[prefix + k] = v;
	}
}

function getPrefix (obj)
{
	if (obj.constructor.name === 'DaemonConfig')
		return 'oshi.daemon.';

	if (obj.constructor.name === 'ApiConfig')
		return 'oshi.api.';

	if (obj.constructor.name === 'ChildConfig')
		return 'oshi.child.';

	if (obj.constructor.name === 'GroupConfig')
		return 'oshi.group.' + obj.name.replace(/[^A-Za-z0-9_-]/g, '_') + '.';

	return 'oshi.';
}