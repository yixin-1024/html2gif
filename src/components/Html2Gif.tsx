"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import html2canvas from "html2canvas";
import GIF from "gif.js";

const DEFAULT_HTML = `<div class="container">
  <div class="box"></div>
</div>

<style>
  body {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #1a1a2e;
  }
  .container {
    perspective: 800px;
  }
  .box {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 16px;
    animation: spin 2s ease-in-out infinite;
  }
  @keyframes spin {
    0% { transform: rotateY(0deg) scale(1); }
    50% { transform: rotateY(180deg) scale(1.2); }
    100% { transform: rotateY(360deg) scale(1); }
  }
</style>`;

type Status = "idle" | "capturing" | "encoding" | "done";

export default function Html2Gif() {
  const renderRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(DEFAULT_HTML);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifSize, setGifSize] = useState<number>(0);

  // Settings
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(400);
  const [fps, setFps] = useState(15);
  const [duration, setDuration] = useState(2);
  const [quality, setQuality] = useState(10);

  // Clean up old blob URLs
  useEffect(() => {
    return () => {
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, [gifUrl]);

  const captureGif = useCallback(async () => {
    setStatus("capturing");
    setProgress(0);
    if (gifUrl) {
      URL.revokeObjectURL(gifUrl);
      setGifUrl(null);
    }

    // Create an offscreen render container
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;overflow:hidden;z-index:-1;`;
    document.body.appendChild(container);

    // Inject HTML content via shadow DOM to isolate styles
    const shadow = container.attachShadow({ mode: "open" });
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `width:${width}px;height:${height}px;overflow:hidden;`;
    wrapper.innerHTML = code;

    // Move <style> tags into shadow DOM properly
    shadow.appendChild(wrapper);

    // Wait for styles/animations to kick in
    await new Promise((r) => setTimeout(r, 200));

    const totalFrames = Math.round(fps * duration);
    const frameDelay = 1000 / fps;

    const gif = new GIF({
      workers: 2,
      quality,
      width,
      height,
      workerScript: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/gif.worker.js`,
    });

    // Capture frames
    for (let i = 0; i < totalFrames; i++) {
      try {
        const canvas = await html2canvas(wrapper, {
          width,
          height,
          scale: 1,
          useCORS: true,
          backgroundColor: null,
          logging: false,
        });
        gif.addFrame(canvas, { delay: frameDelay, copy: true });
        setProgress(Math.round(((i + 1) / totalFrames) * 50));
      } catch (e) {
        console.error("Frame capture error:", e);
      }
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    // Clean up offscreen container
    document.body.removeChild(container);

    setStatus("encoding");

    gif.on("progress", (p: number) => {
      setProgress(50 + Math.round(p * 50));
    });

    gif.on("finished", (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      setGifUrl(url);
      setGifSize(blob.size);
      setStatus("done");
      setProgress(100);
    });

    gif.render();
  }, [code, width, height, fps, duration, quality, gifUrl]);

  const downloadGif = () => {
    if (!gifUrl) return;
    const a = document.createElement("a");
    a.href = gifUrl;
    a.download = `html2gif-${Date.now()}.gif`;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Editor */}
      <div className="flex flex-col gap-4">
        <div className="rounded-lg overflow-hidden border border-gray-800 h-[500px]">
          <Editor
            height="100%"
            defaultLanguage="html"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12 },
            }}
          />
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Width</span>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Height</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">FPS</span>
            <input
              type="number"
              value={fps}
              min={1}
              max={30}
              onChange={(e) => setFps(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Duration (s)</span>
            <input
              type="number"
              value={duration}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Quality (1-30)</span>
            <input
              type="number"
              value={quality}
              min={1}
              max={30}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white"
            />
          </label>
        </div>

        {/* Generate Button */}
        <button
          onClick={captureGif}
          disabled={status === "capturing" || status === "encoding"}
          className="w-full py-2.5 rounded-lg font-medium text-sm transition
            bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "capturing"
            ? `Capturing frames... ${progress}%`
            : status === "encoding"
              ? `Encoding GIF... ${progress}%`
              : "Generate GIF"}
        </button>

        {/* Progress bar */}
        {(status === "capturing" || status === "encoding") && (
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Right: Preview + Result */}
      <div className="flex flex-col gap-4">
        {/* Live Preview */}
        <div className="rounded-lg overflow-hidden border border-gray-800">
          <div className="px-3 py-1.5 bg-gray-900 text-xs text-gray-400 border-b border-gray-800">
            Live Preview
          </div>
          <iframe
            srcDoc={code}
            style={{ width, height }}
            className="max-w-full bg-white"
            sandbox="allow-scripts"
          />
        </div>

        {/* Hidden render target */}
        <div ref={renderRef} style={{ display: "none" }} />

        {/* GIF Result */}
        {gifUrl && (
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <div className="px-3 py-1.5 bg-gray-900 text-xs text-gray-400 border-b border-gray-800 flex justify-between items-center">
              <span>Generated GIF</span>
              <span>{formatSize(gifSize)}</span>
            </div>
            <div className="p-4 flex flex-col items-center gap-3 bg-gray-900/50">
              <img
                src={gifUrl}
                alt="Generated GIF"
                className="max-w-full rounded border border-gray-700"
              />
              <button
                onClick={downloadGif}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition"
              >
                Download GIF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
