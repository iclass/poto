# POTO 框架

**POTO** (Plain Old TypeScript Objects) 是一个现代化的全栈 TypeScript 框架，专为构建实时流式应用程序而设计，内置对大语言模型 (LLMs) 的支持。该框架在服务器和客户端代码之间提供清晰的分离，同时在整个技术栈中保持类型安全。

> **注意：POTO 框架通过类型安全的 RPC 屏蔽了前后端通信的底层细节。**
>
> 你无需关心 HTTP 路由、请求体、响应体、序列化、鉴权头等繁琐实现。底层通信细节都被 POTO 的 HETTP（类型安全高阶传输协议）机制自动封装和隐藏。
>
> - **前端调用后端方法**时，只需像调用本地 TypeScript 方法一样，无需手动拼接 API 路径或处理 HTTP 请求。
> - **后端暴露的模块方法**会自动生成类型安全的远程调用接口，前端通过 `getProxy<T>()` 获取代理对象即可直接调用。
> - **所有参数和返回值**都自动类型检查和序列化，避免手动转换和类型不一致问题。
> - **认证、会话、流式传输**等机制也都自动处理，无需手动插入 token 或管理连接。
>
> 这样，开发者可以专注于业务逻辑，无需关心通信细节，极大提升开发效率和安全性。


## 📦 安装与使用

### 快速开始

> 👀 **完整但极简的示例应用已包含在本仓库的 `demoapp/` 目录下。建议直接阅读和运行 `demoapp` 来快速了解 POTO 的最小用法及最佳实践！详情见 `demoapp/README.md`。  


```bash

# 安装特定版本
bun add https://github.com/iclass/poto/releases/download/v1.0.13/poto.tar.gz     

```

### 方式一：作为远程依赖使用（推荐）

1. **创建新项目**：
   ```bash
   mkdir my-poto-app
   cd my-poto-app
   ```

2. **添加 Poto 作为依赖**：
   ```json
   // package.json
   {
     "name": "my-poto-app",
     "version": "1.0.0",
     "type": "module",
     "dependencies": {
       "poto": "https://github.com/iclass/poto/releases/download/v1.0.13/poto.tar.gz"
     }
   }
   ```

3. **安装依赖**：
   ```bash
   bun install
   ```

4. **创建服务器** (`src/server.ts`)：
   ```typescript
   import { PotoServer, PotoModule } from 'poto';
   
   class MyModule extends PotoModule {
       async getHello_(): Promise<string> {
           return "Hello from Poto!";
       }
   }
   
   const server = new PotoServer({
       port: 3000,
       jwtSecret: 'your-secret'
   });
   
   server.addModule(new MyModule());
   server.run();
   ```

5. **运行项目**：
   ```bash
   bun run src/server.ts
   ```

### 可用的导入选项

Poto 框架支持多种导入方式：

```typescript
// 基础导入
import { PotoServer, PotoClient, PotoModule } from 'poto';

// 完整导入（包含所有功能）
import { 
    PotoServer, 
    PotoClient, 
    PotoModule, 
    LLMPotoModule,
    LLM,
    LLMConfig,
    PotoUser,
    UserProvider,
    UserSessionProvider,
    UserSessionData,
    LLMSessionData,
    PotoRequestContext,
    DialogEntry,
    DialogRole,
    JSONSchema
} from 'poto';

// 按需导入（推荐）
import { PotoServer, PotoModule } from 'poto';
import { PotoClient } from 'poto';
import { LLMPotoModule } from 'poto';
```

### 快速添加依赖（一键安装）

使用我们的便捷脚本：

```bash
   # 下载并运行安装脚本
   curl -fsSL https://raw.githubusercontent.com/iclass/poto/main/scripts/add-poto-dependency.sh | bash
   
   # 或者手动运行
   wget https://raw.githubusercontent.com/iclass/poto/main/scripts/add-poto-dependency.sh
chmod +x add-poto-dependency.sh
./add-poto-dependency.sh
```

这将自动：
- 添加 Poto 作为依赖到 `package.json`
- 创建示例服务器和客户端文件
- 设置基本的项目结构

### 方式二：从 GitHub Releases 下载

