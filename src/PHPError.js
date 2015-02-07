function PHPError(message, cause) {
	if( message instanceof Error ) {
		cause = message;
		message = message.message;
	}
	
	Error.call(this, message);
	this.name = 'PHPError';
	this.message = message;
	this.arguments = [].slice.call(arguments);
	
	Error.captureStackTrace(this, arguments.callee);

	if( cause instanceof Error ) this.cause = cause;
}

PHPError.prototype = Object.create(Error.prototype);
PHPError.prototype.constructor = PHPError;

module.exports = PHPError;