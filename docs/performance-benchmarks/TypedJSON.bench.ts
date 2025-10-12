/**
 * Performance Benchmark for TypedJSON
 * 
 * Tests serialization and deserialization performance across various data types and sizes
 */

import { TypedJSON } from '../../src/shared/TypedJSON';

// Benchmark configuration
const ITERATIONS = 10;
const WARMUP_ITERATIONS = 3;

interface BenchmarkResult {
  name: string;
  operation: 'serialize' | 'deserialize' | 'roundtrip';
  dataSize: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput?: string;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

// Benchmark runner
async function benchmark(
  name: string,
  data: any,
  operation: 'serialize' | 'deserialize' | 'roundtrip' = 'roundtrip'
): Promise<BenchmarkResult> {
  const times: number[] = [];
  let serialized: string | undefined;
  let dataSize = 0;

  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    if (operation === 'serialize' || operation === 'roundtrip') {
      serialized = TypedJSON.stringify(data);
    }
    if (operation === 'deserialize' || operation === 'roundtrip') {
      if (!serialized) serialized = TypedJSON.stringify(data);
      TypedJSON.parse(serialized);
    }
  }

  // Actual benchmark
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    if (operation === 'serialize') {
      serialized = TypedJSON.stringify(data);
      dataSize = serialized.length;
    } else if (operation === 'deserialize') {
      if (!serialized) {
        serialized = TypedJSON.stringify(data);
        dataSize = serialized.length;
      }
      TypedJSON.parse(serialized);
    } else {
      // roundtrip
      const s = TypedJSON.stringify(data);
      TypedJSON.parse(s);
      dataSize = s.length;
    }

    const end = performance.now();
    times.push(end - start);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const throughput = operation === 'serialize' || operation === 'deserialize'
    ? `${(dataSize / 1024 / (avgTime / 1000)).toFixed(2)} KB/s`
    : undefined;

  return {
    name,
    operation,
    dataSize: formatBytes(dataSize),
    avgTime,
    minTime,
    maxTime,
    throughput,
  };
}

// Test data generators
function generateSmallObject() {
  return {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
  };
}

function generateComplexObject() {
  return {
    user: {
      id: '12345',
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date('2023-01-01'),
      tags: new Set(['admin', 'user', 'verified']),
      metadata: new Map([
        ['lastLogin', new Date()],
        ['preferences', { theme: 'dark', notifications: true }],
      ]),
    },
    stats: {
      views: 1000,
      likes: 500,
      ratio: 0.5,
    },
  };
}

function generateTypedArray(sizeKB: number) {
  const bytes = sizeKB * 1024;
  const array = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    array[i] = i % 256;
  }
  return array;
}

function generateLargeArray(size: number) {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random(),
  }));
}

function generateCircularStructure() {
  const obj: any = {
    name: 'Root',
    children: [],
  };
  const child1 = { name: 'Child1', parent: obj };
  const child2 = { name: 'Child2', parent: obj };
  obj.children = [child1, child2];
  return obj;
}

