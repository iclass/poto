import "./styles.css";
import { createRoot } from "react-dom/client";
import { PotoClient } from 'poto';
import { Constants, ServerInfo, GenData, ImageSize } from "./demoConsts";
import type { DemoModule } from "./DemoModule";
import { makeState } from "./ReactiveState";
import { MyApp4 } from "./MyApp4";


// the bundler makes sure the root is always there before this script is executed
// therefore, we can render the app immediately
const rootEl = document.getElementById("root");
const root = createRoot(rootEl!);
root.render(<MyApp4 />);
console.log("now rendering MyApp4 with Proxy-based Reactive State");

if (import.meta.hot) {
    console.log("hot module reloading for MyApp4");
    // With hot module reloading, `import.meta.hot.data` is persisted.
    import.meta.hot.data.root ??= root;
    // Persist the component instance to survive HMR
    // const app = (import.meta.hot.data.app ??= new MyApp4({}));
    // root.render(app.render());
}
