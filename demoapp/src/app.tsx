import React from "react";
import { Constants } from "./demoConsts";

export function App() {
    return <div className="container">
        <h1>🚀 Poto Demo Server</h1>

        <div className="info">
            <h3>Server Information</h3>
            <p><strong>Status:</strong> Running</p>
            <p><strong>Port:</strong> {Constants.port}</p>
            <p><strong>URL:</strong> <a href={`http://localhost:${Constants.port}`}>http://localhost:{Constants.port}</a></p>
        </div>

        <div className="demo-users">
            <h3>Demo Users</h3>
            <p><strong>Username:</strong> demo | <strong>Password:</strong> demo123</p>
            <p><strong>Username:</strong> admin | <strong>Password:</strong> admin123</p>
        </div>

        <p>This is a dummy HTML page served by the Poto Demo Server. The server is configured to serve this page at the root path.</p>
    </div>
}