1. **下载最新版本**：
   ```bash
   # 下载最新发布版本
   curl -L -o poto.tar.gz https://github.com/iclass/poto/releases/latest/download/poto.tar.gz
   
   # 解压到项目目录
   tar -xzf poto.tar.gz
   cd poto
   ```

2. **安装依赖并启动**：
   ```bash
   bun install
   bun run dev
   ```

### 方式二：作为 Git 子模块

```bash
   # 添加为子模块
   git submodule add https://github.com/iclass/poto.git poto
cd poto
bun install
```

### 方式三：直接克隆仓库

```bash
   # 克隆仓库
   git clone https://github.com/iclass/poto.git
cd poto
bun install
```

## 🚀 核心特性

- **基于 Bun 的全栈开发框架**：POTO 框架构建于现代 Bun 技术之上，专为全栈 TypeScript 开发而设计，前后端一体化，极致性能与开发体验。
- **类型安全的 RPC**：自动化客户端与服务器通信，前后端 TypeScript 类型完全一致，开发无缝衔接。
- **HTTP 协议全封装**：框架彻底隐藏 HTTP 协议细节，无需关心路由、请求体、响应体、Header、Token 注入等，所有通信细节由 POTO 自动处理，开发者专注业务逻辑。
- **灵活的数据类型支持**：支持复杂 JavaScript 数据类型在前后端间无缝传递，包括 Date、RegExp、Map、Set、Error、URL、ArrayBuffer、Blob、BigInt 等，类型信息完全保留。
- **实时流式传输**：内置服务器发送事件（SSE）和流式响应，支持高效实时数据推送。
- **LLM 集成**：原生支持大语言模型（LLM），流式传输可随时取消，AI 能力无缝集成。
- **用户管理系统**：完善的用户管理，支持多种后端存储，灵活扩展。
- **会话管理**：用户会话持久化，状态与数据统一管理。
- **身份验证**：基于 JWT 的安全认证，支持访客模式与用户凭据。
- **请求取消**：客户端断开自动清理资源，保障服务健壮性。
- **模块化架构**：关注点分离，模块化设计，易于维护与扩展。

## 📊 灵活的数据类型支持

POTO 框架的 RPC 机制支持传递复杂的 JavaScript 数据类型，这是框架的一个重要特性。通过内置的 TypedJSON 序列化系统，你可以在前后端之间无缝传递各种复杂的数据结构，而无需担心类型丢失或手动转换。

### 支持的数据类型

#### 基础数据类型
- **原始类型**：`string`、`number`、`boolean`、`null`、`undefined`
- **特殊数值**：`Infinity`、`-Infinity`、`NaN`、`-0`、大整数
- **BigInt**：支持任意精度的整数运算

#### 复杂对象类型
- **Date 对象**：完整的日期时间信息，包括时区和毫秒精度
- **RegExp 对象**：正则表达式，保留模式和标志
- **Map 和 Set**：键值对集合和唯一值集合
- **Error 对象**：错误信息，包括堆栈跟踪和自定义属性
- **URL 对象**：完整的 URL 解析和构建

#### 二进制数据类型
- **ArrayBuffer**：原始二进制数据缓冲区
- **TypedArray**：`Uint8Array`、`Int32Array`、`Float64Array` 等类型化数组
- **Blob 对象**：文件数据，支持多种 MIME 类型

#### 嵌套和复杂结构
- **深层嵌套对象**：任意深度的对象嵌套
- **混合数组**：包含不同类型元素的数组
- **循环引用**：自动检测和处理对象循环引用
- **函数和 Symbol**：优雅降级处理（序列化为 null）

### 实际应用示例

#### 用户会话数据
```typescript
// 复杂的用户会话数据，包含各种数据类型
const userSession = {
    userId: "user123",
    createdAt: new Date("2023-01-01T00:00:00Z"),
    lastActivity: new Date(),
    preferences: new Map([
        ["theme", "dark"],
        ["language", "zh-CN"]
    ]),
    tags: new Set(["premium", "beta-tester"]),
    profile: {
        avatar: new Blob([/* 图片数据 */], { type: "image/png" }),
        settings: {
            notifications: true,
            timeout: 30000
        }
    },
    metadata: new Map([
        ["loginCount", 42],
        ["lastLogin", new Date()]
    ])
};

// 通过 RPC 传递，类型信息完全保留
const result = await userModule.updateSession(userSession);
```

