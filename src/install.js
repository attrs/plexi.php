#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var http = require('http');
var chalk = require('chalk');
var ini = require('ini');
var osenv = require("osenv");
var Download = require('download');
var progress = require('download-status');
var wrench = require('wrench');
var ProgressBar = require('progress');
var inquirer = require("inquirer");
var targz = require('tar.gz');

function start() {
	var detected = [];
		
	if( process.platform.indexOf('win') === 0 ) {
		[path.resolve(osenv.home(), '/wamp', 'bin', 'php')].forEach(function(phpdir) {
			if( fs.existsSync(phpdir) ) {
				var files = fs.readdirSync(phpdir);

				for(var i=0; i < files.length; i++) {
					var phpbin = path.resolve(phpdir, files[i], 'bin', 'php.exe');					
					if( fs.existsSync(phpbin) && (~files[i].indexOf('php5.4') || ~files[i].indexOf('php5.5') || ~files[i].indexOf('php5.6')) ) detected.push(phpbin);
				}
			}
		});
		
		detected.reverse().push('Download');
	} else if( process.platform === 'darwin' ) {
		[path.resolve('/Applications/MAMP/bin/php/')].forEach(function(phpdir) {
			if( fs.existsSync(phpdir) ) {
				var files = fs.readdirSync(phpdir);

				for(var i=0; i < files.length; i++) {
					var phpbin = path.resolve(phpdir, files[i], 'bin', 'php');					
					if( fs.existsSync(phpbin) && (~files[i].indexOf('php5.4') || ~files[i].indexOf('php5.5') || ~files[i].indexOf('php5.6')) ) detected.push(phpbin);
				}
			}
		});
		
		detected.reverse();
	}
	
	inquirer.prompt([
		{
			type: "list",
			name: "phpbin",
			message: "PHP Path",
			choices: detected.concat(["System Default", "Input path directly"]),
			filter: function(value) {
				return ( value === 'System Default' ) ? '' : value;
			}
		}, {
			type: "input",
			name: "phpbin",
			message: "PHP Path",
			when: function(value) {
				if( value.phpbin === 'Input path directly' ) return true;
			},
			validate: function(value) {
				if( !value || fs.existsSync(value) ) return true;
			}
		}, {
			type: "list",
			name: "phpbin",
			message: "PHP Download",
			choices: [ "5.6(x64)", "5.6(x86)", "5.5(x64)", "5.5(x86)", "5.4(x86)" ],
			when: function(value) {
				if( value.phpbin === 'Download' ) return true;
			},
			validate: function(value) {
				var done = this.async();
				
				download(value, function(err, dir) {
					if( err ) return console.error(chalk.red('[tomcat] install error'), err);
					done(true);
				});
			}
		}
	], function( answers ) {
		console.log('answers', answers);
		
		fs.writeFileSync(path.resolve(__dirname, '..', 'config.ini'), ini.stringify({
			phpbin: answers.phpbin
		}));
	});
};

var urls = {
	'5.6(x64)': 'http://windows.php.net/downloads/releases/php-5.6.6-Win32-VC11-x64.zip',
	'5.6(x86)': 'http://windows.php.net/downloads/releases/php-5.6.6-Win32-VC11-x86.zip',
	'5.5(x64)': 'http://windows.php.net/downloads/releases/php-5.5.22-Win32-VC11-x64.zip',
	'5.5(x86)': 'http://windows.php.net/downloads/releases/php-5.5.22-Win32-VC11-x86.zip',
	'5.4(x86)': 'http://windows.php.net/downloads/releases/php-5.4.38-Win32-VC9-x86.zip'
};

function download(version, callback) {
	var url = urls[version];
	
	callback = (typeof callback === 'function') ? callback : function() {};
	
	if( !url ) return callback(new Error('illegal version:' + version));
	
	// check cache, if file exists in cache, use it
	var filename = url.substring(url.lastIndexOf('/') + 1);
	var userhome = osenv.home();
	var cachedir = path.resolve(userhome, '.plexi', 'php');
	var cachefile = path.resolve(cachedir, filename);
	
	if( !fs.existsSync(cachedir) ) {
		try {
			wrench.mkdirSyncRecursive(cachedir, 0777);
		} catch(err) {
			cachedir = path.resolve(__dirname, '..', 'download');
			cachefile = path.resolve(cachedir, filename);
			wrench.mkdirSyncRecursive(cachedir);
		}
	}
	
	if( !fs.existsSync(cachefile) ) {
		new Download({ mode: '755' })
		    .get(url)
		    .dest(cachedir)
			.use(function(instance, url) {
				process.stdout.write(chalk.green('Download\n'));
			})
			.use(progress())
			.run(function (err, files, stream) {
			    if (err) {
					fs.unlinkSync(cachefile);
					return callback(err);
				}
				
				new targz().extract(cachefile, cachedir, function(err){
				    if(err) {
						fs.unlinkSync(cachefile);
						return callback(err);
					}
					
					var extracted = cachefile.substring(0, cachefile.toLowerCase().lastIndexOf('.zip'));
					fs.unlinkSync(cachefile);
					fs.renameSync(extracted, cachefile);
					
					callback(null, cachefile);
				});
			});
	} else {
		callback(null, cachefile);
	}
}

start();