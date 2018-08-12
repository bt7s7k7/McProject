/*
 * McProject
 * Copyright (C) 2018 Branislav Trstenský
 */
var B = require("bUtils")
var fs = require("fs")
var path = require("path")

function logError(text) {
	B.log(text)
	process.exit(1)
}

function checkArgs(name, length, args, index) {
	if (args.length != length) logError(`Keyword ${name} requires ${length} arguments, ${args.length} provided, at ${index}`)
}
function checkArgsMin(name, length, args, index) {
	if (args.length < length) logError(`Keyword ${name} requires >=${length} arguments, ${args.length} provided, at ${index}`)
}

var defaultVariables = {}
var folders = [
	"advancements",
	"functions",
	"loot_tables",
	"recipes",
	"structures",
	"tags",
	"tags\\blocks",
	"tags\\items",
	"tags\\fluids",
	"tags\\functions"
]
var clearFolders = [
	"advancements",
	"functions",
	"loot_tables",
	"recipes",
	"structures",
	"tags\\blocks",
	"tags\\items",
	"tags\\fluids",
	"tags\\functions"
]
var file = B.args.get[0]

class StackFrame {
	/**
	 * @param {number} line
	 * @typedef {"repeat" | "define" | "function" | "advancement" | "recipe" | "loot" | "table" | "tag" | "_templateLoad" | "if"} StackFrameType
	 * @param {StackFrameType} type
	 * @param {Object<string,any>} settings
	 * @param {Object<string,string>} variables
	 */
	constructor(line, type, settings = {}, variables = {}) {
		this.line = line
		this.type = type
		/** @type {[string,number][]} */ this.lines = []
		this.settings = settings
		this.variables = variables
	}

	end(state) {
		return keywordEndFunctions[this.type](this, state)
	}
}

class Template {
	/**
	 * @param {number} line
	 * @param {string[]} args
	 */
	constructor(line, args) {
		this.line = line
		this.args = args
	}
}


