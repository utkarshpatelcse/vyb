const skeletonRows = Array.from({ length: 5 }, (_, index) => index);
const skeletonBubbles = Array.from({ length: 4 }, (_, index) => index);

export default function MessagesLoading() {
  return (
    <main className="spm spm-loading-shell" aria-busy="true" aria-live="polite">
      <aside className="spm-nav spm-loading-nav" aria-hidden="true">
        <div className="spm-loading-logo" />
        <div className="spm-loading-nav-lines">
          <span />
          <span />
          <span />
        </div>
      </aside>

      <section className="spm-list-pane spm-loading-list" aria-hidden="true">
        <div className="spm-loading-tabs">
          <span />
          <span />
        </div>
        <div className="spm-loading-search" />
        <div className="spm-loading-conversations">
          {skeletonRows.map((row) => (
            <div className="spm-loading-conversation" key={row}>
              <span className="spm-loading-avatar" />
              <span className="spm-loading-copy">
                <span />
                <span />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="spm-chat-pane spm-loading-chat" aria-label="Opening messages">
        <header className="spm-chat-header">
          <div className="spm-chat-peer">
            <span className="spm-loading-avatar" />
            <span className="spm-loading-copy">
              <span />
              <span />
            </span>
          </div>
        </header>
        <div className="spm-chat-thread spm-loading-thread">
          {skeletonBubbles.map((bubble) => (
            <span
              className={`spm-loading-bubble${bubble % 2 === 0 ? " spm-loading-bubble-self" : ""}`}
              key={bubble}
            />
          ))}
        </div>
        <div className="spm-loading-composer" />
      </section>
    </main>
  );
}
