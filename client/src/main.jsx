import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import VideoPage from "./VideoPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter basename="/ltx">
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/video" element={<VideoPage />} />
    </Routes>
  </BrowserRouter>
);
