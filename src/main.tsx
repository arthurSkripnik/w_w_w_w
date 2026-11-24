import { render } from "preact";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import { Shell } from "./app/Shell";

render(<Shell />, document.getElementById("app")!);
