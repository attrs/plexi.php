var Launcher = require('./Launcher.js');
var path = require('path');
var fs = require('fs');
var http = require('http');
var pkg = require('../package.json');

module.exports = {
	start: function(ctx) {
		var options = ctx.preference;
		
		var create = function(name, config) {			
			var out = config.console ? process.stdout : null;
			var launcher = Launcher.create(name, config).start(out);
			console.log('[php] server(' + name + ') started. [' + launcher.host + ':' + launcher.port + ', "' + launcher.docbase + '"]');
			return launcher;
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
				
				var first;
				var launcher = Launcher.get(req.docbase);
				if( !launcher ) {
					first = true;
					launcher = create(req.docbase, {
						docbase: req.docbase
					});
				}
				
				var clientcookie = [];
				for(var k in req.cookies) {
					clientcookie.push(k + '=' + req.cookies[k]);
				}
				
				var exec = function() {
					var request = http.request({
						hostname: launcher.host,
						port: launcher.port,
						path: req.url,
						method: req.method,
						headers: {
							Cookie: clientcookie.join('; ')
						}
					}, function(response) {						
						//console.log('STATUS: ' + response.statusCode);
						//console.log('HEADERS: ' + JSON.stringify(response.headers));					
						res.statusCode = response.statusCode;
						response.setEncoding('utf8');
						if( response.headers['content-type'] ) res.setHeader('Content-Type', response.headers['content-type']);
						
						//res.cookie('name', 'tobi', { domain: '.example.com', path: '/admin', secure: true })
						var cookies = response.headers['set-cookie'];
						if( typeof cookies === 'string' ) cookies = [cookies];
						if( cookies ) {
							var cookiearg = [];
							cookies.forEach(function(cookie) {
								cookiearg.push(cookie);
							});
							res.setHeader('Set-Cookie', cookiearg);
						}
						
						var poweredby = (response.headers['x-powered-by'] || '').split(',');
						poweredby.push(res.getHeader('X-Powered-By') || 'plexi');
						poweredby.push(pkg.name + '@' + pkg.version);
						res.setHeader('X-Powered-By', poweredby.join(', '));
						
						var payload = '';
						response.on('data', function (chunk) {
							payload += chunk;
						});

						response.on('end', function () {
							res.send(payload);
						});
					});

					request.on('error', function(err) {
						next(err);
					});
					request.end();
				};
				
				if( first ) {
					setTimeout(function() {
						exec();
					}, 1500);
				} else {
					exec();
				}
			}
		});
		
		return {
			execute: function(file) {
				return Launcher.execute(file);
			},
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