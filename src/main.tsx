import { render } from "preact";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/home.css";
import "./styles/calendar.css";
import "./styles/profile.css";
import { Shell } from "./app/Shell";
import { startData } from "./store/data";
import { getTheme, setTheme } from "./ui/theme";

setTheme(getTheme());

startData();

render(<Shell />, document.getElementById("app")!);