#### 文件处理
```typescript
// 文件上传和处理
const fileData = {
    name: "document.pdf",
    content: new Blob([/* 文件内容 */], { type: "application/pdf" }),
    metadata: {
        size: 1024000,
        uploadedAt: new Date(),
        checksum: "sha256:abc123...",
        tags: new Set(["important", "confidential"])
    },
    permissions: new Map([
        ["read", ["user1", "user2"]],
        ["write", ["user1"]]
    ])
};

// 类型安全地传递到后端
await fileModule.uploadFile(fileData);
```

#### 配置管理
```typescript
// 复杂的应用配置
const appConfig = {
    version: "1.0.0",
    features: new Set(["chat", "file-upload", "streaming"]),
    limits: {
        maxUsers: 1000,
        timeout: 30000,
        rateLimit: new Map([
            ["api", 100],
            ["upload", 10]
        ])
    },
    endpoints: new Map([
        ["api", new URL("https://api.example.com")],
        ["cdn", new URL("https://cdn.example.com")]
    ]),
    regex: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^\+?[\d\s-()]+$/
    }
};

// 配置在前后端间完美同步
await configModule.updateConfig(appConfig);
```

### TypedJSON 序列化系统

POTO 框架使用 TypedJSON 作为底层序列化机制，它提供了以下优势：

#### 类型保持
- **自动类型检测**：自动识别需要类型保持的数据
- **透明序列化**：开发者无需手动处理类型转换
- **向后兼容**：与标准 JSON 完全兼容

#### 性能优化
- **智能序列化**：只对需要类型保持的数据使用 TypedJSON
- **内存安全**：内置深度限制和大小限制，防止内存溢出
- **异步支持**：Blob 等大型对象支持异步序列化

#### 使用示例
```typescript
// 自动类型保持的序列化
import { stringifyTypedJson, parseTypedJson } from 'poto';

const data = {
    date: new Date(),
    map: new Map([["key", "value"]]),
    set: new Set([1, 2, 3])
};

// 序列化 - 类型信息被保留
const serialized = stringifyTypedJson(data);

// 反序列化 - 原始类型被恢复
const parsed = parseTypedJson(serialized);
console.log(parsed.date instanceof Date); // true
console.log(parsed.map instanceof Map);   // true
console.log(parsed.set instanceof Set);  // true
```

### 性能考虑

#### 内存安全
- **深度限制**：默认最大深度 20 层，防止栈溢出
- **大小限制**：Blob 最大 50MB，ArrayBuffer 最大 50MB
- **字符串限制**：单个字符串最大 10MB

#### 性能优化
- **智能检测**：只对需要类型保持的数据使用 TypedJSON
- **批量处理**：大量数据支持批量序列化
- **异步处理**：大型对象支持异步序列化

#### 最佳实践
```typescript
// 推荐：使用类型化的接口
interface UserData {
    id: string;
    createdAt: Date;
    preferences: Map<string, any>;
    metadata: Set<string>;
}

// 推荐：合理使用复杂类型
const userData: UserData = {
    id: "user123",
    createdAt: new Date(),
    preferences: new Map([["theme", "dark"]]),
    metadata: new Set(["verified"])
};

// 避免：过度嵌套和循环引用
const badData = {
    // 避免过深的嵌套
    level1: { level2: { level3: { /* ... 20+ levels */ } } },
    // 避免循环引用
    circular: null as any
};
badData.circular = badData; // 不推荐
```

### 错误处理

TypedJSON 提供了完善的错误处理机制：

```typescript
try {
    const result = await myModule.processComplexData(complexData);
} catch (error) {
    if (error.message.includes('Maximum serialization depth')) {
        console.error('数据嵌套过深，请简化数据结构');
    } else if (error.message.includes('Maximum size exceeded')) {
        console.error('数据过大，请分批处理');
    } else {
        console.error('序列化错误:', error.message);
    }
}
```

## 🔗 集成到现有项目

### 作为依赖框架使用

