var path = require('path');
var c = require('chalk');
var fs = require('fs');
var exec = require('child_process').exec;
var ini = require('ini');

var ENV = {};

// class Launcher
function Launcher(name, options) {
	if( !name || typeof(name) !== 'string' ) throw new Error('illegal name:' + name);	
	if( !options.docbase ) throw new Error('illegal docbase', docbase);
	
	this.options = options = options || {};
	var port = parseInt(options.port) || (Launcher.port_seq++);
	var host = options.host || '127.0.0.1';
	var docbase = path.resolve(process.cwd(), options.docbase);
	
	var cwd = docbase;
	var bin = Launcher.phpconfig.bin;
	var command = bin + ' -S ' + host + ':' + port;
		
	this.name = name;
	this.cwd = cwd;
	this.bin = bin;
	this.port = port;
	this.host = host;
	this.docbase = docbase;
	this.command = command;
	this.options = options;
};

Launcher.port_seq = 20200;
Launcher.phpconfig = {bin:'php'};
try {
	Launcher.phpconfig = ini.parse(fs.readFileSync(path.resolve(__dirname, '../php-config.ini'), 'utf-8'));
} catch(err) {
}

Launcher.prototype = {
	start: function(monitor) {
		if( typeof(monitor) === 'function' ) monitor = {write:monitor};
		
		var self = this;
		var name = this.name;
		var command = this.command;
		var cwd = this.cwd;
		
		//console.log(this.command);
		var child = this.child = exec(command, {
			encoding: 'utf8',
			cwd: cwd,
			env: ENV
		}, function(err, stdout, stderr) {
			if( err ) return console.error('[php] startup error(' + name + ')', command, err);
		}).on('exit', function(code) {
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
		
		console.log('[php] startup(' + name + ') [' + command + ']');
		
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
			code = this.child.kill('SIGHUP');
			this.child = null;
			console.log('[php] stopped(' + this.name + ') [code=' + code + '] [' + this.command + ']');
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