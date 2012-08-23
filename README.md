[![build status](https://secure.travis-ci.org/thejh/node-complex-search.png)](http://travis-ci.org/thejh/node-complex-search)
    npm install complex-search

Use this for complex, keyword-based search with the following operators:

    |&()

("or", "and", and parens, "and" is the default)

Do not use it if you have high data volumes or so. Reason following below:

API:

    var Search = require('complex-search')
    var search = new Search("xml&(sax|parser)", function(results) {
        console.log(results.join(", "))
    })
    search.keywords.forEach(function(keyword) {
        callSomeAPIOrWhatever(keyword, function(keywordData) {
            // keywordData is an array of strings, e.g. ["mycoolparser", "parser2", "parser3"]
            search.provideKeywordData(keyword, keywordData)
        })
    })

As you can see, you need all results for each keyword. No problem if everything is on disk and you don't need this very often, but hell, don't think about it if you want to recreate Google or so.
