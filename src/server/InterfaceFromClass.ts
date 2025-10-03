import ts from 'typescript';

function generateInterfaceFromClass(source: string): string {
    const sourceFile = ts.createSourceFile('temp.ts', source, ts.ScriptTarget.Latest, true);

    let interfaceDeclarations: string[] = [];

    function visit(node: ts.Node) {
        if (ts.isClassDeclaration(node)) {
            const interfaceName = `${node.name?.text}Interface`;
            const methods = node.members.filter(ts.isMethodDeclaration);

            const methodSignatures = methods.map(method => {
                const params = method.parameters.map(param => {
                    const paramName = param.name.getText();
                    const paramType = param.type ? param.type.getText() : 'any';
                    return `${paramName}: ${paramType}`;
                }).join(', ');

                const returnType = method.type ? method.type.getText() : 'void';
                return `    ${method.name.getText()}(${params}): ${returnType};`;
            });

            interfaceDeclarations.push(`interface ${interfaceName} {\n${methodSignatures.join('\n')}\n}`);
        }
        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return interfaceDeclarations.join('\n');
}

// Example usage
const sourceCode = `
export class MathProcessor {
    add(x: number, y: number): number { return x + y; }
    sub(x: number, y: number): number { return x - y; }
    mul(x: number, y: number): number { return x * y; }
    div(x: number, y: number): number { return x / y; }
    neg(x: number): number { return -x; }
    id(x: number): number { return x; }
    unknown(text: string): string { return \`unknown request \${text}\`; }
}`;

const interfaceSrcCode = generateInterfaceFromClass(sourceCode);
console.log(interfaceSrcCode);