1. **下载框架文件**：
   ```bash
   # 创建项目目录
   mkdir my-poto-app
   cd my-poto-app
   
   # 下载最新版本
   curl -L -o poto.tar.gz https://github.com/iclass/poto/releases/latest/download/poto.tar.gz
   tar -xzf poto.tar.gz
   ```

2. **创建你的应用结构**：
   ```bash
   # 创建你的模块
   mkdir src/modules
   touch src/modules/MyModule.ts
   touch src/server.ts
   touch src/client.ts
   ```

3. **创建服务器** (`src/server.ts`)：
   ```typescript
   import { PotoServer } from './poto/src/server/PotoServer';
   import { MyModule } from './modules/MyModule';
   
   const server = new PotoServer({
     port: 3000,
     jwtSecret: 'your-secret-key'
   });
   
   server.addModule(new MyModule());
   server.run();
   ```

4. **创建客户端** (`src/client.ts`)：
   ```typescript
   import { PotoClient } from 'poto';
   import { MyModule } from './modules/MyModule';
   
   const client = new PotoClient('http://localhost:3000');
   const myModule = client.getProxy<MyModule>(MyModule.name);
   
   // 使用模块
   const result = await myModule.someMethod();
   ```

### 作为模板项目使用

```bash
# 使用 Poto 作为项目模板
git clone https://github.com/iclass/poto.git my-new-app
cd my-new-app
rm -rf .git  # 移除 Git 历史
git init     # 初始化新的 Git 仓库
bun install
bun run dev
```

## 🏗️ 架构概览

POTO 框架由四个核心组件组成：

### 1. **PotoServer** - 后端引擎
- 具有自动路由生成的 HTTP 服务器
- 使用 SSE 支持的实时消息传递
- JWT 身份验证和用户管理
- 会话提供者集成
- 静态文件服务
- 请求取消处理

### 2. **PotoClient** - 前端连接器
- 类型安全的 RPC 代理生成
- 自动请求/响应处理
- 复杂数据类型无缝传递（Date、Map、Set、Blob 等）
- 实时数据流式传输支持
- 凭据管理和存储
- 会话状态管理
- 请求取消

### 3. **PotoModule** - 业务逻辑基类
- 服务器端模块的基类
- 请求上下文管理
- 用户会话处理
- 会话数据访问
- 取消检测

### 4. **LLMPotoModule** - AI 集成层
- 专为 LLM 驱动的模块设计的基类
- 模型管理和切换
- 流式 LLM 响应
- 客户端断开连接时自动取消

## 📋 快速开始

### 安装

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev
```

### 基本服务器设置

```typescript
import { PotoServer } from './src/server/PotoServer';
import { InMemoryUserProvider } from './src/server/UserProvider';

// 创建服务器实例
const server = new PotoServer({
    port: 3999,
    staticDir: './public',
    jwtSecret: 'your-secret-key',
    routePrefix: 'api'
});

// 设置用户提供者
server.setUserProvider(new InMemoryUserProvider());

// 添加你的模块
server.addModule(new MyBusinessModule());

// 启动服务器
server.run();
```

### 基本客户端设置

```typescript
import { PotoClient } from './src/web/rpc/PotoClient';

// 创建客户端实例
const client = new PotoClient('http://localhost:3999');

// 获取服务器模块的类型安全代理
const myModule = client.getProxy<MyBusinessModule>('MyBusinessModule');

// 使用完整的类型安全调用服务器方法
const result = await myModule.getData();
```

## 🎯 通用聊天 CLI - 完整示例

通用聊天 CLI 展示了 POTO 框架的全部功能。它是一个命令行聊天应用程序，展示了：

- **LLM 的实时流式响应**
- **用户身份验证** 和凭据管理
- **模型切换** 在不同 LLM 提供商之间
- **请求取消** 通过 Ctrl+C 中断
- **会话持久化** 跨对话
- **图片附件** 支持
- **Markdown 渲染** 用于 AI 响应

### 运行聊天 CLI

```bash
# 启动聊天客户端（包含服务器）
bun run genericChatCli/client/ChatClient.ts

