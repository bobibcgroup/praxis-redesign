import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ConceptA from "./a/ConceptA";
import "./index.css";
import { watchErrors } from "./core/monitoring";

// Errors that reach the customer go to the app's own server log; not while developing.
if (!import.meta.env.DEV) watchErrors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<ConceptA />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
