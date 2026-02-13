import "./style.css";
import { bootstrapApp } from "./app/controller";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  bootstrapApp(root);
}
