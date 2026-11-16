"use client";

import React, { useState } from "react";
import { PRESET_BANNERS } from "@/lib/form-types";
import {
  PixelCheckIcon,
  PixelImageIcon,
  PixelSearchIcon,
  PixelUploadIcon,
} from "./PixelIcons";

interface MediaPickerModalProps {
  title: string;
  currentUrl?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

interface WikiSearchResult {
  id: number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file."));
      img.onload = () => {
        const maxWidth = 1280;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        resolve(compressed);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function MediaPickerModal({
  title,
  currentUrl = "",
  onSelect,
  onClose,
}: MediaPickerModalProps) {
  const [tab, setTab] = useState<"presets" | "search" | "upload">("presets");
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [searchQuery, setSearchQuery] = useState("office workspace");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WikiSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSearchPhotos(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const endpoint =
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
        `&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=12` +
        `&prop=imageinfo&iiprop=url|mime&iiurlwidth=640&format=json&origin=*`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Image search service temporarily unavailable.");
      const json = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: { url: string; thumburl?: string; mime?: string }[];
            }
          >;
        };
      };
      const pages = Object.values(json.query?.pages ?? {});
      const items: WikiSearchResult[] = [];
      for (const p of pages) {
        const info = p.imageinfo?.[0];
        if (!info?.url) continue;
        if (info.mime && !info.mime.startsWith("image/")) continue;
        if (info.url.toLowerCase().endsWith(".tif") || info.url.toLowerCase().endsWith(".tiff")) {
          continue;
        }
        items.push({
          id: p.pageid,
          title: p.title.replace(/^File:/, "").replace(/\.[^.]+$/, ""),
          thumbUrl: info.thumburl || info.url,
          fullUrl: info.thumburl || info.url,
        });
      }
      setSearchResults(items);
      if (items.length === 0) {
        setSearchError("No matching images found. Try broader keywords (e.g. trophy, meeting, desk).");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed to search images.");
    } finally {
      setSearching(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onSelect(dataUrl);
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to process image.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div
      className="pixel-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pixel-modal-card">
        <div className="pixel-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <PixelImageIcon size={18} />
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          </div>
          <button
            type="button"
            className="pixel-paper-btn compact"
            onClick={onClose}
          >
            &times; Close
          </button>
        </div>

        <div className="gf-nav-tabs" style={{ alignSelf: "flex-start" }}>
          <button
            type="button"
            className={`gf-tab-btn ${tab === "presets" ? "active" : ""}`}
            onClick={() => setTab("presets")}
          >
            <PixelImageIcon size={14} />
            <span>Papercraft Presets</span>
          </button>
          <button
            type="button"
            className={`gf-tab-btn ${tab === "search" ? "active" : ""}`}
            onClick={() => {
              setTab("search");
              if (searchResults.length === 0) void handleSearchPhotos();
            }}
          >
            <PixelSearchIcon size={14} />
            <span>Search Photos</span>
          </button>
          <button
            type="button"
            className={`gf-tab-btn ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            <PixelUploadIcon size={14} />
            <span>Upload / Image URL</span>
          </button>
        </div>

        {tab === "presets" && (
          <div className="pixel-media-grid">
            {PRESET_BANNERS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`pixel-media-tile ${currentUrl === preset.url ? "active" : ""}`}
                onClick={() => {
                  onSelect(preset.url);
                  onClose();
                }}
              >
                <div className="pixel-media-thumb-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preset.url} alt={preset.name} className="pixel-media-thumb" />
                </div>
                <div className="pixel-media-meta">
                  <strong>{preset.name}</strong>
                  <span>{preset.tag}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === "search" && (
          <div className="stack" style={{ gap: "0.85rem" }}>
            <form onSubmit={handleSearchPhotos} className="row-actions" style={{ gap: "0.5rem" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search free photos (e.g. trophy, teamwork, stage, minimal)..."
                style={{ flex: 1 }}
              />
              <button type="submit" className="pixel-paper-btn primary" disabled={searching}>
                <PixelSearchIcon size={14} />
                <span>{searching ? "Searching..." : "Search"}</span>
              </button>
            </form>

            {searchError && <p className="notice">{searchError}</p>}

            <div className="pixel-media-grid">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="pixel-media-tile"
                  onClick={() => {
                    onSelect(item.fullUrl);
                    onClose();
                  }}
                >
                  <div className="pixel-media-thumb-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumbUrl} alt={item.title} className="pixel-media-thumb" />
                  </div>
                  <div className="pixel-media-meta">
                    <strong>{item.title}</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "upload" && (
          <div className="stack" style={{ gap: "1rem" }}>
            <div className="gf-file-upload-mock">
              <PixelUploadIcon size={24} />
              <strong>Upload Photo from Device</strong>
              <span className="gf-file-sub">
                Automatically optimized for fast loading inside forms and mobile preview.
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadBusy}
                onChange={handleFileUpload}
                style={{ marginTop: "0.5rem", maxWidth: "260px" }}
              />
              {uploadError && <p className="alert alert-error">{uploadError}</p>}
            </div>

            <div className="field">
              <label htmlFor="media-url-input">Or Paste Direct Image URL</label>
              <div className="row-actions" style={{ gap: "0.5rem" }}>
                <input
                  id="media-url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="pixel-paper-btn primary"
                  disabled={!urlInput.trim()}
                  onClick={() => {
                    onSelect(urlInput.trim());
                    onClose();
                  }}
                >
                  <PixelCheckIcon size={14} />
                  <span>Use URL</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
