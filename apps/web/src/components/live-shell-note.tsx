export function LiveShellNote({ mode }: { mode: "live" | "fallback" }) {
  return (
    <p className="cl-live-note">
      {mode === "live"
        ? "Backend se fresh tenant data aa raha hai."
        : "Backend unavailable tha, isliye curated fallback preview render hua."}
    </p>
  );
}
