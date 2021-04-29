const unified = require('unified');
const createStream = require('unified-stream');
const stringify = require('remark-stringify');
const markdown = require('remark-parse');
const unixpipe = require('./index');
const gfm = require('remark-gfm')

function reparse(markdownSource, next) {
    try {
        const v = unified().use(markdown).use(gfm).parse('\n' + markdownSource + '\n').children;
        next(null, v);
    } catch (e) {
        next(e);
    }
}

const processor = unified()
  .use(markdown)
  .use(unixpipe, { reparse, concurrency: 5, errorsInDocument: true })
  .use(stringify);

process.stdin.pipe(createStream(processor)).pipe(process.stdout);

