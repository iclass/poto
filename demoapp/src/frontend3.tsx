import "./styles.css";
import { createRoot } from "react-dom/client";
import { Constants } from "./demoConsts";
import { MyApp3 } from "./MyApp3";


// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");
const root = createRoot(rootEl!);
root.render(<MyApp3 host={`http://localhost`} port={Constants.port} />);
console.log("now rendering MyApp3 with Proxy-based Reactive State");


// this is not really needed for this example, but it's here for reference
if (import.meta.hot) {
    console.log("hot module reloading for MyApp3");
    // With hot module reloading, `import.meta.hot.data` is persisted.
    import.meta.hot.data.root ??= root;
} 



