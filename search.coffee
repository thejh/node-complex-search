OPERATORS = ['|', '&']

contains = (arr, el) -> -1 isnt arr.indexOf el
isOp = (type) -> contains OPERATORS, type.type or type

uniq = (arr) ->
  result = []
  result.push e for e in arr when not contains result, e
  result

# both arrays should be uniq'd
common = (arr1, arr2) -> e for e in arr1 when contains arr2, e
join = (arr1, arr2) -> uniq arr1.concat arr2

createNodes = (tokens) ->
  nodes = tokens.concat()
  # parse a bunch of strings, results and ops
  # every second token is an op
  _parse = (from, to) ->
    subNodes = nodes.slice from, to+1
    throw 'internal error, createNodes:_parse:subNodes.length isn\'t odd' if subNodes.length%2 isnt 1
    while subNodes.length > 1
      operandA = subNodes.shift()
      operator = subNodes.shift()
      operandB = subNodes.shift()
      result = {type: 'result', op: operator.type, operands: [operandA, operandB]}
      subNodes.unshift result
    throw 'internal error, createNodes:_parse:subNodes.length isn\'t 1 at the end' if subNodes.length isnt 1
    subNodes[0]
  openPositions = []
  i = 0
  while i < nodes.length
    node = nodes[i]
    switch node.type
      when 'parenOpen'
        openPositions.push i
      when 'parenClose'
        openI = openPositions.pop()
        throw 'closing paren without opening paren' if not openI?
        newNode = _parse openI+1, i-1
        nodes.splice openI, i-openI+1, newNode
        i = openI
    i++
  throw 'unclosed parens' if openPositions.length isnt 0
  _parse 0, nodes.length-1

postprocessTokens = (tokens) ->
  throw 'first and last token may not be ops' if isOp(tokens[0]) or isOp(tokens[tokens.length-1])
  i = 0
  lastType = null
  while i < tokens.length
    {type} = tokens[i]
    if -1 isnt ['parenClose', 'string'].indexOf(lastType) and -1 isnt ['parenOpen', 'string'].indexOf(type)
      tokens.splice i, 0, type: type = 'and'
    if -1 isnt ['|', '&'].indexOf(lastType) and -1 isnt ['|', '&'].indexOf(type)
      throw "you can't do &| or && or whatever"
    lastType = type
    i++
  tokens

tokenizeSearchString = (str) ->
  if not /^[()0-9a-zA-Z_&| -]+$/.exec str
    throw 'invalid character'
  tokens = []
  i = 0
  while i < str.length
    char = str[i]
    switch char
      when '('
        tokens.push type: 'parenOpen'
        i++
      when ')'
        tokens.push type: 'parenClose'
        i++
      when '|'
        tokens.push type: 'or'
        i++
      when '&'
        tokens.push type: 'and'
        i++
      when ' '
        i++
      else
        # string
        fromI = i
        i++ while i < str.length and -1 is [' ', '|', '&', '(', ')'].indexOf str[i]
        tokens.push type: 'string', value: str.slice fromI, i
  postprocessTokens tokens

performFilter = (node, keywordResults) ->
  switch node.type
    when 'string'
      keywordResults[node.value]
    when 'result'
      switch node.op
        when 'or'
          join(
            performFilter node.operands[0], keywordResults
            performFilter node.operands[1], keywordResults
          )
        when 'and'
          common(
            performFilter node.operands[0], keywordResults
            performFilter node.operands[1], keywordResults
          )

getKeywords = (tokens) -> uniq (t.value for t in tokens when t.type is 'string').sort()

module.exports = class Search
  # use with try/catch!
  constructor: (string, @callback) ->
    tokens = tokenizeSearchString string
    @_nodes = createNodes tokens
    @keywords = getKeywords tokens
    @_keywordResults = {}
    @_keywordResultsNeeded = @keywords.length
  
  provideKeywordData: (keyword, data) ->
    throw new Error 'duplicate keyword data' if @_keywordResults[keyword]?
    throw new Error 'unknown keyword' unless contains @keywords, keyword
    @_keywordResults[keyword] = data
    @_keywordResultsNeeded--
    if @_keywordResultsNeeded is 0
      @callback uniq performFilter @_nodes, @_keywordResults

#try
#  console.error JSON.stringify tokens = tokenizeSearchString 'sax halfstreamxml'
#  console.error JSON.stringify createNodes tokens
#catch err
#  console.log err.stack||err
