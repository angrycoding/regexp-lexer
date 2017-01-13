var T_EOF = -1,
	T_ERROR = -2,
	PROP_PREFIX = '$PROP_',
	REGEXP_ESCAPE = /([.?*+^$[\]\\(){}|-])/g;

function escapeExpression(expression) {
	return '(' + (
		expression instanceof RegExp ?
		expression.toString().split('/').slice(1, -1).join('/') :
		String(expression).replace(REGEXP_ESCAPE, '\\$1')
	) + ')';
}

function compareToken(token, selector) {
	var c, fragment, type = token.type;
	if (!(selector instanceof Array)) selector = [selector];
	for (c = 0; c < selector.length; c++) {
		fragment = selector[c];
		if (type instanceof Array ? type.indexOf(fragment) !== -1 : fragment === type) return true;
	}
}

/** @constructor */
function Tokenizer() {

	this.buffer = [];
	this.inputStr = '';
	this.inputLen = 0;
	this.ignoredTokens = null;

	var exprs = [], tokenIds = this.tokenIds = [];

	for (var c = 0; c < arguments.length; c += 2) {
		tokenIds.push(arguments[c]);
		exprs.push(escapeExpression(arguments[c + 1]));
	}

	this.regexp = new RegExp(exprs.join('|'), 'g');
}

Tokenizer.prototype.init = function(inputStr) {
	var ignoredTokens = Array.prototype.slice.call(arguments, 1);
	this.regexp.lastIndex = 0;
	this.buffer.splice(0, Infinity);
	this.inputStr = inputStr;
	this.inputLen = inputStr.length;
	this.ignoredTokens = (ignoredTokens.length ? ignoredTokens : null);
	return this;
};

Tokenizer.prototype.$EOF = T_EOF;

Tokenizer.prototype.setIgnored = function() {

	var oldIgnoredTokens = this.ignoredTokens,
		newIgnoredTokens = Array.prototype.slice.call(arguments);

	if (newIgnoredTokens.length) {
		newIgnoredTokens = newIgnoredTokens.sort();
		if (oldIgnoredTokens && String(oldIgnoredTokens) === String(newIgnoredTokens)) {
			return this;
		}
	}

	else {
		if (oldIgnoredTokens === null) return this;
		newIgnoredTokens = null;
	}

	function Tokenizer() { this.ignoredTokens = newIgnoredTokens; }
	Tokenizer.prototype = this;
	return new Tokenizer();
};

Tokenizer.prototype.isIgnored = function(token) {
	var ignoredTokens = this.ignoredTokens;
	return (ignoredTokens && compareToken(token, ignoredTokens));
};



Tokenizer.prototype.instance = function() {
	function Tokenizer() {}
	Tokenizer.prototype = this;
	return new Tokenizer();
};

Tokenizer.prototype.has = function(name) {
	return (PROP_PREFIX + String(name)) in this;
};

Tokenizer.prototype.get = function(name) {
	return this[PROP_PREFIX + String(name)];
};

Tokenizer.prototype.set = function(name, value) {
	this[PROP_PREFIX + String(name)] = (arguments.length > 1 ? value : true);
	return this;
};


Tokenizer.prototype.readTokenToBuffer = function() {

	var matchObj, matchStr,
		buffer = this.buffer,
		regexp = this.regexp,
		startPos = regexp.lastIndex,
		checkIndex = this.inputLen;

	if (startPos >= checkIndex)

		// return T_EOF if we reached end of file
		buffer.push({type: T_EOF, pos: checkIndex});

	else if (matchObj = regexp.exec(matchStr = this.inputStr)) {

		// check if we have T_ERROR token
		if (startPos < (checkIndex = matchObj.index)) {
			buffer.push({
				type: T_ERROR, pos: startPos,
				value: matchStr.slice(startPos, checkIndex)
			});
		}

		while (matchObj.pop() === undefined);

		buffer.push({
			type: this.tokenIds[matchObj.length - 1],
			pos: checkIndex,
			value: matchObj[0]
		});

	}

	// return T_ERROR token in case if we couldn't match anything
	else (regexp.lastIndex = checkIndex, buffer.push({
		type: T_ERROR, pos: startPos,
		value: matchStr.slice(startPos)
	}));
};

Tokenizer.prototype.getTokenFromBuffer = function(offset) {
	var buffer = this.buffer, toRead = offset - buffer.length + 1;
	while (toRead-- > 0) this.readTokenToBuffer();
	return buffer[offset];
};



Tokenizer.prototype.getAnyToken = function(consume) {
	var token, offset = 0, buffer = this.buffer;
	if (consume) while (token = this.getTokenFromBuffer(0), buffer.shift(), this.isIgnored(token));
	else while (token = this.getTokenFromBuffer(offset++), this.isIgnored(token));
	return token;
};

Tokenizer.prototype.getSpecificToken = function(selector, consume) {

	var token, length = selector.length,
		index = 0, offset = 0;

	var x = [];

	for (;;) if (compareToken(
		token = this.getTokenFromBuffer(offset++),
		selector[index]
	)) {
		x.push(token);
		if (++index >= length) break;
	}

	else if (!this.isIgnored(token)) return;

	if (!consume) return true;

	var buffer = this.buffer;
	while (offset--) buffer.shift();

	return (x.length === 1 ? x[0] : x);
};





Tokenizer.prototype.getOffset = function() {
	var buffer = this.buffer;
	return (buffer.length ? buffer[0].pos : this.regexp.lastIndex);
};

Tokenizer.prototype.getCharFromBuffer = function(offset) {
	return (offset >= this.inputLen ? T_EOF : this.inputStr[offset]);
};

Tokenizer.prototype.setOffset = function(offset) {
	var checkIndex = this.inputLen;
	this.buffer.splice(0, Infinity);
	this.regexp.lastIndex = (
		offset >= checkIndex ?
		checkIndex : offset
	);
	return this;
};

Tokenizer.prototype.nextChar = function() {
	var offset = this.getOffset(), result = this.getCharFromBuffer(offset);
	return this.setOffset(offset + 1), result;
};


Tokenizer.prototype.nextToken = function() {
	return (
		arguments.length ?
		this.getSpecificToken(arguments, true) :
		this.getAnyToken(true)
	);
};

Tokenizer.prototype.testToken = function() {
	return (
		arguments.length ?
		this.getSpecificToken(arguments, false) :
		this.getAnyToken(false)
	);
};

Tokenizer.prototype.getCurrentLineNumber = function() {

	var code, pos = -1, lineNumber = 1,
		inputStr = this.inputStr,
		tokenPos = this.getOffset();

	while (++pos < tokenPos) {
		code = inputStr.charCodeAt(pos);
		if (code === 10 || code === 13) {
			lineNumber++;
		}
	}

	return lineNumber;

};

module.exports = Tokenizer;