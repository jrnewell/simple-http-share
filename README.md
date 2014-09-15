# Simple HTTP Share

Simple HTTP Share is a small utility to quickly share files from a directory to other machines on the LAN using HTTP (similar to Python's SimpleHTTPServer).  You can also upload files to the host machine and quickly download entire folder contents.

![Screen Shot](https://raw.githubusercontent.com/jrnewell/simple-http-share/master/img/screen-shot.png "Screen Shot")

## Installation

```shell
npm -g install simple-http-share
```

## Usage

```shell
$ cd directory/to/share
$ simple-http
```

## Optional Arguments

```
Usage: simple-http [options]

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -a, --auth <password>     Protect with basic HTTP auth
    -h, --hostname <address>  Bind to hostname
    -p, --port <num>          Port Number
    -i, --interface <num>     Bind to Network Interface
    -s, --show-hidden-files   Shows hidden files in directory
    -u, --disable-uploads     Disables the upload file feature
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
