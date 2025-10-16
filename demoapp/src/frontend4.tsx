import "./styles.css";
import { createRoot } from "react-dom/client";
import { PotoClient } from 'poto';
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeReactiveState } from "./ReactiveState";
import { MyApp4 } from "./MyApp4";


// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");

// Hot module reloading support - persist root across updates
let root: ReturnType<typeof createRoot>;
if (import.meta.hot?.data.root) {
    root = import.meta.hot.data.root;
} else {
    root = createRoot(rootEl!);
    if (import.meta.hot) {
        import.meta.hot.data.root = root;
    }
}

root.render(<MyApp4 />);
console.log("now rendering MyApp4 with Proxy-based Reactive State");

// Accept hot updates and re-render
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        console.log("🔥 Hot module reloading for MyApp4");
        root.render(<MyApp4 />);
    });
}
