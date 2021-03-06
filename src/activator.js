var Launcher = require('./Launcher.js');
var path = require('path');
var fs = require('fs');
var http = require('http');
var pkg = require('../package.json');
var util = require('attrs.util');
var chalk = require('chalk');
var PHPError = util.createErrorType('PHPError');

var phprouter = function(options) {
	options = options || {};
	
	return function php(req, res, next) {
		if( !req.docbase || !fs.existsSync(req.docbase) || !fs.statSync(req.docbase).isDirectory() || !fs.existsSync(path.join(req.docbase, req.path)) ) return next();
	
		var launcher = Launcher.get(req.docbase);
		var first;				
		if( !launcher ) {
			first = true;
			launcher = Launcher.create(req.docbase, {docbase: req.docbase}).start((options.console ? process.stdout : null), (options.console ? process.stderr : null));
		}
	
		var debug = req.app.debug;
		var exec = function() {			
			util.forward({
				hostname: launcher.host,
				port: launcher.port,
				path: req.url
			}, req, res, next)
			.on('error', function(err, request) {
				if( debug ) util.debug(pkg.name, 'error', '://' + request.hostname + ':' + request.port + request.path);
				next(err);
			})
			.on('notfound', function(err, request, response) {
				next();
			})
			.on('errorstatus', function(err, request, response) {
				next(err);
			})
			.on('response', function(request, response) {
				if( debug ) {
					var status = response.statusCode;
					if( response.statusCode >= 400 ) status = chalk.red(status);
					else status = chalk.green(status);
					
					util.debug('php', status, request.method, '://' + launcher.host + ':' + launcher.port + request.path);
					if( debug === 'detail' ) {
						util.debug(pkg.name, 'request', {
							hostname: request.hostname,
							path: request.path,
							method: req.method,
							port: request.port,
							headers: request.headers
						});
						util.debug('php', 'response', response.headers);
					}
				}
			});
		};
	
		if( !first ) {
			exec();
		} else {
			setTimeout(function() {
				exec();
			}, 1500);
		}
	};
};

module.exports = {
	start: function(ctx) {
		var pref = ctx.preference;
		
		if( !pref ) {
			pref = ctx.application.preferences.set('plexi.php', {
				console: false,
				instances: {}
			});
			ctx.application.preferences.save();
		}
				
		var create = function(docbase, config) {
			return Launcher.create(docbase, config).start((pref.console ? process.stdout : null), (pref.console ? process.stderr : null));
		};
		
		var instances = pref.instances;
		for(var k in instances) {
			create(k, instances[k]);
		}
		
		var httpService = ctx.require('plexi.http');
		httpService.filter('php', {
			pattern: ['**/*.php'],
			staticrouting: false,
			filter: phprouter({
				console: pref.console
			})
		});
		
		return {
			router: phprouter,
			create: function(docbase, config) {
				return create(docbase, config);
			},
			remove: function(docbase) {
				return Launcher.remove(name);
			},
			names: function() {
				return Launcher.names();
			},
			get: function(docbase) {
				return Launcher.get(name);
			},
			stop: function(docbase) {
				var p = Launcher.get(name);
				if( p ) return p.stop();
			},
			Launcher: Launcher
		};
	},
	stop: function(ctx) {
		Launcher.stopAll();
	}
};