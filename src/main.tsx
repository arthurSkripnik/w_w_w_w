import { render } from "preact";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import { Shell } from "./app/Shell";
import { startData } from "./store/data";

startData();

render(<Shell />, document.getElementById("app")!);
