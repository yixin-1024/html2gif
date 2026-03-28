"use client";

import dynamic from "next/dynamic";

const Html2Gif = dynamic(() => import("@/components/Html2Gif"), { ssr: false });

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">HTML → GIF</h1>
        <p className="text-gray-400 text-sm mt-1">
          Paste HTML/CSS, preview it, and export as GIF (supports CSS
          animations)
        </p>
      </div>
      <Html2Gif />
    </main>
  );
}
