// Debug TypedJSON serialization
const fs = require('fs');

// Read the TypedJSON file and evaluate it
const typedJsonPath = './src/shared/TypedJSON.ts';
const typedJsonContent = fs.readFileSync(typedJsonPath, 'utf8');

// Create a simple test
const testData = { infinity: Infinity };
console.log('Original data:', testData);

// Test regular JSON
const regularJson = JSON.stringify(testData);
console.log('Regular JSON:', regularJson);
const regularParsed = JSON.parse(regularJson);
console.log('Regular parsed:', regularParsed);

// Test TypedJSON manually
const typedSerialized = {
  __number: 'Infinity'
};
console.log('Typed serialized:', JSON.stringify(typedSerialized));

// Test deserialization
if (typedSerialized.__number === 'Infinity') {
  console.log('Deserialized to:', Infinity);
} else {
  console.log('Deserialized to:', typedSerialized.__number);
}