# 或者分别启动服务器和客户端
bun run genericChatCli/server/ServerMain.ts  # 终端 1
bun run genericChatCli/client/ChatClient.ts # 终端 2
```

### 聊天 CLI 功能

聊天 CLI 展示了这些 POTO 框架功能：

#### 🔐 身份验证和用户管理

聊天 CLI 演示了完整的用户管理系统：

```bash
# 使用凭据登录（持久化存储）
login
# 输入用户 ID: iclass
# 输入密码: your-password
# 凭据自动保存到本地存储

# 访客登录（临时用户）
# 自动生成访客 ID 和密码
# 支持访客模式，无需注册

# 登出并清除凭据
logout
# 清除所有存储的凭据和会话数据
```

**身份验证流程：**
1. **凭据存储**: 使用 `CredentialManager` 管理用户凭据
2. **JWT 令牌**: 自动处理 JWT 令牌的生成和验证
3. **会话持久化**: 用户会话数据跨对话保持
4. **访客支持**: 无需注册即可使用，自动生成临时用户

#### 🤖 模型管理和会话数据

```bash
# 列出可用模型（从服务器获取）
models

# 切换到特定模型（更新用户会话）
model 1
model 2
model default

# 查看当前模型（从会话数据获取）
model
```

**会话管理特性：**
- **模型偏好**: 用户选择的模型保存在会话中
- **跨对话持久化**: 模型选择在重启后保持
- **会话统计**: 跟踪活跃会话和用户活动

#### 💬 流式聊天和请求管理

```bash
# 开始对话（默认启用流式传输）
你好，今天怎么样？

# 禁用流式传输以获得更快响应
streaming off

# 重新启用流式传输
streaming on

# 取消当前请求（演示请求取消）
cancel

# 检查请求状态
status
```

**请求管理特性：**
- **自动取消**: 新请求自动取消前一个请求
- **手动中断**: Ctrl+C 中断当前流式响应
- **状态跟踪**: 实时显示请求处理状态

#### 🎨 自定义和配置

```bash
# 设置系统提示（保存在会话中）
system 你是一个有用的编程助手

# 更改颜色（客户端配置）
color ai brightGreen
color user brightBlue

# 切换 Markdown 解析
markdown on
markdown off

# 切换 JSON 输出模式
json on
json off

# 切换推理模式
reasoning on
reasoning off
```

**配置管理：**
- **会话配置**: 系统提示等保存在用户会话中
- **客户端配置**: 颜色、Markdown 等保存在客户端
- **持久化存储**: 配置在重启后保持

#### 📷 图片支持和多媒体

```bash
# 附加本地图片
attach ./path/to/image.jpg

# 从 URL 附加图片
attach https://example.com/image.png

# 支持多种图片格式
# .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg
```

**图片处理特性：**
- **本地文件**: 自动读取和编码本地图片
- **远程 URL**: 直接使用网络图片
- **Base64 编码**: 自动处理图片编码
- **MIME 类型**: 自动检测图片类型

#### ⚡ 高级功能

```bash
# 测试非流式取消
test-nonstream

# 查看命令历史
cmdhistory

# 查看对话历史
history

# 清除对话历史
clear

# 获取帮助
help
```

**高级特性：**
- **命令历史**: 支持上下箭头浏览历史
- **对话历史**: 完整的对话记录管理
- **错误处理**: 优雅的错误处理和恢复
- **多模式支持**: 流式/非流式、JSON/文本等

## 🔧 构建你自己的应用程序

### 1. 创建服务器模块

```typescript
import { LLMPotoModule } from './src/llms/LLMPotoModule';

export class MyLLMModule extends LLMPotoModule {
    getRoute(): string {
        return 'MyLLMModule';
    }

    // 流式 LLM 响应
    async *chatWithHistory(message: string, history: ChatMessage[]): AsyncGenerator<string> {
        const llm = await this.getUserPreferredLLM();
        
        // 你的 LLM 逻辑
        for await (const chunk of llm.streamChat(message, history)) {
            yield chunk;
        }
    }

    // 常规方法
    async getCurrentModel(): Promise<ModelInfo> {
        return await super.getCurrentModel();
    }
}
```

### 2. 设置服务器

```typescript
import { PotoServer } from './src/server/PotoServer';
import { MyLLMModule } from './MyLLMModule';

const server = new PotoServer({
    port: 3999,
    staticDir: './public',
    jwtSecret: 'your-secret-key'
});

