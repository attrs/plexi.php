var Launcher = require('./Launcher.js');
var path = require('path');
var fs = require('fs');
var http = require('http');
var pkg = require('../package.json');
var PHPError = require('./PHPError.js');

var phprouter = function(options) {
	return function php(req, res, next) {
		if( !req.docbase || !fs.existsSync(req.docbase) || !fs.statSync(req.docbase).isDirectory() ) return next();
	
		var launcher = Launcher.get(req.docbase);
		var first;				
		if( !launcher ) {
			first = true;
			launcher = Launcher.create(req.docbase, {docbase: req.docbase}).start();
		}
	
		var exec = function() {
			var request = http.request({
				hostname: launcher.host,
				port: launcher.port,
				path: req.url,
				method: req.method,
				headers: req.headers
			}, function(response) {
				//console.log('STATUS: ' + response.statusCode);
				//console.log('HEADERS: ' + JSON.stringify(response.headers));
				if( response.statusCode === 404 ) {
					return next();
				} else if( response.statusCode === 500 ) {
					var payload = '';
					response.on('data', function (chunk) {
						payload += chunk;
					});

					response.on('end', function () {
						next(new PHPError(payload || 'unknown'));
					});
					return;
				}
						
				res.statusCode = response.statusCode;
				response.setEncoding('utf8');
				res.headers = response.headers;
				for(var k in response.headers) {
					res.setHeader(k, response.headers[k]);
				}
			
				var poweredby = (response.headers['x-powered-by'] || '').split(',');
				poweredby.push(res.getHeader('X-Powered-By') || 'plexi');
				poweredby.push(pkg.name + '@' + pkg.version);
				res.setHeader('X-Powered-By', poweredby.join(', '));
			
				response.on('data', function (chunk) {
					res.write(chunk);
				});

				response.on('end', function () {
					res.end();
				});
			});

			request.on('error', function(err) {
				next(err);
			});
		
			req.pipe(request, {end:true});
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
		var options = ctx.preference;
		
		var create = function(docbase, config) {
			return Launcher.create(docbase, config).start(config.console ? process.stdout : null);
		};
		
		var instances = options.instances;
		for(var k in instances) {
			create(k, instances[k]);
		}
		
		var httpService = ctx.require('plexi.http');
		httpService.filter('php', {
			pattern: ['**/*.php'],
			staticrouting: false,
			filter: phprouter()
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