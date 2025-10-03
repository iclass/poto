# Login System for Generic Chat CLI

This document describes the login system implemented for the Generic Chat CLI.

## Features

- **Authentication Required**: The system requires explicit user authentication - no visitor mode
- **Automatic Credential Loading**: The client automatically tries to load stored credentials on startup
- **Persistent Storage**: Credentials are stored in an encrypted file (`.credentials.json`) in the `genericChatCli` folder
- **Manual Login/Logout**: Users can manually login or logout using commands

## Usage

### Automatic Login
When you start the chat client, it will:
1. Look for stored credentials in `.credentials.json`
2. If found, attempt to authenticate with the server
3. If authentication succeeds, you'll be logged in automatically
4. If authentication fails, you'll be prompted to login manually

### First Time Setup
On first startup (no stored credentials), the system will:
1. Display a welcome message
2. Automatically prompt for login credentials
3. Save credentials for future use
4. Continue with normal chat functionality

### Manual Login
Use the `login` command to authenticate with User ID and password:
```
> login
Enter your User ID: your_user_id
Enter your Password: your_password
```

### Manual Logout
Use the `logout` command to clear stored credentials:
```
> logout
```

## Commands

- `login` - Login with User ID and password
- `logout` - Logout and clear stored credentials
- `help` - Show all available commands

## Security Notes

### Current Implementation (Demo)
- Passwords are encrypted using AES-256-CBC with a fixed key
- This is suitable for demo purposes only
- **Do not use in production without proper security measures**

### Production Recommendations
For production use, implement:
- Strong password hashing (bcrypt, scrypt, or Argon2)
- Secure key management
- Session tokens with expiration
- HTTPS for all communications
- Input validation and sanitization
- Rate limiting for login attempts

## File Structure

```
genericChatCli/
├── .credentials.json          # Encrypted credential storage (auto-created)
├── client/
│   ├── ChatClient.ts          # Main client with login functionality
│   ├── CredentialManager.ts   # Credential storage and encryption
│   └── ...
├── server/
│   └── ChatServerModule.ts    # Server module (uses existing PotoServer auth)
└── shared/
    └── types.ts              # Shared type definitions
```

## Credential File Format

The `.credentials.json` file contains:
```json
{
  "username": "encrypted_user_id",
  "password": "encrypted_password", 
  "serverUrl": "http://localhost:3799",
  "lastLogin": "2025-09-30T03:46:09.956Z"
}
```

## Server Authentication

The server uses the existing PotoServer authentication system:
- Uses PotoClient's built-in `login()` method
- Server handles authentication via UserProvider
- JWT tokens are automatically managed by PotoClient

## Error Handling

- Invalid credentials: Prompts user to login manually
- Network errors: Shows error message, prompts user to login
- File system errors: Shows warning, prompts user to login

## User Interface

The prompt shows your current login status:
```
gpt-4 [streaming] [👤user_id] > 
```

Where:
- `gpt-4` - Current model
- `[streaming]` - Current mode
- `[👤user_id]` - Your logged-in User ID with user emoji
