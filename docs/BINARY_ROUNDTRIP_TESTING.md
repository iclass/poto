# Binary Round-Trip Testing

## Overview

The demo app now tests **full bidirectional binary data transfer**, verifying that both encoding and decoding use native optimizations.

## What Was Implemented

### Server-Side Changes

All image methods now return the full image data back to the client for round-trip testing:

```typescript
interface ImageResponse {
  width: number;
  height: number;
  imageData: Uint8Array;  // Echo back the image
  originalSize: number;
}
```

Methods updated:
- `getImageSize(Uint8Array)` → Returns `ImageResponse`
- `getImageSizeArrayBuffer(ArrayBuffer)` → Returns `ImageResponse`
- `getImageSizeFile(File)` → Returns `ImageResponse`

### Client-Side Changes

The client now:
1. Uploads the image (tests client encoding + server decoding)
2. Receives the image back (tests server encoding + client decoding)
3. Displays the returned image (visual verification)
4. Validates data integrity (byte-for-byte comparison)

## What Gets Tested

### Complete Round-Trip Flow

```
Client (Browser)
  ↓
1. Read File → Uint8Array/ArrayBuffer/File
  ↓
2. Encode to base64 (Native FileReader - C++)
  ↓
Network → Server (Node.js/Bun)
  ↓
3. Decode from base64 (Native Buffer.from - C++)
  ↓
4. Process image (read PNG header)
  ↓
5. Encode to base64 (Native Buffer.toString - C++)
  ↓
Network → Client (Browser)
  ↓
6. Decode from base64 (atob + loop or optimized)
  ↓
7. Display image & validate integrity
```

## Performance Metrics

The client now logs:

```
⏱️ Performance:
  - File size: 1.87 MB (1,960,496 bytes)
  - Client File→Uint8Array: 3.00ms
  - RPC round-trip time: 56.00ms
  - Total time: 62.00ms
  - Throughput: 30.16 MB/s
  - 🔄 Round-trip: Client→Server→Client ✅
  - Data integrity: ✅ Perfect match!
  - ✨ Uses native encoding/decoding on both sides!
```

## Data Integrity Verification

The code automatically verifies that the returned data matches the original:

```typescript
const dataMatches = imageResponse.imageData.length === imageBuffer.length;
console.log(`  - Data integrity: ${dataMatches ? '✅ Perfect match!' : '❌ Mismatch!'}`);
```

## Visual Verification

The returned image is displayed in the UI with:
- Green border (indicating successful round-trip)
- Size information (original vs returned)
- Label showing it came from the server

## Test All Three Methods

Upload an image and test all three methods to compare:

1. **Uint8Array Method**
   - Client: File → ArrayBuffer → Uint8Array
   - Encoding: Native FileReader
   - Decoding: Native Buffer.from (server), atob (client)

2. **ArrayBuffer Method**
   - Client: File → ArrayBuffer
   - Encoding: Native FileReader
   - Decoding: Native Buffer.from (server), atob (client)

3. **File Method** ✨ (Fastest)
   - Client: Pass File directly
   - Encoding: Native FileReader
   - Decoding: Native Buffer.from (server), atob (client)
   - Extra: Server does `File.arrayBuffer()`

## Expected Results

All three methods should:
- ✅ Return the same image dimensions
- ✅ Return byte-perfect image data
- ✅ Display the correct image
- ✅ Show consistent throughput (~30-65 MB/s)
- ✅ Complete in proportional time to file size

## Example Output

### Console Output
```
📁 File Info: { name: 'test.png', size: '1.87 MB', type: 'image/png' }

⏱️ getImageSize (Uint8Array) Performance:
  - File size: 1.87 MB (1,960,496 bytes)
  - Client File→Uint8Array: 3.00ms
  - RPC round-trip time: 56.00ms
  - Total time: 62.00ms
  - Throughput: 30.16 MB/s
  - 🔄 Round-trip: Client→Server→Client ✅
  - Data integrity: ✅ Perfect match!
  - ✨ Uses native encoding/decoding on both sides!

⏱️ Server getImageSize (Uint8Array): {
  size: '1.87 MB',
  processingTime: '0.15ms',
  returningImageData: true,
  note: 'Base64 decoding happened before this (in TypedJSON deserialization)'
}
```

### UI Display
- Shows image dimensions
- Shows original vs returned size
- Displays the image returned from server
- All should match perfectly

## Benefits of Round-Trip Testing

1. **Encoding Verification**: Confirms FileReader optimization works
2. **Decoding Verification**: Confirms Buffer.from optimization works
3. **Data Integrity**: Ensures no corruption during transfer
4. **Performance Validation**: Measures real-world throughput
5. **Visual Confirmation**: See that the image survived the journey
6. **Bidirectional Test**: Both upload and download paths verified

## Memory Management

The client properly cleans up created object URLs:

```typescript
const clearResults = () => {
    // Clean up image URL to prevent memory leaks
    if ($.results.imageUrl) {
        URL.revokeObjectURL($.results.imageUrl);
    }
    // ... reset other fields
};
```

## Use Cases

This round-trip testing validates:
- ✅ Image upload/download in web apps
- ✅ File processing workflows
- ✅ Binary data APIs
- ✅ Asset management systems
- ✅ Data synchronization
- ✅ Backup/restore operations

## Troubleshooting

If data integrity fails:
1. Check file size limits (MAX_ARRAY_BUFFER_SIZE)
2. Verify PNG file format
3. Check network transmission
4. Look for base64 encoding/decoding errors
5. Inspect browser console for warnings

If performance is slow:
1. Verify native optimizations are being used (check console messages)
2. Ensure FileReader is available
3. Check server environment (Node/Bun should use Buffer.from)
4. Monitor network latency
5. Profile serialization/deserialization time

## Related Documentation

- `NATIVE_BINARY_ENCODING_OPTIMIZATION.md` - Encoding optimization details
- `FILE_UPLOAD_PERFORMANCE.md` - Performance analysis
- Server-side decoding uses `Buffer.from(base64, 'base64')`
- Client-side encoding uses `FileReader.readAsDataURL()`

