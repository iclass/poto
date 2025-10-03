import ts from 'typescript';

/**
 * Checks if a given string is a valid JavaScript literal.
 * @param input - The string to validate.
 * @returns True if valid, otherwise false.
 */
function isValidLiteral(input: string): boolean {
    // Wrap the input in a variable declaration for parsing
    const sourceText = `${input};`;
    const sourceFile = ts.createSourceFile('temp.ts', sourceText, ts.ScriptTarget.ES2015, /*setParentNodes */ true);

	console.log('direct statements:', sourceFile.statements.length)
	console.log('direct chirldren counts:', sourceFile.getChildCount())

    // Retrieve the first statement (should be the variable declaration)
    const statement = sourceFile.statements[0];
    if (!ts.isVariableStatement(statement)) {
        return false;
    }

    // Get the declaration and its initializer
    const declaration = statement.declarationList.declarations[0];
    if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) {
        return false;
    }

    const initializer = declaration.initializer;

    // Function to count meaningful child nodes (excluding whitespace and tokens)
    const countMeaningfulChildren = (node: ts.Node): number => {
        return ts.forEachChild(node, child => {
            if (
                child.kind !== ts.SyntaxKind.WhitespaceTrivia &&
                child.kind !== ts.SyntaxKind.EndOfFileToken
            ) {
                return 1 + countMeaningfulChildren(child);
            }
            return 0;
        }) || 0;
    };

    // Count the number of meaningful child nodes in the initializer
    const childCount = countMeaningfulChildren(initializer);

    if (childCount !== 1) {
        // More than one meaningful child implies it's not a single literal
        return false;
    }

    // Determine if the initializer is a recognized literal kind
    const validLiteralKinds: ts.SyntaxKind[] = [
        ts.SyntaxKind.StringLiteral,
        ts.SyntaxKind.NumericLiteral,
        ts.SyntaxKind.TrueKeyword,
        ts.SyntaxKind.FalseKeyword,
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.NoSubstitutionTemplateLiteral,
        ts.SyntaxKind.RegularExpressionLiteral,
    ];

    return validLiteralKinds.includes(initializer.kind);
}

// **Test Cases**
const testCases = [
    '10',                     // Valid number
    '"hello"',                // Valid string
    "'world'",                // Valid string
    '`template`',             // Valid template literal
    'true',                   // Valid boolean
    'false',                  // Valid boolean
    'null',                   // Valid null
    'undefined',              // Not a literal
    '10 @max 100',            // Invalid syntax
    '[1, 2, 3]',              // Array literal (multiple nodes)
    '{ a: 1 }',               // Object literal (multiple nodes)
    '() => {}',               // Arrow function
    'Symbol("sym")',          // Symbol (not a primitive literal)
    '/regex/',                // Regular expression literal
    'BigInt(100)',            // BigInt (not a primitive literal)
];

console.log('Literal Validation Results:\n');

testCases.forEach(test => {
    const result = isValidLiteral(test) ? 'Valid' : 'Invalid';
    console.log(`"${test}" is ${result} literal.`);
});
