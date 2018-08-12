# McProject
JavaScript program for creating Minecraft datapacks from single file with some scripting capabilities.
## Usage
	mcProject.bat <source file>
or

    node app.js <source file>
## Scripting
### Basics
All text is divided between keywords and data. Keywords begin with a `@` and everything else is data. Data can exist only in definition blocks.
### Blocks, scoping and variables

Every block must be paired with an `@end` keyword. Together they form a block. Each block owns all variables defined inside it. Variables are inserted when their name is surrounded with `$`.

````
@repeat 4 i
  # Variable i is being set to loop index
  @debug Loop index: $i$
  @if $i$ 2
    @debug Variable i equals 2
  @end
  @set foo thing
  # Set variable foo to "thing"
@end

@debug $foo$
# ^ Error, because variable foo was defined inside block
````
### Keywords
Keywords must allways apear at the beginning of a line, only prefixed by whitespace. All keywords are divided to three categories:

 + Declaration - single line
 + Block - must be followed by an `@end` keyword
 + Definition - block keywords that define data for a specific purpose

 ### Declaration keywords
 + `@set <name> <...value> ` - Sets variable `name` to `value`
 + `@template <name> <arguments>` - Inserts template `name` with `arguments`
 + `@lookup <name> <table> <index>` - Sets variable `name` to value of a field `index` from table `table`
 + `@eval <name> <...expression>`  - Sets variable `name` to output of an mathematical expression `expression`
 + `@debug <...text>` - Prints `text` to output

### Block keywords
 + `@repeat <amount> <varable>` - Repeats containing code `amount` times and sets `variable` to loop index
 + `@if <a> <b>` - Code inside is only executed if `a` equals `b`
 + `@ifnot <a> <b>` - Code inside is only executed if `a` does not equal `b`
### Definition keywords
 + `@define <name> <...argument names>` - Defines a template with name `name` and arguments `argument names`
 + `@table <name>` - Defines a lookup table with name `name`
 + `@function <name>` - Defines a `.mcfunction` file to be put in `<folder>/functions`
 + `@advancement <name>` - Defines a `.json` file to be put in `<folder>/advancements`. All data must be a valid JavaScript object literal.
 + `@recipe <name>` - Defines a `.json` file to be put in `<folder>/recipes`. All data must be a valid JavaScript object literal.
 + `@loot <name>` - Defines a `.json` file to be put in `<folder>/loot_tables`. All data must be a valid JavaScript object literal.
 + `@tag <type> <name>` - Defines a `.json` file to be put in `<folder>/tags/<type>`.