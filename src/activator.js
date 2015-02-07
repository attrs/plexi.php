var Launcher = require('./Launcher.js');
var path = require('path');
var fs = require('fs');
var http = require('http');
var pkg = require('../package.json');

module.exports = {
	start: function(ctx) {
		var options = ctx.preference;
		
		var create = function(name, config) {
			return Launcher.create(name, config).start(config.console ? process.stdout : null);
		};
		
		var instances = options.instances;
		for(var k in instances) {
			create(k, instances[k]);
		}
		
		var httpService = ctx.require('plexi.http');
		httpService.filter('php', {
			pattern: ['**/*.php'],
			filter: function(req, res, next) {
				if( !req.docbase ) return next(new Error('[php] req.docbase required'));
				
				var launcher = Launcher.get(req.docbase);
				var first;				
				if( !launcher ) {
					first = true;
					launcher = create(req.docbase, {docbase: req.docbase});
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
						
						if( ~[404,500].indexOf(response.statusCode) ) {
							var payload = '';
							response.on('data', function (chunk) {
								payload += chunk;
							});

							response.on('end', function () {
								res.statusCode = response.statusCode;
								next(payload);
							});
							return;
						}
						
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
			}
		});
		
		return {
			create: function(name, config) {
				return create(name, config);
			},
			remove: function(name) {
				return Launcher.remove(name);
			},
			names: function() {
				return Launcher.names();
			},
			get: function(name) {
				return Launcher.get(name);
			},
			stop: function(name) {
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