var keywordFunctions = {
	repeat(index, args) {
		checkArgs("repeat", 2, args, index)
		var settings = { amount: parseInt(args[0]), name: args[1], index: 0 }
		if (isNaN(settings.amount)) logError("Repeat amount is NaN (" + args[0] + ") at " + index)
		return new StackFrame(index, "repeat", settings, { [args[1]]: 0 })
	},
	define(index, args, state) {
		checkArgsMin("define", 1, args, index)
		state.templates[args[0]] = new Template(index, args.slice(1))
		state.ignoreTillEnd()
	},
	function(index, args) {
		checkArgs("function", 1, args, index)
		return new StackFrame(index, "function", { name: args[0] }, { name: args[0] })
	},
	advancement(index, args) {
		checkArgs("advancement", 1, args, index)
		return new StackFrame(index, "advancement", { name: args[0] }, { name: args[0] })
	},
	recipe(index, args) {
		checkArgs("recipe", 1, args, index)
		return new StackFrame(index, "recipe", { name: args[0] }, { name: args[0] })
	},
	loot(index, args) {
		checkArgs("loot", 1, args, index)
		return new StackFrame(index, "loot", { name: args[0] }, { name: args[0] })
	},
	table(index, args) {
		checkArgs("table", 1, args, index)
		return new StackFrame(index, "table", { name: args[0] })
	},
	tag(index, args) {
		checkArgs("tag", 2, args, index)
		if (["blocks","items","fluids","functions"].indexOf(args[0]) == -1) logError(`Invalid tag type '${args[0]}' expected blocks, items, fluids or functions, at ${index}`)
		return new StackFrame(index, "tag", { name: args[1], type: args[0] }, { name: args[1] })
	},
	set(index, args, state) {
		checkArgsMin("set", 2, args, index)
		var set = args.slice(1).join(" ")
		if (state.stack.length > 0) {
			state.stack.last().variables[args[0]] = set
			B.log("Setting variable '" + args[0] + "' to '" + set + "'")
		} else {
			defaultVariables[args[0]] = args[1]
			B.log("Setting default variable '" + args[0] + "' to '" + set + "'")
		}
	},
	template(index, args, state) {
		checkArgsMin("template", 1, args, index)
		var name = args[0]
		if (name in state.templates) {
			/** @type {Template} */ var template = state.templates[name]
			var templateArgs = args.slice(1)
			if (templateArgs.length == template.args.length) {
				state.goto(template.line)
				var vars = {}
				template.args.forEach((v, i) => {
					vars[v] = templateArgs[i]
				})
				return new StackFrame(index, "_templateLoad", {}, vars)
			} else {
				logError(`Invalid amount of arguments for template ${name}(${template.args.join(", ")}), ${templateArgs.length} != ${template.args.length}, at ${index}`)
			}
		} else {
			logError(`Template '${name}' does not exist at ${index}`)
		}
	},
	lookup(index, args, state) {
		checkArgs("lookup", 3, args, index)
		var value = state.getVariable(args[1] + "_" + args[2])
		this.set(index, [args[0], value], state)
	},
	eval(index, args, state) {
		checkArgsMin("eval", 2, args, index)
		this.set(index, [args[0], eval(args.slice(1).join(" "))], state)
	},
	debug(index, args) {
		checkArgsMin("debug", 1, args, index)
		B.write("Debug: ")
		B.log(args.join(" "))
	},
	if(index, args, state) {
		checkArgs("if", 2, args, index)
		if (args[0] == args[1]) {
			B.log("True")
			return new StackFrame(index, "if")
		} else {
			B.log("False")
			state.ignoreTillEnd()
		}
	},
	ifnot(index, args, state) {
		checkArgs("if", 2, args, index)
		if (args[0] != args[1]) {
			B.log("False")
			return new StackFrame(index, "if")
		} else {
			B.log("True")
			state.ignoreTillEnd()
		}
	}
}
var keywordEndFunctions = {
	repeat(stackFrame, state) {
		stackFrame.settings.index++
		if (stackFrame.settings.index >= stackFrame.settings.amount) {

		} else {
			state.goto(stackFrame.line)
			stackFrame.variables = { [stackFrame.settings.name]: stackFrame.settings.index }
			return true
		}
	},
	define(stackFrame, state) {

	},
	function(stackFrame, state) {
		var { name } = stackFrame.settings
		var filename = path.join(path.dirname(file), "functions\\" + name + ".mcfunction")
		B.log(`Saving function ${name} to ${filename}...`)
		var content = stackFrame.lines.join("\n")

		fs.writeFile(filename, content, (err) => {
			if (err) throw err
			B.log(`Saved function ${name} to ${filename}`)
		})
	},
	advancement(stackFrame, state) {
		var { name } = stackFrame.settings
		var filename = path.join(path.dirname(file), "advancements\\" + name + ".json")
		B.log(`Saving advancement ${name} to ${filename}...`)
		var text = stackFrame.lines.join("\n")
		try {
			var object = eval("()=>{ return {" + text + "}}")()
		} catch (err) {
			logError(`Error when parsing advancement object at ${stackFrame.index}, error: ${err.stack}`)
		}
		var content = JSON.stringify(object)

		fs.writeFile(filename, content, (err) => {
			if (err) throw err
			B.log(`Saved advancement ${name} to ${filename}`)
		})
	},
	recipe(stackFrame, state) {
		var { name } = stackFrame.settings
		var filename = path.join(path.dirname(file), "recipes\\" + name + ".json")
		B.log(`Saving recipe ${name} to ${filename}...`)
		var text = stackFrame.lines.join("\n")
		try {
			var object = eval("()=>{ return {" + text + "}}")()
		} catch (err) {
			logError(`Error when parsing recipe object at ${stackFrame.index}, error: ${err.stack}`)
		}
		var content = JSON.stringify(object)

		fs.writeFile(filename, content, (err) => {
			if (err) throw err
			B.log(`Saved recipe ${name} to ${filename}`)
		})
	},
	loot(stackFrame, state) {
		var { name } = stackFrame.settings
		var filename = path.join(path.dirname(file), "loot_tables\\" + name + ".json")
		B.log(`Saving loot table ${name} to ${filename}...`)
		var text = stackFrame.lines.join("\n")
		try {
			var object = eval("()=>{ return {" + text + "}}")()
		} catch (err) {
			logError(`Error when parsing loot table object at ${stackFrame.index}, error: ${err.stack}`)
		}
		var content = JSON.stringify(object)

		fs.writeFile(filename, content, (err) => {
			if (err) throw err
			B.log(`Saved loot table ${name} to ${filename}`)
		})
	},
	table(stackFrame, state) {
		var set = (name, value) => {
			if (state.stack.length > 1) {
				state.stack[state.stack.length - 2].variables[name] = value
				//B.log("Setting variable '" + name + "' to '" + value + "'")
			} else {
				defaultVariables[name] = value
				//B.log("Setting default variable '" + name + "' to '" + value + "'")
			}
		}
		var name = stackFrame.settings.name
		set(name + "_length", stackFrame.lines.length)

		stackFrame.lines.forEach((v, i) => {
			set(name + "_" + i, v)
		})
	},
	tag(stackFrame, state) {
		var { name, type } = stackFrame.settings
		var filename = path.join(path.dirname(file), "tags\\" + type + "\\" + name + ".json")
		B.log(`Saving tag ${name} to ${filename}...`)
		var content = `{"values":[${stackFrame.lines.map(v=>JSON.stringify(v)).join(", ")}]}`

		fs.writeFile(filename, content, (err) => {
			if (err) throw err
			B.log(`Saved tag ${name} to ${filename}`)
		})
	},
	if(stackFrame, state) {

	},
	_templateLoad(stackFrame, state) {
		state.goto(stackFrame.line)
	},
}
var allowedAnywhere = ["repeat", "set", "eval", "template", "if", "ifnot", "debug", "lookup"]
var allowedInRoot = ["define", "function", "advancement", "recipe", "loot", "table", "tag", ...allowedAnywhere]
var contentBlocks = ["function", "advancement", "recipe", "loot", "table", "tag"]
var allowedInContent = [...allowedAnywhere]
var block = ["repeat", "define", "function", "advancement", "recipe", "loot", "table", "tag", "template", "if", "ifnot"]

