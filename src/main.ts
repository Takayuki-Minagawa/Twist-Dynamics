import "./style.css";
import { bootstrapApp } from "./app/controller";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  const dispose = bootstrapApp(root);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}
