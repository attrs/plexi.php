#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var http = require('http');
var chalk = require('chalk');
var ini = require('ini');

// http://php.org/php-4.1.tar.gz
// http://php.org/latest.tar.gz

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