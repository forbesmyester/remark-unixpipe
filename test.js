const unified = require('unified');
const createStream = require('unified-stream');
const stringify = require('remark-stringify');
const markdown = require('remark-parse');
const unixpipe = require('./index');

const processor = unified()
  .use(markdown)
  .use(unixpipe, { concurrency: 5, errorsInDocument: true })
  .use(stringify);

process.stdin.pipe(createStream(processor)).pipe(process.stdout);

