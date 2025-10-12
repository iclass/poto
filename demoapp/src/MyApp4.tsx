import "./styles.css";
import { ReactiveComponent } from "./ReactiveState";

// Clean TypeScript class - just declare properties!
export class MyApp4 extends ReactiveComponent {
    // Plain class properties - automatically reactive!
    count = 0;
    message = 'Hello from class component!';
    loading = false;

    constructor(props: {}) {
        super(props);
    }

    // Methods work normally - just assign to properties
    increment = () => {
        this.count++; // Auto re-renders!
    };

    updateMessage = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.message = e.target.value; // Auto re-renders!
    };

    toggleLoading = () => {
        this.loading = !this.loading; // Auto re-renders!
    };

    render = () => (
        <div className="container">
            <h1>🚀🚀 Clean TypeScript Class Component!</h1>

            <div className="demo-section">
                <h3>Counter</h3>
                <p>Count: {this.count}</p>
                <button onClick={this.increment}>
                    Increment
                </button>
            </div>

            <div className="demo-section">
                <h3>Message</h3>
                <input
                    type="text"
                    value={this.message}
                    onChange={this.updateMessage}
                    placeholder="Type something..."
                />
                <p>Current message: {this.message}</p>
            </div>

            <div className="demo-section">
                <h3>Loading State</h3>
                <button onClick={this.toggleLoading}>
                    Toggle Loading
                </button>
                {this.loading && <p>⏳ Loading...</p>}
            </div>

            <div className="info">
                <h3>✅ Pure TypeScript Syntax:</h3>
                <ul>
                    <li>Just plain class properties: count = 0</li>
                    <li>Direct assignments: this.count++</li>
                    <li>No setState, no hooks, no makeState</li>
                    <li>Automatic UI updates via ReactiveComponent</li>
                </ul>
            </div>
        </div>
    );

}

