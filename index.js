const unified = require('unified');
const { exec } = require('child_process');
const { mapLimit, seq } = require('async');
const markdown = require('remark-parse');

class UnexpectedExitStatusError extends Error {
    constructor(json, got, stdout, stderr) {
        super("Command " + JSON.stringify(json) + " had exit status " + got)
        this.json = json;
        this.got = got;
        this.stdout = stdout;
        this.stderr = stderr;
    }
}

function debugWrapper(e) {
    let val = [
        "Unknown Error:",
        "",
        "Message: ", + e.message,
        "JSON: " + JSON.stringify(e)
    ];
    if (e instanceof UnexpectedExitStatusError) {
        val = [
            "UnexpectedExitStatusError:", "", "",
            "Message: " + e.message,
            "Command: " + JSON.stringify(e.json),
            "Exit Status: " + e.got, "", "",
            "STDOUT:", e.stdout.split("\n").join("\n  "), "", "",
            "STDERR:", e.stderr.split("\n").join("\n  ")
        ];
    }
    return {
        type: "code",
        lang: null,
        value: val.join("\n")
    };
}

function getOutput({ value: stdin, meta: cmd}, next) {

    let stdout = [];
    let stderr = [];
    let exitCount = 0;
    let exitCode = 0;

    function closer() {
        if (++exitCount >= 2) {
            resolve(stdout.join("\n"));
        }
    }

    const child = exec(
        'cat | ' + cmd,
        (err, stdout) => {
            if (err && err.code) {
                return next(new UnexpectedExitStatusError(
                    cmd,
                    err.code,
                    stdout.toString("utf8"),
                    stderr.toString('utf8')
                ));
            }
            next(null, stdout.toString("utf8"));
        }
    );

    child.stdin.write(stdin);
    child.stdin.end();

}

function handleRootNode(node, next) {
    if (node.type !== 'code') { return next(null, [node]); }
    if (node.lang !== 'unixpipe') { return next(null, [node]); }

    const proc = seq(
        getOutput,
        reparse
    );

    proc(node, next);

}

function reparse(markdownSource, next) {
    try {
        const v = unified().use(markdown).parse(markdownSource).children;
        next(null, v);
    } catch (e) {
        next(e);
    }
}

function unixpipe(options) {

    return function unixpipeTree(tree, file, next) {

        mapLimit(
            tree.children,
            options.concurrency || 3,
            handleRootNode,
            (err, newChildrens) => {
                if (err) {
                    if (!options.errorsInDocument) {
                        return next(err);
                    }
                    newChildrens = [[ debugWrapper(err) ]];
                }
                next(null, {
                    ...tree,
                    children: newChildrens.reduce(
                        (acc, newChildren) => {
                            return [...acc, ...newChildren];
                        },
                        []
                    )
                });
            }
        );

    };

}

module.exports = unixpipe;
