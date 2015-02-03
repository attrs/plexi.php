#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var http = require('http');
var chalk = require('chalk');
var Semver = require('semver');
var Download = require('download');
var progress = require('download-status');
var wrench = require('wrench');
var ProgressBar = require('progress');
var osenv = require('osenv');
var ini = require('ini');

// http://php.org/php-4.1.tar.gz
// http://php.org/latest.tar.gz

function geturl(version) {
	return (!version || version === 'latest') ? 'http://php.org/latest.tar.gz' : 'http://php.org/php-' + version + '.tar.gz';
}

function rmdirRecursive(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                rmdirRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

var task_install = function () {
	process.stdin.resume();
	process.stdout.write(chalk.yellow('php version: ') + '' + chalk.gray('(latest) '));
	
	process.stdin.once('data', function(inputVersion) {
		process.stdin.pause();	
		inputVersion = inputVersion.replace(/[\n\r]/g, ' ').trim() || 'latest';
		var version = inputVersion;

		var download = function() {
			var url = geturl(version);
			var filename = url.substring(url.lastIndexOf('/') + 1);
			process.stdout.write(chalk.green('checking version: ' + version + ' (' + url + ') ... '));
	
			// check cache, if file exists in cache, use it
			var userhome = osenv.home();
			var cachedir = path.resolve(userhome, '.plexi.php');
			var cachefile = path.resolve(cachedir, filename);
			var dest = path.resolve(__dirname, '..', 'php');
			if( !fs.existsSync(cachedir) ) {
				try {
					fs.mkdirSync(cachedir);
				} catch(err) {
					cachedir = path.resolve(__dirname, '..', 'download');
					cachefile = path.resolve(cachedir, filename);
				}
			}
	
			var install = function() {		
				if( fs.existsSync(dest) ) rmdirRecursive(dest);
		
				var files = wrench.readdirSyncRecursive(cachefile);
				var total = files.length;
				var current = 0;

				var bar = new ProgressBar(chalk.cyan('   install') + ' : [:bar] :current/:total', {
					width: 20,
					total: total,
					callback: function() {
						console.log();
					}
				});

				wrench.copyDirSyncRecursive(cachefile, dest, {
					forceDelete: false,
					preserveFiles: true,
					filter: function() {
						bar.tick();
					}
				});
				
				task_phplocation();
			}
	
			if( !fs.existsSync(cachefile) ) {
				new Download({ extract: true, strip: 1, mode: '755' })
				    .get(url)
				    .dest(cachefile)
					.use(function(instance, url) {
						process.stdout.write(chalk.green('Download\n'));
					})
					.use(progress())
					.run(function (err, files, stream) {
					    if (err) {
							process.stdout.write(chalk.red('Error\n'));
							console.log(chalk.red(err));
					    	return task_install();
					    }
						install();
					}
				);
			} else {
				process.stdout.write(chalk.green('From Cache\n'));
				install();
			}
		};
		download();
	});
};

var task_phplocation = function () {
	process.stdin.resume();
	process.stdout.write(chalk.yellow('php location: ') + '' + chalk.gray('(default) '));
	
	process.stdin.once('data', function(phplocation) {
		process.stdin.pause();	
		phplocation = phplocation.replace(/[\n\r]/g, ' ').trim();		
		
		if(	phplocation ) {
			var config = {bin:phplocation};
			fs.writeFileSync(path.resolve(__dirname, '..', 'php-config.ini'), ini.stringify(config))
		}
	});
};

process.stdin.setEncoding('utf-8');
//task_install();
task_phplocation();