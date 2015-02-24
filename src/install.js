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

function download(options, callback) {	
	callback = (typeof callback === 'function') ? callback : function(err) {
		if( err ) throw err;
	};
	
	if( typeof options !== 'object' ) return callback(new Error('invalid options:' + JSON.stringify(options)));
	if( !options.url ) return callback(new Error('options.url missing:' + JSON.stringify(options)));
	if( !options.dest && !options.dir ) return callback(new Error('options.dest or dir missing:' + JSON.stringify(options)));
	
	var url = options.url;
	var dir = options.dir;
	var dest = options.dest;
	var extract = options.extract ? true : false;
	var strip = typeof options.strip === 'number' ? options.strip : 1;
	var mode = options.mode || '755';
	var filename = url.substring(url.lastIndexOf('/') + 1);
	
	if( dir ) dest = path.resolve(dir, filename);
	else if( dest ) dir = path.resolve(dest, '..');
		
	if( !fs.existsSync(dir) ) {
		try {
			wrench.mkdirSyncRecursive(dir, 0777);
		} catch(err) {
			dir = path.resolve(process, '..', 'download');
			dest = path.resolve(dir, filename);
			wrench.mkdirSyncRecursive(dir);
		}
	}
	
	if( !fs.existsSync(dest) ) {
		new Download({extract: extract, strip: strip, mode: mode })
		    .get(url)
		    .dest(dest)
			.use(function(instance, url) {
				process.stdout.write(chalk.green('Download\n'));
			})
			.use(progress())
			.run(function (err, files, stream) {
			    if (err) return callback(err);
				
				callback(null, dest);
			});
	} else {
		callback(null, dest);
	}
}

function phpinstall(callback) {
	var phpurls = {
		'5.6(x64)': 'http://windows.php.net/downloads/releases/php-5.6.6-Win32-VC11-x64.zip',
		'5.6(x86)': 'http://windows.php.net/downloads/releases/php-5.6.6-Win32-VC11-x86.zip',
		'5.5(x64)': 'http://windows.php.net/downloads/releases/php-5.5.22-Win32-VC11-x64.zip',
		'5.5(x86)': 'http://windows.php.net/downloads/releases/php-5.5.22-Win32-VC11-x86.zip',
		'5.4(x86)': 'http://windows.php.net/downloads/releases/php-5.4.38-Win32-VC9-x86.zip'
	};
	
	var detected = [];
		
	if( process.platform.indexOf('win') === 0 ) {
		[path.resolve(osenv.home(), '/wamp', 'bin', 'php')].forEach(function(phpdir) {
			if( fs.existsSync(phpdir) ) {
				var files = fs.readdirSync(phpdir);

				for(var i=0; i < files.length; i++) {
					var phpbin = path.resolve(phpdir, files[i], 'php.exe');					
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
				if( !value || (fs.existsSync(value) && fs.statSync(value).isFile()) ) return true;
			}
		}, {
			type: "list",
			name: "version",
			message: "PHP Download",
			choices: [ "5.6(x64)", "5.6(x86)", "5.5(x64)", "5.5(x86)", "5.4(x86)" ],
			when: function(value) {
				if( value.phpbin === 'Download' ) return true;
			}
		}
	], function( answers ) {
		if( answers.version ) {
			download({
				url: phpurls[answers.version],
				dir: path.resolve(osenv.home(), '.plexi', 'php'),
				extract: true
			}, function(err, dir) {
				if( err ) return callback(err);
				
				callback(null, path.resolve(dir, 'php.exe'));
			});
		} else {
			callback(null, answers.phpbin || '');
		}
	});
}

var config = {};
phpinstall(function(err, phpbin) {
	if( err ) throw err;
	
	config.phpbin = phpbin;
	
	fs.writeFileSync(path.resolve(__dirname, '..', 'config.ini'), ini.stringify(config));
});