/**
 * Copyright (C) 2016 yanni4night.com
 * ssi.js
 *
 * changelog
 * 2016-03-29[23:49:20]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
import tags from './tags';
import loader from './loader';
import path from 'path';
import utils from './utils';
import parser from './parser';


const SYNTAX_PATTERN = /<!--#([^\r\n]+?)-->/mg;

const noop = () => {};

/**
 * Read a string and break it into separate token types.
 * 
 * @param  {string} str
 * @return {Array}     Array of defined types, potentially stripped or replaced with more suitable content.
 * @private
 */
const parseLine = str => {
    var offset = 0,
        tokens = [],
        substr,
        match;
    while (offset < str.length) {
        substr = str.substring(offset);
        match = reader(substr);
        offset += match.length;
        tokens.push(match);
    }
    return tokens;
};


/**
 * Parse a string content.
 * 
 * @param  {string} content
 * @return {Promise}
 */
const parseContent = content => {
    return new Promise(resolve => {
        let matches;
        let startOffset = 0;
        const syntaxQ = [];
        // const ifStack = [];

        while (!!(matches = SYNTAX_PATTERN.exec(content))) {
            syntaxQ.push({
                type: SYNTAX_TYPES.STRING,
                payload: content.slice(startOffset, matches.index)
            });

            const cmd = {
                parameters: {},
                command: null
            };

            const lineTokens = parseLine(matches[1].trim()).filter(token => (token.type !== TYPES.WHITESPACE));

            let tmpKey;
            let prevToken;
            let prevTokenType;

            for (let i = 0; i < lineTokens.length; ++i) {
                let type = lineTokens[i].type;

                switch (type) {
                case TYPES.VAR:
                    if (!prevToken) {
                        cmd.command = lineTokens[i].match;
                    } else {
                        tmpKey = lineTokens[i].match;
                    }
                    break;
                case TYPES.STRING:
                    if (!prevToken && (prevTokenType !== TYPES.ASSIGNMENT)) {
                        throw new Error('Wrong string');
                    }
                    cmd.parameters[tmpKey] = lineTokens[i].match;
                    tmpKey = null;
                    break;
                case TYPES.ASSIGNMENT:
                    if (!prevToken && (prevTokenType !== TYPES.VAR)) {
                        throw new Error('Wrong =');
                    }

                    break;
                case TYPES.WHITESPACE:
                    break;
                default:
                    throw new Error('Illegal token:' + type);
                }
                prevToken = lineTokens[i];
                prevTokenType = prevToken.type;
            }
            if (prevToken) {

                if (TYPES.STRING !== prevTokenType && !!tmpKey) {
                    throw new Error('Uncomplete:' + prevToken.match + ':' + prevTokenType);
                }

                syntaxQ.push({
                    type: SYNTAX_TYPES.COMMAND,
                    payload: cmd
                });
            }

            startOffset = matches[0].length + matches.index;
        }
        resolve(syntaxQ);
    });
};
/**
 * Parse a file on disk.
 * 
 * @param  {string} filePath
 * @param  {Object} options
 * @return {Promise}
 */
const parseFile = (filePath, options = {
    encoding: 'utf-8'
}) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, Object.assign({}, options), (err, content) => {
            err ? reject(err) : resolve(content);
        });
    }).then(content => parse(content, Object.assign(options, {
        filePath
    })));
};

export class SSI {
    constructor(opts) {
        this.options = Object.assign({
            baseDir: '.',
            encoding: 'utf-8',
            tagControls: ['<!--#', '-->'],
            locals: {}
        }, opts);
    }
    parse(source, opts) {
        let options = Object.assign({}, this.options, opts);
        return parser.parse(this, source, options, tags);
    }
    precompile(source, opts) {
        const tokens = this.parse(source, opts);
        try {
            tpl = new Function('_ssi', '_ctx', '_utils', '_fn',
                '  var _output = "";\n' +
                parser.compile(tokens, opts) + '\n' +
                '  return _output;\n'
            );
        } catch (e) {
            utils.throwError(e, null, opts.filePath);
        }

        return {
            tpl, tokens
        };
    }
    compile(source, opts) {
        let pre = this.precompile(source, opts);
        const options = Object.assin({}, this.options, opts);
        return compiled = locals => pre.tpl(this, Object.assign({}, options.locals, locals), utils, noop);
    }
    compileFile(filePath, opts) {
        const {
            options
        } = this;
        const absFilePath = path.join(options.baseDir, filePath);
        const content = loader.load(filePath, {
            encoding: options.encoding
        });
        return this.compile(content, Object.assin(opts, {
            filePath: absFilePath
        }));
    }
    render(source, opts) {
        return this.compile(source, opts)();
    }
    renderFile(filePath, locals) {
        return this.compileFile(filePath)(locals);
    }
}