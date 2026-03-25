"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { BANK_CUSTOM_CODE, type BankOption, getBankOptions } from "@/lib/banks";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function BankSelect({
  value,
  onChange,
  placeholder = "Chọn ngân hàng",
  disabled,
  includeCustom = true,
  className,
  style,
}: {
  value?: string;
  onChange: (nextCode: string, option?: BankOption) => void;
  placeholder?: string;
  disabled?: boolean;
  includeCustom?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => (value ? options.find((o) => o.code === value) : undefined),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => normalize(`${o.code} ${o.label}`).includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    getBankOptions()
      .then((list) => {
        if (mounted) setOptions(list);
      })
      .catch(() => {
        if (mounted) setOptions([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!open) return;
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const buttonText = selected?.label || (value ? value : "");

  return (
    <div ref={rootRef} className={className} style={style}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          if (!open) setQuery("");
        }}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all flex items-center justify-between gap-2"
        style={{
          background: disabled ? "#f8fafc" : "white",
          border: "1.5px solid #e2e8f0",
          color: disabled ? "#6b7280" : "#1a1a2e",
          fontFamily: "Lexend, sans-serif",
        }}
      >
        <span className="truncate text-left">
          {buttonText ? buttonText : <span style={{ color: "#94a3b8" }}>{placeholder}</span>}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: "#94a3b8", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          className="mt-2 rounded-2xl overflow-hidden"
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <div className="p-3 border-b" style={{ borderColor: "#f1f5f9" }}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <Search className="w-4 h-4" style={{ color: "#94a3b8" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm ngân hàng…"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: "#1a1a2e", fontFamily: "Lexend, sans-serif" }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {includeCustom && (
              <button
                type="button"
                onClick={() => {
                  onChange(BANK_CUSTOM_CODE);
                  setOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                style={{ color: "#f97316", fontWeight: 700 }}
              >
                Tự nhập ngân hàng
              </button>
            )}

            {loading ? (
              <div className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>
                Đang tải danh sách ngân hàng…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>
                Không tìm thấy ngân hàng phù hợp.
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    onChange(o.code, o);
                    setOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                  style={{
                    color: "#1a1a2e",
                    background: value === o.code ? "#fff7ed" : "transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{o.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#94a3b8" }}>
                        {o.code}
                        {o.supported ? " · supported" : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

