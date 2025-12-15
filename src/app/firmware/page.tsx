"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FirmwareVersion {
  version: string;
  size?: number;
  uploadedAt?: string;
  description?: string;
}

export default function FirmwarePage() {
  const [versions, setVersions] = useState<FirmwareVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alert, setAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showAlert = (msg: string, type: "success" | "error") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadFirmware = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, activeRes] = await Promise.all([
        fetch("/api/firmware/list"),
        fetch("/api/firmware/active"),
      ]);
      const listData = await listRes.json();
      const activeData = await activeRes.json();
      setVersions(Array.isArray(listData) ? listData : []);
      setActiveVersion(activeData?.version || null);
    } catch {
      showAlert("Failed to load firmware list", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirmware();
  }, [loadFirmware]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".bin")) {
      showAlert("Only .bin files are allowed", "error");
      return;
    }
    setSelectedFile(file);
    // Auto-fill version from filename if empty
    if (!uploadVersion) {
      const match = file.name.match(/v?(\d+\.\d+\.\d+)/i);
      if (match) setUploadVersion(match[1]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadVersion.trim()) {
      showAlert("Select a file and enter a version", "error");
      return;
    }
    setUploading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const dataBase64 = btoa(binary);

      const r = await fetch("/api/firmware/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: uploadVersion.trim(),
          dataBase64,
          description: uploadDescription.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Upload failed");
      showAlert(`Firmware ${uploadVersion} uploaded successfully!`, "success");
      setSelectedFile(null);
      setUploadVersion("");
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadFirmware();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      showAlert(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (version: string) => {
    try {
      const r = await fetch("/api/firmware/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Activate failed");
      showAlert(`Firmware ${version} is now active`, "success");
      setActiveVersion(version);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Activate failed";
      showAlert(msg, "error");
    }
  };

  const handleDelete = async (version: string) => {
    if (!confirm(`Delete firmware ${version}?`)) return;
    try {
      const r = await fetch(`/api/firmware/${encodeURIComponent(version)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Delete failed");
      showAlert(`Firmware ${version} deleted`, "success");
      loadFirmware();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      showAlert(msg, "error");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL firmware versions? This cannot be undone.")) return;
    try {
      const r = await fetch("/api/firmware/clear-all", { method: "DELETE" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Clear failed");
      showAlert("All firmware versions deleted", "success");
      loadFirmware();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Clear failed";
      showAlert(msg, "error");
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Firmware Management</h1>

      {alert && (
        <div className={`mb-4 p-3 rounded-lg ${alert.type === "error" ? "bg-red-900/50 text-red-300" : "bg-green-900/50 text-green-300"}`}>
          {alert.msg}
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Upload New Firmware</h2>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${dragOver ? "border-blue-500 bg-blue-900/20" : "border-neutral-700"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".bin"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />
          {selectedFile ? (
            <div className="text-white">
              <p className="font-semibold">{selectedFile.name}</p>
              <p className="text-neutral-400 text-sm">{formatSize(selectedFile.size)}</p>
            </div>
          ) : (
            <p className="text-neutral-400">Drag & drop a .bin file here, or click to select</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-neutral-400 mb-1">Version</label>
            <input
              type="text"
              value={uploadVersion}
              onChange={(e) => setUploadVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Bug fixes, new features..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg text-white font-semibold"
        >
          {uploading ? "Uploading…" : "Upload Firmware"}
        </button>
      </div>

      {/* Active Firmware */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Active Firmware</h2>
        {activeVersion ? (
          <div className="flex items-center gap-3">
            <span className="text-green-400 font-mono text-lg">{activeVersion}</span>
            <span className="text-neutral-500">← Devices will update to this version</span>
          </div>
        ) : (
          <p className="text-neutral-400">No active firmware set</p>
        )}
      </div>

      {/* Firmware List */}
      <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">All Versions</h2>
          <div className="flex gap-2">
            <button onClick={loadFirmware} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1 rounded text-white text-sm">
              {loading ? "Loading…" : "Refresh"}
            </button>
            {versions.length > 0 && (
              <button onClick={handleClearAll} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-white text-sm">
                Clear All
              </button>
            )}
          </div>
        </div>
        {versions.length === 0 ? (
          <p className="text-neutral-400">No firmware versions uploaded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-neutral-700">
                  <th className="py-2 px-3">Version</th>
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">Uploaded</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((fw) => (
                  <tr key={fw.version} className="border-b border-neutral-800 text-white">
                    <td className="py-2 px-3 font-mono">
                      {fw.version}
                      {fw.version === activeVersion && (
                        <span className="ml-2 text-xs bg-green-600 px-2 py-0.5 rounded">ACTIVE</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-neutral-400">{formatSize(fw.size)}</td>
                    <td className="py-2 px-3 text-neutral-400">{formatDate(fw.uploadedAt)}</td>
                    <td className="py-2 px-3 text-neutral-400">{fw.description || "-"}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        {fw.version !== activeVersion && (
                          <button
                            onClick={() => handleActivate(fw.version)}
                            className="bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-white text-sm"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(fw.version)}
                          className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-white text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

