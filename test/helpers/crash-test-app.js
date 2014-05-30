
var i = process.argv.indexOf('--time');

var now = Date.now();
var time = Number(process.argv[i + 1]) || now;

var delay = time - now;

if (delay >= 0)
{
	setTimeout(function () { process.exit(1); }, delay);
}
else
{
	// if time was in the past, don't crash at all
	setInterval(function () { console.log("yay, I'm alive"); }, 2000);
}
