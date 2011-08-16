(function() {
  var OPERATORS, Search, common, contains, createNodes, getKeywords, isOp, join, performFilter, postprocessTokens, tokenizeSearchString, uniq;
  OPERATORS = ['|', '&'];
  contains = function(arr, el) {
    return -1 !== arr.indexOf(el);
  };
  isOp = function(type) {
    return contains(OPERATORS, type.type || type);
  };
  uniq = function(arr) {
    var e, result, _i, _len;
    result = [];
    for (_i = 0, _len = arr.length; _i < _len; _i++) {
      e = arr[_i];
      if (!contains(result, e)) result.push(e);
    }
    return result;
  };
  common = function(arr1, arr2) {
    var e, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = arr1.length; _i < _len; _i++) {
      e = arr1[_i];
      if (contains(arr2, e)) _results.push(e);
    }
    return _results;
  };
  join = function(arr1, arr2) {
    return uniq(arr1.concat(arr2));
  };
  createNodes = function(tokens) {
    var i, newNode, node, nodes, openI, openPositions, _parse;
    nodes = tokens.concat();
    _parse = function(from, to) {
      var operandA, operandB, operator, result, subNodes;
      subNodes = nodes.slice(from, to + 1);
      if (subNodes.length % 2 !== 1) {
        throw 'internal error, createNodes:_parse:subNodes.length isn\'t odd';
      }
      while (subNodes.length > 1) {
        operandA = subNodes.shift();
        operator = subNodes.shift();
        operandB = subNodes.shift();
        result = {
          type: 'result',
          op: operator.type,
          operands: [operandA, operandB]
        };
        subNodes.unshift(result);
      }
      if (subNodes.length !== 1) {
        throw 'internal error, createNodes:_parse:subNodes.length isn\'t 1 at the end';
      }
      return subNodes[0];
    };
    openPositions = [];
    i = 0;
    while (i < nodes.length) {
      node = nodes[i];
      switch (node.type) {
        case 'parenOpen':
          openPositions.push(i);
          break;
        case 'parenClose':
          openI = openPositions.pop();
          if (!(openI != null)) throw 'closing paren without opening paren';
          newNode = _parse(openI + 1, i - 1);
          nodes.splice(openI, i - openI + 1, newNode);
          i = openI;
      }
      i++;
    }
    if (openPositions.length !== 0) throw 'unclosed parens';
    return _parse(0, nodes.length - 1);
  };
  postprocessTokens = function(tokens) {
    var i, lastType, type;
    if (isOp(tokens[0]) || isOp(tokens[tokens.length - 1])) {
      throw 'first and last token may not be ops';
    }
    i = 0;
    lastType = null;
    while (i < tokens.length) {
      type = tokens[i].type;
      if (-1 !== ['parenClose', 'string'].indexOf(lastType) && -1 !== ['parenOpen', 'string'].indexOf(type)) {
        tokens.splice(i, 0, {
          type: type = 'and'
        });
      }
      if (-1 !== ['|', '&'].indexOf(lastType) && -1 !== ['|', '&'].indexOf(type)) {
        throw "you can't do &| or && or whatever";
      }
      lastType = type;
      i++;
    }
    return tokens;
  };
  tokenizeSearchString = function(str) {
    var char, fromI, i, tokens;
    if (!/^[()0-9a-zA-Z_&| -]+$/.exec(str)) throw 'invalid character';
    tokens = [];
    i = 0;
    while (i < str.length) {
      char = str[i];
      switch (char) {
        case '(':
          tokens.push({
            type: 'parenOpen'
          });
          i++;
          break;
        case ')':
          tokens.push({
            type: 'parenClose'
          });
          i++;
          break;
        case '|':
          tokens.push({
            type: 'or'
          });
          i++;
          break;
        case '&':
          tokens.push({
            type: 'and'
          });
          i++;
          break;
        case ' ':
          i++;
          break;
        default:
          fromI = i;
          while (i < str.length && -1 === [' ', '|', '&', '(', ')'].indexOf(str[i])) {
            i++;
          }
          tokens.push({
            type: 'string',
            value: str.slice(fromI, i)
          });
      }
    }
    return postprocessTokens(tokens);
  };
  performFilter = function(node, keywordResults) {
    switch (node.type) {
      case 'string':
        return keywordResults[node.value];
      case 'result':
        switch (node.op) {
          case 'or':
            return join(performFilter(node.operands[0], keywordResults), performFilter(node.operands[1], keywordResults));
          case 'and':
            return common(performFilter(node.operands[0], keywordResults), performFilter(node.operands[1], keywordResults));
        }
    }
  };
  getKeywords = function(tokens) {
    var t;
    return uniq(((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = tokens.length; _i < _len; _i++) {
        t = tokens[_i];
        if (t.type === 'string') _results.push(t.value);
      }
      return _results;
    })()).sort());
  };
  module.exports = Search = (function() {
    function Search(string, callback) {
      var tokens;
      this.callback = callback;
      tokens = tokenizeSearchString(string);
      this._nodes = createNodes(tokens);
      this.keywords = getKeywords(tokens);
      this._keywordResults = {};
      this._keywordResultsNeeded = this.keywords.length;
    }
    Search.prototype.provideKeywordData = function(keyword, data) {
      if (this._keywordResults[keyword] != null) {
        throw new Error('duplicate keyword data');
      }
      if (!contains(this.keywords, keyword)) throw new Error('unknown keyword');
      this._keywordResults[keyword] = data;
      this._keywordResultsNeeded--;
      if (this._keywordResultsNeeded === 0) {
        return this.callback(uniq(performFilter(this._nodes, this._keywordResults)));
      }
    };
    return Search;
  })();
}).call(this);
