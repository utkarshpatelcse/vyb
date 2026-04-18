export function LiveShellNote({ mode }: { mode: "live" | "fallback" }) {
  return (
    <p className="cl-live-note">
      {mode === "live"
        ? "Gateway se fresh tenant data aa raha hai."
        : "Gateway unavailable tha, isliye curated fallback preview render hua."}
    </p>
  );
}