// 添加你的模块
server.addModule(new MyLLMModule());

server.run();
```

### 3. 创建客户端

```typescript
import { PotoClient } from './src/web/rpc/PotoClient';

const client = new PotoClient('http://localhost:3999');

// 获取类型安全代理
const myModule = client.getProxy<MyLLMModule>('MyLLMModule');

// 使用模块
const model = await myModule.getCurrentModel();
console.log('当前模型:', model);
```

## 🎨 高级功能

### 用户管理系统

POTO 框架提供了完整的用户管理系统，支持多种用户存储后端：

#### 用户提供者 (UserProvider)

```typescript
// 内存用户提供者（开发环境）
import { InMemoryUserProvider } from './src/server/UserProvider';

const userProvider = new InMemoryUserProvider();

// 添加用户
userProvider.addUser(new PotoUser('user1', hashedPassword, ['user']));

// 查找用户
const user = await userProvider.findUserByUserId('user1');

// 自定义用户提供者
class DatabaseUserProvider implements UserProvider {
    async findUserByUserId(userId: string): Promise<PotoUser | undefined> {
        // 从数据库查找用户
        const userData = await this.db.users.findOne({ id: userId });
        return userData ? new PotoUser(userData.id, userData.passwordHash, userData.roles) : undefined;
    }
    
    addUser(user: PotoUser): void {
        // 保存用户到数据库
        this.db.users.insert({
            id: user.id,
            passwordHash: user.passwordHash,
            roles: user.roles
        });
    }
}
```

#### 身份验证流程

```typescript
// 服务器端身份验证
const server = new PotoServer({
    port: 3999,
    jwtSecret: 'your-secret-key'
});

// 设置用户提供者
server.setUserProvider(new DatabaseUserProvider());

// 客户端登录
const client = new PotoClient('http://localhost:3999');

// 用户凭据登录
await client.login({ username: 'user1', password: 'password' });

// 访客登录（自动生成临时用户）
await client.loginAsVisitor();
```

### 会话管理系统

#### 会话提供者 (UserSessionProvider)

```typescript
// 内存会话提供者（开发环境）
import { InMemorySessionProvider } from './src/server/UserSessionProvider';

const sessionProvider = new InMemorySessionProvider();
server.setSessionProvider(sessionProvider);

// 自定义会话提供者
class DatabaseSessionProvider implements UserSessionProvider {
    async getSession(userId: string): Promise<UserSessionData | undefined> {
        // 从数据库获取会话数据
        const sessionData = await this.db.sessions.findOne({ userId });
        return sessionData ? this.deserializeSession(sessionData) : undefined;
    }
    
    async setSession(userId: string, session: UserSessionData): Promise<void> {
        // 保存会话数据到数据库
        await this.db.sessions.upsert({ userId }, {
            userId,
            data: this.serializeSession(session),
            lastActivity: new Date()
        });
    }
    
    async deleteSession(userId: string): Promise<void> {
        await this.db.sessions.deleteOne({ userId });
    }
}
```

#### 会话数据管理

```typescript
// 在模块中使用会话
export class MyModule extends PotoModule {
    async getUserPreferences(): Promise<UserPreferences> {
        const session = await this.getUserSession();
        return session.preferences || {};
    }
    
    async updateUserPreferences(preferences: UserPreferences): Promise<void> {
        await this.updateUserSession((session) => {
            session.preferences = preferences;
            session.lastActivity = new Date();
        });
    }
    
