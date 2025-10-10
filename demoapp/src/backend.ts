import indexhtml from "../public/index.html";
import { serve } from "bun";

serve({
    port: 4001,
    routes: {
        "/": indexhtml,
    },

    development: {
        // Enable Hot Module Reloading
        hmr: false,

        // Echo console logs from the browser to the terminal
        console: true,
    },

    async fetch(req) {
        // ...api requests
        return new Response("hello world");
    },
});

console.log("🚀 Starting Poto Demo Server...");
console.log("📡 Server will be available at: http://localhost:4001");