class ParserState {
	/**
	 * @param {string[]} lines
	 */
	constructor(lines) {
		this.lines = lines
		this.index = 0

		/** @type {Object<string,string[]>} */ this.functions = {}
		/** @type {Object<string,Template>} */ this.templates = {}
		/** @type {Object<string,string[]>} */ this.advancements = {}
		/** @type {Object<string,string[]>} */ this.recipes = {}
		/** @type {Object<string,string[]>} */ this.lootTables = {}
		/** @type {StackFrame[]} */ this.stack = []
	}

	line() {
		if (this.stack.length > 0 && this.stack[this.stack.length - 1].type == "define") {
			return this.lines[this.index].trim()
		} else return this.lines[this.index].trim().replace(/\$(.*?)\$/g, (match, name) => this.getVariable(name))
	}

	lineRaw() {
		return this.lines[this.index]
	}

	next() {
		this.index++
		if (this.index >= this.lines.length) {
			return false
		} else return true
	}
	/**
	 * @param {number} index
	 */
	get(index) {
		if (index >= this.lines.length) throw new RangeError("Tryied to access past lines boundary (" + index + " >=" + this.lines.length + ")")
		return this.lines[index]
	}
	/**
	 * @param {number} index
	 */
	goto(index) {
		if (isNaN(index)) throw new TypeError("Index is NaN")
		if (index >= this.lines.length) throw new RangeError("Tryied to go past lines boundary (" + index + " >=" + this.lines.length + ")")
		this.index = index;
	}

	/**
	 * @param {string} name
	 * @param {number} index
	 */
	getVariable(name, index = this.stack.length - 1) {
		if (index < 0) {
			if (name in defaultVariables) {
				return defaultVariables[name]
			}
			logError("Variable '" + name + "' does not exist at " + this.index)
		}

		if (name in this.stack[index].variables) {
			return this.stack[index].variables[name]
		} else {
			return this.getVariable(name, index - 1)
		}
	}
	/**
	 * @param {number} index
	 */
	inContent(index = this.stack.length - 1) {
		if (index < 0) {
			if (contentBlocks.indexOf(this.stack[index]) != -1) return true;
		} return false
	}

