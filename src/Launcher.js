var path = require('path');
var c = require('chalk');
var fs = require('fs');
var spawn = require('child_process').spawn;
var ini = require('ini');
var util = require('attrs.util');

var ENV = {};
var PORT_SEQ = 20200;
var PHPCONFIG = {bin:'php'};
try {
	PHPCONFIG = ini.parse(fs.readFileSync(path.resolve(__dirname, '../php-config.ini'), 'utf-8'));
} catch(err) {
}

// class Launcher
function Launcher(name, options) {
	if( !name || typeof(name) !== 'string' ) throw new Error('missing arguments:name');	
	
	this.name = name;
	this.options = options = options || {};
}

Launcher.prototype = {
	start: function(monitor) {
		if( typeof(monitor) === 'function' ) monitor = {write:monitor};
		
		var self = this;
		var name = this.name;
		var options = this.options;
		
		if( !options.docbase || typeof options.docbase !== 'string' ) throw new Error('missing arguments:options.docbase');	
				
		var port = parseInt(options.port) || (PORT_SEQ++);
		var host = options.host || '127.0.0.1';
		var docbase = path.resolve(process.cwd(), options.docbase);	
		var cwd = docbase;
		var bin = PHPCONFIG.bin;
		var argv = ['-S', host + ':' + port];
		
		if( !fs.existsSync(docbase) ) throw new Error('not exist docbase:' + docbase);
		
		//console.log(this.command);
		var child = this.child = spawn(bin, argv, {
			encoding: 'utf8',
			cwd: cwd,
			env: ENV
		}).on('exit', function (code, signal) {
			util.debug('php', 'exit', code, signal);
			self.child = null;
		}).on('close', function (code, signal) {
			util.debug('php', 'closed', code, signal);
			self.child = null;
		});
		
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', function(data) {
			if( monitor && monitor.write ) monitor.write(data);
		});
		child.stderr.on('data', function (data) {
			if( monitor && monitor.write ) monitor.write(data);
		});
		
		util.debug('php', 'startup(' + name + ')', bin, argv);
		
		this.port = port;
		this.host = host;
		
		return this;
	},
	pid: function() {
		return this.child.pid;	
	},
	connected: function() {
		return this.child.connected;	
	},
	stop: function() {
		var code = -1;		
		if( this.child ) {
			code = this.child.kill();
			this.child = null;
			util.debug('php', 'stopped(' + this.name + ') [code=' + code + ']', this.argv);
		}
		return code;
	}
}

var processes = {};
module.exports = {
	env: function(key, value) {
		if( !arguments.length ) return ENV;
		if( arguments.length === 1 ) {
			if( typeof key === 'string' ) {
				return ENV[key];
			} else if( typeof key === 'object' ) {
				ENV = key;
			}
			return this;
		}
		
		if( typeof key !== 'string' ) return console.error('illegal env key', key);
		ENV[key] = value;		
		return this;
	},
	names: function() {
		var arr = [];
		for(var k in processes) arr.push(k);
		return arr;
	},
	get: function(name) {
		return processes[name];
	},
	processes: function() {
		var arg = [];
		for(var k in processes) {
			var launcher = processes[k];
			if( launcher instanceof Launcher ) arr.push(launcher);
		}
		return arg;	
	},
	stopAll: function() {
		for(var k in processes) {
			var launcher = processes[k];
			if( launcher instanceof Launcher ) launcher.stop();
		}
	},
	create: function(name, options) {
		if( processes[name] ) throw new Error('already exists:' + name);
		var launcher = new Launcher(name, options);
			
		processes[name] = launcher;
		return launcher;
	},
	remove: function(name) {
		var launcher = this.get(name);
		if( launcher ) {
			launcher.stop();
			processes[name] = null;
			delete processes[name];
			return launcher;
		}
		return false;
	}
};