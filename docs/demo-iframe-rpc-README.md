# Iframe RPC Demo

A minimal, self-contained demo of the iframe RPC system that demonstrates communication between:
- **Iframe** → **Parent Window** → **HTTP Server**

## 🚀 Quick Start

### 1. Run the Demo Server

```bash
cd demo-iframe-rpc
bun run start
```

The server will start on `http://localhost:3001`

### 2. Open the Demo

Navigate to `http://localhost:3001/` in your browser.

You'll see:
- **Parent Window**: Blue header with traffic monitoring and logs
- **Iframe**: Green header with test buttons
- **Real-time traffic logs** showing all RPC calls

## 🧪 Testing the RPC System

### Dynamic Parent Window Methods
The parent window now supports **any method call** without registration:

- **Get Parent Info** - Retrieves parent window information
- **Get User Preferences** - Gets user preferences from parent
- **Show Notification** - Shows a notification in parent window
- **Trigger Parent Action** - Changes theme or shows alert
- **Test Dynamic Methods** - Tests localStorage, cookies, window size, etc.

### Built-in Dynamic Methods
The bridge automatically supports these methods:

- `getParentInfo()` - Parent window information
- `getUserPreferences()` - User preferences
- `showNotification(message, type)` - Show notifications
- `triggerParentAction(action)` - Trigger parent actions
- `navigateParent(url)` - Navigate parent window
- `getParentState()` - Get parent window state
- `setLocalStorage(key, value)` - Set localStorage
- `getLocalStorage(key)` - Get localStorage
- `removeLocalStorage(key)` - Remove localStorage
- `getCookies()` - Get all cookies
- `setCookie(name, value, options)` - Set cookie
- `getWindowSize()` - Get window dimensions
- `scrollParent(x, y)` - Scroll parent window
- `focusParent()` - Focus parent window
- `reloadParent()` - Reload parent window
- **Any window method** - Automatically proxied

### Server Methods
Click these buttons to test HTTP server communication:

- **Test Server Method** - Calls `DemoServer.getServerInfo()`
- **Test Mixed Call** - Combines parent + server calls

### Parent Window Monitoring
The parent window acts as a **pure bridge and traffic logger**:
- **No method registration required** - Fully dynamic and transparent
- **Real-time traffic logs** - See all iframe ↔ server communication
- **Clear traffic flow** - Visual indicators for each direction
- **Error monitoring** - Logs all errors and timeouts

## 📁 Demo Structure

```
demo-iframe-rpc/
├── index.html          # Parent window (blue) - Dynamic Bridge & Logger
├── iframe.html         # Iframe content (green) - Test Interface
├── DemoServer.ts       # Demo server module
├── demo-server.ts      # Server setup
├── package.json        # Dependencies
└── README.md          # This file
```

## 🔧 How It Works

### 1. Parent Window Setup (Dynamic Bridge)
```typescript
// Creates dynamic RPC bridge - NO METHOD REGISTRATION NEEDED!
const bridge = new ParentRpcBridge();

// The bridge automatically handles any method call:
// - Built-in methods (localStorage, cookies, window operations)
// - Window object methods (any function on window)
// - Window object properties (any property on window)
```

### 2. Iframe Setup (Client)
```typescript
// Creates RPC client and proxies
const rpcFactory = createIframeRpcFactory();
const parentProxy = rpcFactory.createParentProxy<ParentAPI>();
const serverProxy = rpcFactory.createServerProxy<DemoServer>('DemoServer');

// Call ANY method without registration!
await parentProxy.setLocalStorage('key', 'value');
await parentProxy.getWindowSize();
await parentProxy.anyWindowMethod();
```

### 3. Dynamic RPC Calls
```typescript
// These work without any setup code:
const info = await parentProxy.getParentInfo();
const size = await parentProxy.getWindowSize();
await parentProxy.setLocalStorage('theme', 'dark');
const cookies = await parentProxy.getCookies();

// Even window methods work automatically:
await parentProxy.focus();
await parentProxy.scrollTo(0, 100);
```

## 🎯 What This Demonstrates

✅ **Zero Configuration** - No method registration required  
✅ **Dynamic Method Support** - Any method call works automatically  
✅ **Type-safe RPC** - Full TypeScript support  
✅ **Parent Communication** - Iframe → Parent window calls  
✅ **Server Communication** - Iframe → Parent → HTTP server  
✅ **Mixed Calls** - Combining parent and server calls  
✅ **Error Handling** - Timeouts and error responses  
✅ **Real-time Traffic Monitoring** - See all RPC calls in action  
✅ **Pure Bridge Pattern** - Parent window as transparent traffic logger  

## 🔍 Traffic Monitoring

### Traffic Flow Indicators
The parent window logs show the complete flow:

- **📥 Iframe → Parent** - RPC calls from child to parent
- **📤 Parent → Iframe** - Responses back to child
- **🌐 Iframe → Server** - HTTP requests to backend
- **📡 Server → Parent** - HTTP responses from backend
- **❌ Error** - Failed requests and timeouts

### Example Log Output
```
[10:30:15] 🌉 Creating dynamic ParentRpcBridge...
[10:30:16] ✅ Dynamic ParentRpcBridge initialized successfully
[10:30:16] 🔓 No method registration required - bridge is fully transparent
[10:30:17] 🔄 Iframe loaded, notifying child window...
[10:30:18] 📥 Iframe → Parent: getParentInfo() called
[10:30:18] 📤 Parent → Iframe: Returning parent info
[10:30:19] 📥 Iframe → Parent: setLocalStorage("theme", "dark") called
[10:30:19] 📤 Parent → Iframe: localStorage set successfully
[10:30:20] 🌐 Iframe → Server: DemoServer.getServerInfo([])
[10:30:20] 📡 Server → Parent: DemoServer.getServerInfo response received
[10:30:20] 📤 Parent → Iframe: Returning server response
```

## 🔍 Debugging

### Check Browser Console
Both parent and iframe log to their respective consoles.

### Check Network Tab
See HTTP requests to `/api/demoserver/` endpoints.

### Check Traffic Logs
Real-time logs show:
- Complete RPC request/response flow
- Server HTTP calls and responses
- Error messages and timeouts
- Timing information

## 🚀 Integration with AiSliderClient

Once you're comfortable with this demo, you can integrate it with your existing `AiSliderClient`:

1. **Replace PotoClient** with iframe RPC in `AiSliderClient`
2. **Add ParentRpcBridge** to your main application (no setup required!)
3. **Call any parent method** without registration
4. **Use server proxies** for existing server calls

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use** - Change port in `demo-server.ts`
2. **Module not found** - Ensure all dependencies are installed
3. **CORS issues** - Demo runs on same origin, should work fine
4. **RPC timeouts** - Check network connectivity

### Debug Mode

Enable more verbose logging by modifying the RPC client timeout:

```typescript
rpcFactory.setTimeout(60000); // 60 seconds
```

## 📝 Next Steps

After testing this demo:

1. **Understand the dynamic flow** - Iframe → Parent → Server
2. **Test all scenarios** - Success, errors, timeouts
3. **Try custom methods** - Any method call works automatically
4. **Integrate with AiSliderClient** - Replace direct PotoClient usage

This demo provides a solid foundation for understanding and implementing the dynamic iframe RPC system in your main application! 