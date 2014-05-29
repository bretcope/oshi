
process.on('SIGTERM', function ()
{
	console.log("nope, you're gonna have to force me to go away");
});

process.on('message', function (msg)
{
	if (msg === 'SIGTERM')
		console.log("I'm not accepting messages either");
});

setInterval(function () { console.log('hello'); }, 1000);