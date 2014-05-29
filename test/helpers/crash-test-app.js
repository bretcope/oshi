
var i = process.argv.indexOf('--delay');

var delay = Number(process.argv[i + 1]);
if (i === -1 || !delay)
	delay = 0;

setTimeout(function () { process.exit(1); }, delay);
