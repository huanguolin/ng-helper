# ng-parser

## Grammar

> Official source code: [$parse](https://github.com/angular/angular.js/blob/master/src/ng/parse.js#L311)
 
> Document: [AngularJS Expressions](https://docs.angularjs.org/guide/expression)

```sh
# CFG

Program                 -> Statement*

# statement
Statement               -> ExpressionStatement
ExpressionStatement     -> Expression ';'?

# expression
Expression              -> FilterExpression
FilterExpression        -> NormalExpression ('|' Identifier (':' NormalExpression)*)*
NormalExpression        -> AssignExpression
AssignExpression        -> ConditionalExpression ('=' NormalExpression)?
ConditionalExpression   -> LogicalOrExpression ('?' NormalExpression : NormalExpression)?
LogicalOrExpression     -> LogicalAndExpression ('||' LogicalAndExpression)*
LogicalAndExpression    -> EqualityExpression ('&&' EqualityExpression)*
EqualityExpression      -> RelationalExpression (('==' | '!=' | '===' | '!==') RelationalExpression)*
RelationalExpression    -> AdditiveExpression (('<' | '>' | '<=' | '>=') AdditiveExpression)*
AdditiveExpression      -> MultiplicativeExpression (('+' | '-') MultiplicativeExpression)*
MultiplicativeExpression-> UnaryExpression (('*' | '/' | '%') UnaryExpression)*
UnaryExpression         -> ('+' | '-' | '!') UnaryExpression | Chain

Chain                   -> PrimaryExpression (Call | ElementAccess | PropertyAccess)*

Call                    -> '(' Arguments? ')'
ElementAccess           -> '[' NormalExpression ']'
PropertyAccess          -> '.' Identifier
Arguments               -> expression ( ',' expression )*

PrimaryExpression       -> Literal | Identifier | '(' Expression ')'
Literal                 -> LiteralKeyword | Constant | ArrayLiteralExpression | ArrayLiteralExpression
Constant                -> String | Number

ArrayLiteralExpression  -> '[' ArrayElements ']'
ArrayElements           -> (NormalExpression (',' NormalExpression)* ','?)?

ObjectLiteralExpression -> '{' ObjectProperties '}'
ObjectProperties        -> (ObjectProperty (',' ObjectProperty)* ','?)?
ObjectProperty          -> (Constant | Identifier | ElementAccess) ':' NormalExpression


# ------ literal ------

# string
String                  -> '"' Char+ '"' | "'" Char+ "'"
Char                    -> RegularChar | EscapeSequence | UnicodeSequence
RegularChar             -> ~EscapeSequence
EscapeSequence          -> '\' EscapeChar
EscapeChar              -> 'n' | 't' | 'r' | 'b' | 'f' | 'v' | '"' | "'" | '\\'
UnicodeSequence         -> '\u' Hex Hex Hex Hex

# identifier
Identifier              -> IdentifierStart IdentifierPart*
IdentifierStart         -> Letter | '_' | '$'
IdentifierPart          -> IdentifierStart | Digit

# number
Number                  -> Integer | Decimal | Exponent
Integer                 -> Digit+
Decimal                 -> Integer '.' Digit+ | '.' Digit+
Exponent                -> (Integer | Decimal) ('e' | 'E') ('+' | '-')? Digit+

Hex                     -> Digit | [A-F] | [a-f]
Digit                   -> [0-9]
Letter                  -> [A-Za-z]

LiteralKeyword          -> 'true' | 'false' | 'undefined' 'null'
```