// Run benchmarks
async function runBenchmarks() {
  console.log('🚀 TypedJSON Performance Benchmark\n');
  console.log('='.repeat(80));
  console.log('\n');

  const results: BenchmarkResult[] = [];

  // Test 1: Small Plain Object
  console.log('📦 Test 1: Small Plain Object (JSON baseline)');
  const smallObj = generateSmallObject();
  results.push(await benchmark('Small Object - Serialize', smallObj, 'serialize'));
  results.push(await benchmark('Small Object - Deserialize', smallObj, 'deserialize'));
  results.push(await benchmark('Small Object - Round-trip', smallObj, 'roundtrip'));
  console.log('');

  // Test 2: Complex Object with Special Types
  console.log('📦 Test 2: Complex Object (Date, Map, Set)');
  const complexObj = generateComplexObject();
  results.push(await benchmark('Complex Object - Serialize', complexObj, 'serialize'));
  results.push(await benchmark('Complex Object - Deserialize', complexObj, 'deserialize'));
  results.push(await benchmark('Complex Object - Round-trip', complexObj, 'roundtrip'));
  console.log('');

  // Test 3: Small Uint8Array
  console.log('📦 Test 3: Small Uint8Array (10KB)');
  const small10KB = generateTypedArray(10);
  results.push(await benchmark('Uint8Array 10KB - Serialize', small10KB, 'serialize'));
  results.push(await benchmark('Uint8Array 10KB - Deserialize', small10KB, 'deserialize'));
  results.push(await benchmark('Uint8Array 10KB - Round-trip', small10KB, 'roundtrip'));
  console.log('');

  // Test 4: Medium Uint8Array
  console.log('📦 Test 4: Medium Uint8Array (100KB)');
  const medium100KB = generateTypedArray(100);
  results.push(await benchmark('Uint8Array 100KB - Serialize', medium100KB, 'serialize'));
  results.push(await benchmark('Uint8Array 100KB - Deserialize', medium100KB, 'deserialize'));
  results.push(await benchmark('Uint8Array 100KB - Round-trip', medium100KB, 'roundtrip'));
  console.log('');

  // Test 5: Large Uint8Array (like our image)
  console.log('📦 Test 5: Large Uint8Array (1MB)');
  const large1MB = generateTypedArray(1024);
  results.push(await benchmark('Uint8Array 1MB - Serialize', large1MB, 'serialize'));
  results.push(await benchmark('Uint8Array 1MB - Deserialize', large1MB, 'deserialize'));
  results.push(await benchmark('Uint8Array 1MB - Round-trip', large1MB, 'roundtrip'));
  console.log('');

  // Test 6: Very Large Uint8Array
  console.log('📦 Test 6: Very Large Uint8Array (5MB)');
  const large5MB = generateTypedArray(5 * 1024);
  results.push(await benchmark('Uint8Array 5MB - Serialize', large5MB, 'serialize'));
  results.push(await benchmark('Uint8Array 5MB - Deserialize', large5MB, 'deserialize'));
  results.push(await benchmark('Uint8Array 5MB - Round-trip', large5MB, 'roundtrip'));
  console.log('');

  // Test 7: Large Array of Objects
  console.log('📦 Test 7: Large Array (1000 objects)');
  const largeArray = generateLargeArray(1000);
  results.push(await benchmark('Large Array - Serialize', largeArray, 'serialize'));
  results.push(await benchmark('Large Array - Deserialize', largeArray, 'deserialize'));
  results.push(await benchmark('Large Array - Round-trip', largeArray, 'roundtrip'));
  console.log('');

  // Test 8: Circular References
  console.log('📦 Test 8: Circular References');
  const circular = generateCircularStructure();
  results.push(await benchmark('Circular Refs - Serialize', circular, 'serialize'));
  results.push(await benchmark('Circular Refs - Deserialize', circular, 'deserialize'));
  results.push(await benchmark('Circular Refs - Round-trip', circular, 'roundtrip'));
  console.log('');

  // Print summary table
  console.log('='.repeat(80));
  console.log('\n📊 BENCHMARK SUMMARY\n');
  console.log('='.repeat(80));
  console.log('');

  // Group by test
  const grouped = new Map<string, BenchmarkResult[]>();
  results.forEach(r => {
    const base = r.name.split(' - ')[0];
    if (!grouped.has(base)) grouped.set(base, []);
    grouped.get(base)!.push(r);
  });

  grouped.forEach((group, name) => {
    console.log(`\n${name}:`);
    console.log('-'.repeat(80));
    group.forEach(r => {
      console.log(
        `  ${r.operation.padEnd(12)} | ${r.avgTime.toFixed(2).padStart(8)}ms avg | ` +
        `${r.minTime.toFixed(2).padStart(8)}ms min | ${r.maxTime.toFixed(2).padStart(8)}ms max | ` +
        `Size: ${r.dataSize.padStart(10)}${r.throughput ? ` | ${r.throughput}` : ''}`
      );
    });
  });

  // Identify slow operations
  console.log('\n');
  console.log('='.repeat(80));
  console.log('\n⚠️  PERFORMANCE WARNINGS\n');
  console.log('='.repeat(80));
  console.log('');

  const slowOps = results.filter(r => r.avgTime > 100);
  if (slowOps.length > 0) {
    slowOps.sort((a, b) => b.avgTime - a.avgTime);
    console.log('Operations taking > 100ms:');
    slowOps.forEach(r => {
      console.log(`  ⚠️  ${r.name} (${r.operation}): ${r.avgTime.toFixed(2)}ms`);
    });
  } else {
    console.log('✅ No operations exceeded 100ms threshold');
  }

  // Calculate efficiency metrics
  console.log('\n');
  console.log('='.repeat(80));
  console.log('\n📈 EFFICIENCY METRICS\n');
  console.log('='.repeat(80));
  console.log('');

  const typedArrayTests = results.filter(r => r.name.includes('Uint8Array'));
  const serializeTests = typedArrayTests.filter(r => r.operation === 'serialize');
  const deserializeTests = typedArrayTests.filter(r => r.operation === 'deserialize');

  if (serializeTests.length > 0) {
    console.log('Serialization (TypedArray):');
    serializeTests.forEach(r => {
      const sizeMatch = r.name.match(/(\d+)(KB|MB)/);
      if (sizeMatch) {
        const size = parseInt(sizeMatch[1]);
        const unit = sizeMatch[2];
        const bytes = unit === 'MB' ? size * 1024 * 1024 : size * 1024;
        const mbps = (bytes / (1024 * 1024)) / (r.avgTime / 1000);
        console.log(`  ${r.name}: ${mbps.toFixed(2)} MB/s`);
      }
    });
  }

  console.log('');
  if (deserializeTests.length > 0) {
    console.log('Deserialization (TypedArray):');
    deserializeTests.forEach(r => {
      const sizeMatch = r.name.match(/(\d+)(KB|MB)/);
      if (sizeMatch) {
        const size = parseInt(sizeMatch[1]);
        const unit = sizeMatch[2];
        const bytes = unit === 'MB' ? size * 1024 * 1024 : size * 1024;
        const mbps = (bytes / (1024 * 1024)) / (r.avgTime / 1000);
        console.log(`  ${r.name}: ${mbps.toFixed(2)} MB/s`);
      }
    });
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ Benchmark Complete!');
  console.log('='.repeat(80));
}

// Run the benchmarks
runBenchmarks().catch(console.error);

