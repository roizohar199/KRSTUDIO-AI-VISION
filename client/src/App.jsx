import React, { useState } from "react";
import PromptForm from "./components/PromptForm.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const [type, setType] = useState("image");

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>KRSTUDIO AI VISION</h1>
      <p>תכתוב פרומפט ותבחר מה לייצר.</p>

      <div style={{ marginBottom: 12 }}>
        <label>
          <input
            type="radio"
            value="image"
            checked={type === "image"}
            onChange={() => setType("image")}
          />
          {" "}תמונה
        </label>
        {"  "}
        <label>
          <input
            type="radio"
            value="video"
            checked={type === "video"}
            onChange={() => setType("video")}
          />
          {" "}וידאו 5–8 שניות
        </label>
      </div>

      <PromptForm type={type} onResult={setResult} />

      {result && type === "image" && (
        <div style={{ marginTop: 20 }}>
          <h3>תוצאה (תמונה):</h3>
          <img src={result} alt="AI result" style={{ maxWidth: "100%", border: "1px solid #ccc" }} />
        </div>
      )}

      {result && type === "video" && (
        <div style={{ marginTop: 20 }}>
          <h3>תוצאה (וידאו):</h3>
          <video src={result} controls style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
}
