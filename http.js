#!/usr/bin/env node

var connect = require('connect');
var os = require('os');
var formidable = require('formidable');
var util = require('util');
var fs = require('fs');
var directory = require('./connect/directory');

var workingDirectory = process.cwd();
var port = (process.argv.length > 2) ? parseInt(process.argv[2]) : 8080;
var ifaceCount = (process.argv.length > 3) ? parseInt(process.argv[3]) : 1;

var getIPAddress = function() {
    var ifaces = os.networkInterfaces();
    count = 0;
    for (var dev in ifaces) {
        var iface = ifaces[dev];
        for (var i = 0; i < iface.length; i++) {
            var details = iface[i];
            if (details.family === 'IPv4') {
                count += 1;
                if (count == ifaceCount) {
                    return details.address.toString();
                }
            }
        }
    }
}

var uploadHandler = function(req, res, next) {
    if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
        var form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files) {
            if (err) {
                console.log("upload error: " + err.toString());
                res.statusCode = 400;
                next(err);
                return;
            }

            var inStream = fs.createReadStream(files.upload.path);
            var outStream = fs.createWriteStream(workingDirectory + "/" + files.upload.name);

            inStream.pipe(outStream);
            inStream.on('end', function() {
                fs.unlinkSync(files.upload.path);

                res.writeHead(200, {'content-type': 'text/plain'});
                res.write('Received Upload:\n\n');
                res.end(util.inspect({fields: fields, files: files}));
            });

            inStream.on('error', function(err) {
                if (err) {
                    console.log("move file error: " + err.toString());
                    res.statusCode = 400;
                    next(err);
                    return;
                }
            });
        });
        return;
    }
    next();
}

connect.createServer(
    connect.logger('short'),
    connect().use(connect.favicon()),
    connect.static(workingDirectory),
    connect().use(uploadHandler),
    connect().use(directory(workingDirectory, {icons: true}))
).listen(port, function() {
    console.log("http server listening on " + port);
    console.log("  ip: " + getIPAddress());
    console.log("  root: " + workingDirectory);
});

// graceful ctrl+c shutdown
var readLine = require("readline");
if (process.platform === "win32"){
    var rl = readLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on ("SIGINT", function() {
        process.emit("SIGINT");
    });
}

process.on('SIGINT', function() {
    console.log("exiting...");
    process.exit(0);
});