    async getSessionStats(): Promise<SessionStats> {
        return await this.getSessionStats();
    }
}
```

### 流式响应

```typescript
// 服务器端流式传输
async *streamData(): AsyncGenerator<string> {
    for (let i = 0; i < 10; i++) {
        yield `数据块 ${i}\n`;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// 客户端消费
const stream = await myModule.streamData();
for await (const chunk of stream) {
    console.log(chunk);
}
```

### 请求取消

```typescript
// 服务器端取消检测
async processRequest(): Promise<string> {
    if (this.isRequestCancelled()) {
        throw new Error('请求已取消');
    }
    
    // 你的处理逻辑
    return '结果';
}
```

### 身份验证和授权

```typescript
// 角色基础访问控制
export class SecureModule extends PotoModule {
    // 需要管理员角色
    @RequireRoles(['admin'])
    async deleteUser(userId: string): Promise<void> {
        // 只有管理员可以删除用户
    }
    
    // 需要用户角色
    @RequireRoles(['user', 'admin'])
    async updateProfile(profile: UserProfile): Promise<void> {
        // 用户和管理员都可以更新资料
    }
    
    // 公开访问
    async getPublicData(): Promise<PublicData> {
        // 任何人都可以访问
    }
}
```

## 🔌 集成示例

### Web 应用程序

```typescript
// 前端
const client = new PotoClient('/api');
const chatModule = client.getProxy<ChatModule>('ChatModule');

// 流式聊天响应
const response = await chatModule.chatWithHistory(message, history);
for await (const chunk of response) {
    displayMessage(chunk);
}
```

### Node.js CLI 工具

```typescript
// CLI 应用程序
const client = new PotoClient('http://localhost:3999');
const llmModule = client.getProxy<LLMModule>('LLMModule');

// 处理取消支持
try {
    const result = await llmModule.processText(input);
    console.log(result);
} catch (error) {
    if (error.name === 'AbortError') {
        console.log('请求已取消');
    }
}
```

## 📚 API 参考

### 数据类型支持

POTO 框架的 RPC 机制支持以下数据类型的无缝传递：

#### 基础类型
- `string`、`number`、`boolean`、`null`、`undefined`
- `Infinity`、`-Infinity`、`NaN`、`-0`
- `BigInt` 任意精度整数

#### 复杂对象
- `Date` - 完整日期时间信息
- `RegExp` - 正则表达式（保留模式和标志）
- `Map<K, V>` - 键值对集合
- `Set<T>` - 唯一值集合
- `Error` - 错误对象（包含堆栈跟踪）
- `URL` - URL 对象

#### 二进制数据
- `ArrayBuffer` - 原始二进制缓冲区
- `TypedArray` - 类型化数组（Uint8Array、Int32Array 等）
- `Blob` - 文件数据（支持异步序列化）

#### 特殊处理
- **循环引用**：自动检测并处理
- **深层嵌套**：支持任意深度（默认限制 20 层）
- **函数和 Symbol**：优雅降级为 null
- **性能优化**：智能检测，只对需要类型保持的数据使用 TypedJSON

### PotoServer

- `constructor(config: PotoServerConfig)` - 创建服务器实例
- `addModule(module: PotoModule)` - 注册业务模块
- `setUserProvider(provider: UserProvider)` - 设置用户管理
- `setSessionProvider(provider: UserSessionProvider)` - 设置会话管理
- `run()` - 启动服务器
- `handleLogin(credentials: LoginCredentials)` - 处理用户登录
- `handleRegisterAsVisitor()` - 处理访客注册
- `authenticateToken(authHeader: string)` - 验证 JWT 令牌

### PotoClient

- `constructor(baseUrl: string, storage?: Storage)` - 创建客户端实例
- `getProxy<T>(modulePrefix: string): T` - 获取类型安全模块代理
- `login(credentials: LoginCredentials)` - 用户身份验证
- `loginAsVisitor()` - 匿名访客登录
- `subscribeSSE(messagingClient: MessagingClient)` - 订阅实时更新
- `setAuthToken(token: string)` - 设置认证令牌
- `publishMessage(sseMessage: SseMessage)` - 发布消息
- `unsubscribe()` - 取消订阅

### PotoModule

- `getRoute(): string` - 返回模块路由前缀
- `getCurrentUser(): PotoUser` - 获取当前请求用户
- `getUserSession(): Promise<UserSessionData>` - 获取用户会话
- `updateUserSession(updater: (session: UserSessionData) => void)` - 更新用户会话
- `deleteUserSession()` - 删除用户会话
- `isRequestCancelled(): boolean` - 检查请求是否已取消
- `isCancellationError(error: Error): boolean` - 检查是否为取消错误

### LLMPotoModule

- `getUserPreferredLLM(): Promise<LLM>` - 获取用户首选的 LLM 实例
- `getCurrentModel(): Promise<ModelInfo>` - 获取当前模型信息
- `getAvailableModels(): Promise<ModelInfo[]>` - 列出可用模型
- `postModel(modelName: string): Promise<boolean>` - 切换模型
- `getLLMWithConfig(model: string, apiKey: string, endPoint: string)` - 获取配置的 LLM
- `createLLMPool(count: number): Promise<LLM[]>` - 创建 LLM 池
- `withLLMRetry<T>(operation: () => Promise<T>, maxRetries?: number)` - 带重试的 LLM 操作
- `executeLLMConcurrently<T>(operations: (() => Promise<T>)[])` - 并发执行 LLM 操作

### 用户管理系统

#### UserProvider 接口

```typescript
interface UserProvider {
    findUserByUserId(userId: string): Promise<PotoUser | undefined>;
    addUser(user: PotoUser): void;
}
```

#### PotoUser 类

```typescript
class PotoUser {
    constructor(
        public id: string,
        public passwordHash: string,
        public roles: string[]
    );
    
    feedMessage: (msg: SseMessage) => void; // 消息回调
}
```

#### 会话管理系统

#### UserSessionProvider 接口

```typescript
interface UserSessionProvider {
    getSession(userId: string): Promise<UserSessionData | undefined>;
    setSession(userId: string, session: UserSessionData): Promise<void>;
    deleteSession(userId: string): Promise<void>;
    getStats(): Promise<{ activeSessions: number; userIds: string[] }>;
    setContextManager(contextManager: RequestContextManager): void;
}
```

#### UserSessionData 接口

```typescript
interface UserSessionData {
    userId: string;
    createdAt: Date;
    lastActivity: Date;
    [key: string]: any; // 自定义会话数据
}
```

#### LLMSessionData 接口（扩展会话数据）

```typescript
interface LLMSessionData extends UserSessionData {
    currentModelName: string;
}
```

### 身份验证和授权

#### 角色装饰器

```typescript
@RequireRoles(['admin']) // 需要管理员角色
@RequireRoles(['user', 'admin']) // 需要用户或管理员角色
```

#### JWT 令牌管理

```typescript
// 服务器端令牌验证
const authData = server.authenticateToken(authHeader);
const userId = authData.userId;

// 客户端令牌设置
client.setAuthToken(token);
```

### 实时消息传递

#### MessagingClient 接口

```typescript
interface MessagingClient {
    getClientId(): string;
    receiveMessage(message: SseMessage): Promise<SseMessage | undefined>;
}
```

#### SseMessage 类

```typescript
class SseMessage {
    constructor(
        public id: string,
        public senderId: string,
        public recipientId: string,
        public message: string,
        public payload: object
    );
}
```

## 🛠️ 开发

### 项目结构

```
src/
├── server/           # 服务器端组件
│   ├── PotoServer.ts # 主服务器类
│   ├── PotoModule.ts # 基础模块类
│   └── UserProvider.ts # 用户管理
├── llms/             # LLM 集成
│   ├── LLMPotoModule.ts # LLM 特定模块
│   └── llm.ts        # LLM 包装器
├── web/              # 客户端组件
│   └── rpc/
│       └── PotoClient.ts # 客户端类
└── shared/           # 共享工具
    ├── MessageClient.ts # 实时消息传递
    └── CommonTypes.ts   # 类型定义
```

### 运行测试

```bash
# 运行所有测试
bun test

# 运行特定测试文件
bun test src/server/PotoServer.test.ts
```

### 生产构建

```bash
# 构建项目
bun run build

# 启动生产服务器
bun run start
```

## 🤝 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 为新功能添加测试
5. 提交拉取请求

## 📚 文档

- [集成指南](docs/INTEGRATION.md) - 详细集成说明
- [GitHub 依赖](docs/GITHUB-DEPENDENCIES.md) - 依赖管理说明
- [详细文档](docs/) - 完整的技术文档
  - [服务器架构](docs/server/) - 服务器端文档
  - [Web/RPC 通信](docs/web/rpc/) - 前后端通信文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 LICENSE 文件了解详情。

## 🙏 致谢

- 使用 [Bun](https://bun.sh) 构建，实现快速 TypeScript 执行
- 受现代 RPC 框架和实时 Web 技术启发
- 专为无缝 LLM 集成和流式应用程序设计
