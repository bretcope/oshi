"use strict";

var Enums = module.exports;

/* -------------------------------------------------------------------
 * Child Process Statuses
 * ---------------------------------------------------------------- */

Enums.STATUS =
{
	STARTING: 10,
	RUNNING: 20,
	STOPPING: 30,
	STOPPED: 40,
	ERROR: 50,
	UNDEFINED: 60
};

(function ()
{
	for (var name in Enums.STATUS)
	{
		Enums.STATUS[Enums.STATUS[name]] = name;
	}
})();