	/**
	 * @param {string} line
	 * @param {number} index	
	 */
	putLineToContent(line, index = this.stack.length - 1) {
		if (line == "") return
		if (index < 0) {
			return true
		}
		if (contentBlocks.indexOf(this.stack[index].type) != -1) {
			this.stack[index].lines.push(line)
		} else {
			return this.putLineToContent(line, index - 1)
		}
	}

	evalTillEnd() {
		B.log("  Eval till end")
		var beginStackPos = this.stack.length
		while (beginStackPos <= this.stack.length) {
			B.log(this.index + ": " + this.lines[this.index])
			if (this.line()[0] == "@") {
				if (this.line() == "@end") {
					if (this.stack.length > 0) {
						if (!this.stack[this.stack.length - 1].end(this)) { this.stack.pop(); B.log("Stack.pop() (" + this.stack.length + ")") } else B.log("Ignored")
					} else {
						logError("Unexpected 'end' keyword, no blocks open, at " + this.index)
					}
				} else {
					let [keyword, ...args] = this.line().substr(1).split(" ")
					if (this.inContent()) {
						if (allowedInContent.indexOf(keyword) != -1) {
							let ret = keywordFunctions[keyword](this.index, args, this)
							if (ret instanceof StackFrame) {
								this.stack.push(ret)
								B.log("Stack.push (" + this.stack.length + ")")
							}
						} else {
							logError(`Unexpected keyword '${keyword}', expected: ${allowedInContent.join(", ")} at ${this.index}`)
						}
					} else {
						if (allowedInRoot.indexOf(keyword) != -1) {
							let ret = keywordFunctions[keyword](this.index, args, this)
							if (ret instanceof StackFrame) {
								this.stack.push(ret)
								B.log("Stack.push (" + this.stack.length + ")")
							}
						} else {
							logError(`Unexpected keyword '${keyword}', expected: ${allowedInRoot.join(", ")} at ${this.index}`)
						}
					}
				}
			} else {
				if (this.putLineToContent(this.line())) {
					logError("Unexpected data '" + this.line() + "'. Expected " + allowedInRoot.join(", ") + " at " + this.index)
				}
			}
			if (!this.next()) break;
		}
	}

	ignoreTillEnd() {
		B.log("  Ignoring till end")
		var relativeLenght = 1
		var start = this.index
		while (relativeLenght != 0) {
			if (!this.next()) {
				logError("Unable to find matching end keyword for line " + start)
			}
			if (this.lineRaw()[0] == "@") {
				if (this.lineRaw() == "@end") {
					B.log("Relative length -- (" + relativeLenght + ")")
					relativeLenght--
				} else {
					if (block.indexOf(this.lineRaw().substr(1)) != -1) {
						B.log("Relative length ++ (" + relativeLenght + ")")
						relativeLenght++
					}
				}
			}
		}
	}
}

if (!file) {
	B.log("No source file specified, specify source file in the first argument")
	process.exit(2)
} else {
	file = path.join(process.cwd(), file)
	fs.readFile(file, (err, data) => {
		if (err) throw err
		defaultVariables.namespace = path.basename(path.dirname(file))

		Promise.all(folders.map(v => new Promise((resolve, reject) => {
			fs.mkdir.promiseNCS(path.join(path.dirname(file), v)).then(() => {
				resolve()
				B.log("Created folder " + v)
			}, (err) => {
				if (err.code != "EEXIST") {
					reject(err)
				} else {
					B.log("Folder " + v + " exists")
					resolve()
				}
			})
		}))).then(() => {
			Promise.all(clearFolders.map(v => B.clearFolder.promiseNCS(path.join(path.dirname(file), v)).then(() => {
				B.log("Cleared folder " + v)
			}))).then(() => {
				B.log("")
				var state = new ParserState(data.toString().split(/\r?\n/g))
				state.evalTillEnd()
			}, err => B.log(err))

		}, (err) => {
			B.log(err)
		})
	})
}