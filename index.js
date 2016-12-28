var T_EOF = -1, T_ERROR = -2, T_TOKEN = -3,
	REGEXP_ESCAPE = /([.?*+^$[\]\\(){}|-])/g;

function escapeExpression(expression) {
	if (expression instanceof RegExp) {
		expression = expression.toString();
		expression = expression.slice(1, -1);
	} else expression = expression.replace(REGEXP_ESCAPE, '\\$1');
	return '(' + expression + ')';
}

/** @constructor */
function TokenSet() {
	this.names = [];
	this.exprs = [];
}

/**
 * @param {number|Array<number>} name
 * @param {string|RegExp} expression
 */
TokenSet.prototype.add = function(name, expression) {
	this.names.push(typeof name === 'undefined' ? T_TOKEN : name);
	this.exprs.push(escapeExpression(expression));
};

TokenSet.prototype.tokenize = function(inputStr) {
	return new Tokenizer(inputStr, this.names, new RegExp(this.exprs.join('|'), 'g'));
};


function compareToken(token, selector) {
	var c, fragment, type = token.type;
	if (!(selector instanceof Array)) selector = [selector];
	for (c = 0; c < selector.length; c++) {
		fragment = selector[c];
		if (type instanceof Array ? type.indexOf(fragment) !== -1 : fragment === type) return true;
	}
}

/** @constructor */
function Tokenizer(inputStr, tokenIds, regexp) {
	this.buffer = [];
	this.inputStr = inputStr;
	this.regexp = regexp;
	this.tokenIds = tokenIds;
	this.inputLen = inputStr.length;
	this.ignoredTokens = null;
}

Tokenizer.prototype.$EOF = T_EOF;

Tokenizer.prototype.setIgnored = function() {
	var ignoredTokens = Array.prototype.slice.call(arguments);
	if (!ignoredTokens.length) ignoredTokens = null;
	if (this.ignoredTokens === ignoredTokens) return this;
	function Tokenizer() { this.ignoredTokens = ignoredTokens; }
	Tokenizer.prototype = this;
	return new Tokenizer();
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
		value: this.inputStr.slice(startPos)
	}));

};

Tokenizer.prototype.getTokenFromBuffer = function(offset) {

	var token, buffer = this.buffer,
		ignoredTokens = this.ignoredTokens,
		toRead = offset - buffer.length + 1;


	while (toRead-- > 0) this.readTokenToBuffer();

	token = buffer[offset];

	return (ignoredTokens && compareToken(token, ignoredTokens) ? {
		type: token.type,
		pos: token.pos,
		value: token.value,
		ignored: true
	} : token);

};



Tokenizer.prototype.getAnyToken = function(consume) {
	var token, offset = 0, buffer = this.buffer;
	if (consume) while (token = this.getTokenFromBuffer(0), buffer.shift(), token.ignored);
	else while (token = this.getTokenFromBuffer(offset++), token.ignored);
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

	else if (!token.ignored) return;

	if (!consume) return true;



	var buffer = this.buffer;
	while (offset--) buffer.shift();

	return (x.length === 1 ? x[0] : x);
};

Tokenizer.prototype.next = function() {
	return (
		arguments.length ?
		this.getSpecificToken(arguments, true) :
		this.getAnyToken(true)
	);
};

Tokenizer.prototype.test = function() {
	return (
		arguments.length ?
		this.getSpecificToken(arguments, false) :
		this.getAnyToken(false)
	);
};

Tokenizer.prototype.getLineNumber = function(tokenPos) {

	var code, pos = -1, lineNumber = 1,
		inputStr = this.inputStr;

	while (++pos < tokenPos) {
		code = inputStr.charCodeAt(pos);
		if (code === 10 || code === 13) {
			lineNumber++;
		}
	}

	return lineNumber;

};

module.exports = TokenSet;