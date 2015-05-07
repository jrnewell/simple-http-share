#!/usr/bin/env node

var connect = require('connect');
var os = require('os');
var formidable = require('formidable');
var util = require('util');
var url = require('url');
var fs = require('fs');
var path = require('path');
var EasyZip = require('easy-zip2').EasyZip;
var commander = require('commander');
var directory = require('./connect/directory');

commander
  .version(require('./package.json').version)
  .option('-a, --auth <password>', 'Protect with basic HTTP auth')
  .option('-h, --hostname <address>', 'Bind to hostname', '0.0.0.0')
  .option('-p, --port <num>', 'Port Number', 8080)
  .option('-i, --interface <num>', 'Bind to Network Interface', 0)
  .option('-s, --show-hidden-files', 'Shows hidden files in directory', false)
  .option('-q, --quiet', 'Don\'t log http requests', false)
  .option('-u, --disable-uploads', 'Disables the upload file feature', false)
  .option('-v, --verbose', 'Log more verbose http requests', false)
  .parse(process.argv);

var workingDirectory = process.cwd();
var authPassword = commander.auth;
var hostname = commander.hostname;
var port = parseInt(commander.port);
var interfaceIdx = parseInt(commander.interface);
var showHidden = commander.showHiddenFiles
var disableUploads = commander.disableUploads;

var getIPAddress = function(ifaceIdx) {
    var ifaces = os.networkInterfaces();
    idx = 0;
    for (var dev in ifaces) {
        var iface = ifaces[dev];
        for (var i = 0; i < iface.length; i++) {
            var details = iface[i];
            if (details.family === 'IPv4') {
                idx += 1;
                if (idx === ifaceIdx) {
                    return details.address.toString();
                }
            }
        }
    }
    return '0.0.0.0';
}

var getAllIPAddress = function() {
    var result = [];
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
        var iface = ifaces[dev];
        for (var i = 0; i < iface.length; i++) {
            var details = iface[i];
            if (details.family === 'IPv4') {
                result.push(details.address.toString());
            }
        }
    }
    return result;
}

var zipFolderHandler = function(req, res, next) {
    if (url.parse(req.url).pathname === '/zipfolder' && req.method.toLowerCase() === 'get' && req.query && req.query.target) {
        var easyZip = new EasyZip();
        var targetPath = path.normalize(path.join(workingDirectory, req.query.target));

        fs.exists(targetPath, function(exists) {
            if (!exists) {
                res.statusCode = 404;
                res.end("Unknown path");
                return;
            }

            easyZip.zipFolder(targetPath, showHidden, function(err) {
                if (err) {
                    res.statusCode = 500;
                    res.end(err.toString());
                    return;
                }

                var folderName = path.basename(targetPath).replace(/[\/\\]/g, "");
                if (!folderName || folderName.length === 0) {
                    folderName = "folder";
                }
                easyZip.writeToResponse(res, folderName);
            });
        });
        return;
    }
    next();
}

var uploadHandler = function(req, res, next) {
    if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
        // if uploads are disabled, send back 403
        if (disableUploads) {
            res.statusCode = 403;
            res.end("Forbidden: uploads disabled");
            return;
        }

        var form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files) {
            if (err) {
                console.log("upload error: " + err.toString());
                res.statusCode = 400;
                next(err);
                return;
            }

            var inStream = fs.createReadStream(files.upload.path);
            var outStream = fs.createWriteStream(path.join(workingDirectory, files.upload.name));

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

// if the user wanted to use a network interface, instead of specifying a hostname
if (interfaceIdx > 0) {
    hostname = getIPAddress(interfaceIdx);
}

var server = connect();

// enable basic http auth if given a password (don't care about the user)
if (typeof authPassword !== 'undefined' && authPassword) {
    server.use(connect.basicAuth(function(user, pass){
        return pass === authPassword;
    }));
}

server
    .use(connect.query())
    .use(connect.favicon());

if (!commander.quiet) {
    var format = commander.verbose ? 'default' : 'short';
    server.use(connect.logger(format))
}

server
    .use(connect.static(workingDirectory, {dotfiles: (showHidden ? 'allow' : 'ignore')}))
    .use(uploadHandler)
    .use(zipFolderHandler)
    .use(directory(workingDirectory, {icons: true, hidden: showHidden, upload: !disableUploads}));

server.listen(port, hostname, function() {
    console.log("http server listening on " + hostname + ":" + port);
    if (hostname === null || hostname === '0.0.0.0') {
        console.log("  hostnames:");
        var addresses = getAllIPAddress();
        for (var i = 0; i < addresses.length; i++) {
            console.log("    " + addresses[i]);
        }
    }
    console.log("  root: " + workingDirectory);
    console.log("  basic auth: " + (authPassword ? "enabled" : "disabled"));
    console.log("  showHidden: " + (showHidden ? "yes" : "no"));
    console.log("  uploads: " + (disableUploads ? "disabled" : "enabled"));
});

// graceful ctrl+c shutdown
var readLine = require("readline");
if (process.platform === "win32") {
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
