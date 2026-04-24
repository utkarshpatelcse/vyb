import sys

with open('s:/vyb-main/apps/web/app/styles/messages.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_css = """/* ─── Pane 3: Active Chat Area ──────────────────────────────── */
.spm-chat-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #000;
  position: relative;
  overflow: hidden;
}

/* Chat idle / placeholder */
.spm-chat-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  text-align: center;
  padding: 2rem;
  background: radial-gradient(circle at center, rgba(124, 58, 237, 0.08) 0%, transparent 60%);
}

.spm-chat-idle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.05);
  border: 1px solid rgba(124, 58, 237, 0.15);
  color: rgba(124, 58, 237, 0.6);
  margin-bottom: 0.5rem;
  box-shadow: 0 0 60px rgba(124, 58, 237, 0.1);
  backdrop-filter: blur(10px);
}

.spm-chat-idle-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
}

.spm-chat-idle-sub {
  margin: 0;
  max-width: 32ch;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
}

.spm-chat-idle-e2ee {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.8rem;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.2);
  color: rgba(167, 139, 250, 0.9);
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.15);
}

.spm-conv-item-active {
  background: rgba(124, 58, 237, 0.15) !important;
  border-color: rgba(167, 139, 250, 0.4) !important;
  box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.15), 0 4px 15px rgba(0,0,0,0.1);
}

.spm-chat-pane {
  justify-content: center;
  padding: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E"), linear-gradient(180deg, #090b14 0%, #030408 100%);
}

.spm-chat-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
  position: relative;
}

.spm-chat-header {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1rem 1.5rem;
  background: rgba(10, 12, 20, 0.75);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}

.spm-chat-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.spm-chat-back:hover {
  transform: translateX(-2px);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.spm-chat-peer {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.spm-chat-peer-copy {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.spm-chat-peer-copy strong {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-chat-peer-copy span {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-chat-peer-skeleton {
  min-height: 2.75rem;
}

.spm-chat-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.spm-chat-ttl-pill,
.spm-chat-header-trigger {
  min-height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 1rem;
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.1);
  color: #c4b5fd;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
  box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.05);
}

.spm-chat-header-trigger {
  min-width: 2.2rem;
  padding: 0;
  cursor: pointer;
}

.spm-chat-header-trigger:hover,
.spm-chat-ttl-pill:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
  color: #fff;
  transform: translateY(-1px);
}

.spm-chat-live-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6rem;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition: all 0.2s ease;
}

.spm-chat-live-pill-live {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
}

.spm-chat-live-pill-offline {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.spm-chat-live-pill-reconnecting,
.spm-chat-live-pill-connecting {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
}

.spm-chat-lock-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.25);
  color: #c4b5fd;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.spm-chat-state {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
}

.spm-chat-state strong {
  color: #fff;
  font-size: 1.05rem;
}

.spm-chat-state span {
  max-width: 28rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.88rem;
  line-height: 1.6;
}

.spm-chat-state-error strong {
  color: #f87171;
}

.spm-chat-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.spm-chat-retry:hover {
  transform: translateY(-2px);
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
}

.spm-chat-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
}

.spm-chat-thread::-webkit-scrollbar {
  width: 5px;
}

.spm-chat-thread::-webkit-scrollbar-track {
  background: transparent;
}

.spm-chat-thread::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.4);
  border-radius: 999px;
}

.spm-chat-day-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0;
}

.spm-chat-day-divider span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.spm-chat-message-row {
  display: flex;
  align-items: flex-end;
  gap: 0.8rem;
  position: relative;
}

.spm-chat-message-row-self {
  justify-content: flex-end;
}

.spm-chat-message-trigger {
  flex-shrink: 0;
  width: 2.2rem;
  height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  transform: scale(0.9);
}

.spm-chat-message-row:hover .spm-chat-message-trigger {
  opacity: 1;
  transform: scale(1);
}

.spm-chat-message-trigger:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
}

.spm-chat-message-trigger-self {
  order: -1;
}

.spm-chat-mini-avatar {
  width: 2.2rem;
  height: 2.2rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6, #0ea5e9);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.spm-chat-mini-avatar-self {
  background: linear-gradient(135deg, #8b5cf6, #d946ef);
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.spm-chat-bubble {
  max-width: min(75%, 40rem);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  position: relative;
  padding: 1rem 1.2rem;
  border-radius: 1.5rem 1.5rem 1.5rem 0.5rem;
  background: rgba(30, 41, 59, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
}

.spm-chat-bubble-swipe-active {
  transition: none;
}

.spm-chat-bubble-self {
  border-radius: 1.5rem 1.5rem 0.5rem 1.5rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9));
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.2);
}

.spm-chat-bubble-system {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  align-self: center;
  margin: 0.5rem 0;
}

.spm-chat-swipe-reply-cue {
  position: absolute;
  top: 50%;
  left: -2.5rem;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  color: #fff;
  opacity: 0;
  transform: translateY(-50%) scale(0.8);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.spm-chat-swipe-reply-cue-self {
  right: -2.5rem;
  left: auto;
}

.spm-chat-swipe-reply-cue.is-visible {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.spm-chat-reply-preview {
  display: grid;
  gap: 0.2rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.8rem;
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid #fff;
}

.spm-chat-bubble-self .spm-chat-reply-preview {
  background: rgba(255, 255, 255, 0.15);
  border-left-color: #fff;
}

.spm-chat-reply-preview strong {
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.spm-chat-reply-preview span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spm-chat-attachment {
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.spm-chat-attachment img {
  display: block;
  width: 100%;
  max-height: 20rem;
  object-fit: cover;
}

.spm-chat-message-text {
  margin: 0;
  color: #fff;
  font-size: 0.98rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.spm-chat-message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.2rem;
}

.spm-chat-bubble-self .spm-chat-message-meta {
  color: rgba(255, 255, 255, 0.8);
}

.spm-chat-receipt {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: inherit;
}

.spm-chat-receipt.is-seen {
  color: #34d399;
}
.spm-chat-bubble-self .spm-chat-receipt.is-seen {
  color: #fff;
  filter: drop-shadow(0 0 2px rgba(255,255,255,0.5));
}


.spm-chat-expiry-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #fbbf24;
}

.spm-chat-bubble-self .spm-chat-expiry-pill {
  color: rgba(255,255,255,0.9);
}

.spm-chat-flag-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.4rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.spm-chat-reaction-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: #fff;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.spm-chat-action-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: block;
  padding: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.spm-chat-action-sheet {
  position: fixed;
  width: min(100%, 32rem);
  max-height: min(85dvh, 40rem);
  display: grid;
  align-content: start;
  gap: 1.2rem;
  padding: 1.5rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
  overflow-y: auto;
  animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes slideUp {
  from { transform: translate(-50%, 100%); }
  to { transform: translate(-50%, 0); }
}

.spm-chat-action-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.spm-chat-action-head strong {
  font-size: 1.1rem;
  color: #fff;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.spm-chat-action-close {
  width: 2.2rem;
  height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.spm-chat-action-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  transform: scale(1.05);
}

.spm-chat-action-preview {
  padding: 1.2rem;
  border-radius: 1.2rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
}

.spm-chat-action-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
  padding: 0.5rem 0;
}

.spm-chat-action-emoji {
  width: 3.2rem;
  height: 3.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  font-size: 1.4rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.spm-chat-action-emoji:hover {
  transform: scale(1.15) translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.spm-chat-action-list {
  display: grid;
  gap: 0.8rem;
}

.spm-chat-action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 3.2rem;
  padding: 0 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.spm-chat-action-button:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.spm-chat-action-button-danger {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.spm-chat-action-button-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.spm-chat-action-select {
  display: grid;
  gap: 0.6rem;
  padding: 1rem 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
}

.spm-chat-action-select select {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  padding: 0.8rem 1rem;
  font: inherit;
  font-size: 0.95rem;
  cursor: pointer;
}

.spm-chat-action-select select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
}

.spm-chat-action-error {
  margin: 0;
  color: #f87171;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 0.5rem;
}

.spm-chat-action-note {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: center;
}

.spm-chat-settings-sheet {
  width: min(100%, 36rem);
}

.spm-chat-settings-summary {
  display: grid;
  gap: 0.5rem;
  padding: 1.2rem;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 1.2rem;
  background: rgba(139, 92, 246, 0.1);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
}

.spm-chat-settings-summary strong {
  color: #fff;
  font-size: 1rem;
}

.spm-chat-settings-summary span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.88rem;
  line-height: 1.6;
}

.spm-chat-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.spm-chat-settings-option {
  display: grid;
  gap: 0.4rem;
  padding: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.spm-chat-settings-option:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.spm-chat-settings-option.is-active {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.2);
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
}

.spm-chat-settings-option strong {
  font-size: 0.95rem;
}

.spm-chat-settings-option span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
  line-height: 1.5;
}

.spm-chat-settings-note {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 1rem 1.2rem;
  border-radius: 1.2rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  line-height: 1.5;
}

.spm-chat-settings-note b {
  color: #fff;
}

.spm-chat-empty {
  flex: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  padding: 3rem 1.5rem;
}

.spm-chat-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.1);
  color: #c4b5fd;
  border: 1px solid rgba(139, 92, 246, 0.2);
  box-shadow: 0 0 30px rgba(139, 92, 246, 0.1);
}

.spm-chat-empty strong {
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
}

.spm-chat-empty span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  max-width: 20rem;
  line-height: 1.5;
}

.spm-chat-composer {
  padding: 1rem 1.5rem 1.5rem;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.spm-chat-compose-error {
  margin: 0 0 0.8rem;
  color: #f87171;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.6rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.spm-chat-compose-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 0.8rem;
  color: #fbbf24;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.1);
  padding: 0.6rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.spm-chat-compose-note span {
  line-height: 1.5;
}

.spm-chat-compose-note-dismiss {
  border: 1px solid rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  color: #fbbf24;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.spm-chat-compose-note-dismiss:hover {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}

.spm-chat-compose-share {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 1rem;
  border-radius: 1.2rem;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.spm-chat-compose-share-media,
.spm-chat-compose-share-badge {
  width: 4rem;
  height: 4rem;
  flex-shrink: 0;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.spm-chat-compose-share-media img,
.spm-chat-compose-share-media video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spm-chat-compose-share-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.2);
  color: #c4b5fd;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.spm-chat-compose-share-copy {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  flex: 1;
}

.spm-chat-compose-share-copy strong {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
}

.spm-chat-compose-share-copy span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.8rem;
}

.spm-chat-compose-share-copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  line-height: 1.5;
}

.spm-chat-compose-reply {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  border-left: 4px solid #8b5cf6;
  border-top: 1px solid rgba(255,255,255,0.05);
  border-right: 1px solid rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.spm-chat-compose-reply-copy {
  display: grid;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.spm-chat-compose-reply-copy strong {
  color: #c4b5fd;
  font-size: 0.85rem;
  font-weight: 700;
}

.spm-chat-compose-reply-copy span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spm-chat-compose-reply-clear {
  flex-shrink: 0;
  width: 2.2rem;
  height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.spm-chat-compose-reply-clear:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.spm-chat-compose-form {
  display: flex;
  align-items: flex-end;
  gap: 0.8rem;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 0.5rem;
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}

.spm-chat-compose-avatar {
  display: none;
}

.spm-chat-share-trigger {
  flex-shrink: 0;
  width: 2.8rem;
  height: 2.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.1rem;
  margin-left: 0.1rem;
}

.spm-chat-share-trigger:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #c4b5fd;
  transform: rotate(90deg);
}

.spm-chat-compose-box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
}

.spm-chat-compose-box textarea {
  width: 100%;
  min-height: 1.5rem;
  max-height: 8rem;
  resize: none;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  padding: 0.65rem 0;
}

.spm-chat-compose-box textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.spm-chat-send {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  margin-bottom: 0.1rem;
  margin-right: 0.1rem;
}

.spm-chat-send-active {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
}

.spm-chat-send-active:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
}

/* Share menu (added purely for aesthetics) */
.spm-chat-share-menu {
  position: absolute;
  bottom: 100%;
  left: 1.5rem;
  width: min(calc(100% - 3rem), 24rem);
  margin-bottom: 1rem;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
  padding: 1.2rem;
  z-index: 20;
  animation: scaleUp 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: bottom left;
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.spm-chat-share-menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.spm-chat-share-menu-head strong { color: #fff; font-size: 1.05rem; }

.spm-chat-share-menu-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  background: rgba(0,0,0,0.2);
  padding: 0.3rem;
  border-radius: 999px;
}
.spm-chat-share-menu-tab {
  flex: 1;
  padding: 0.4rem;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.spm-chat-share-menu-tab.is-active {
  background: rgba(255,255,255,0.1);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.spm-chat-share-menu-list {
  display: grid;
  gap: 0.6rem;
  max-height: 15rem;
  overflow-y: auto;
}
.spm-chat-share-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem;
  border-radius: 1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}
.spm-chat-share-item:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.1);
}
.spm-chat-share-item-thumb {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.6rem;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
}
.spm-chat-share-item-copy {
  display: grid;
  gap: 0.1rem;
}
.spm-chat-share-item-copy strong { color: #fff; font-size: 0.9rem; }
.spm-chat-share-item-copy span { color: rgba(255,255,255,0.5); font-size: 0.75rem; }

/* ─── Responsive: Mobile ────────────────────────────────────── */
@media (max-width: 767px) {
  .spm-shell {
    flex-direction: column;
  }

  .spm-nav {
    width: 100%;
    height: auto;
    flex-direction: row;
    padding: 0.6rem 1rem;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .spm-nav-brand {
    margin-bottom: 0;
    margin-right: auto;
  }

  .spm-nav-items {
    flex-direction: row;
    gap: 0.2rem;
    flex: none;
  }

  .spm-nav-viewer {
    margin-top: 0;
    margin-left: 0.5rem;
  }

  .spm-list-pane {
    width: 100%;
    height: auto;
    flex: 1;
    min-height: 0;
    border-right: none;
    overflow: visible;
  }

  .spm-conv-list {
    max-height: calc(100dvh - 13rem);
  }

  .spm-chat-pane {
    display: none;
  }

  .spm-shell-chat-open {
    height: calc(100dvh - 56px);
  }

  .spm-shell-chat-open .spm-list-pane {
    display: none;
  }

  .spm-shell-chat-open .spm-chat-pane {
    display: flex;
    height: 100%;
    padding: 0;
  }

  .spm-chat-card {
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  .spm-chat-header {
    padding: 0.8rem 1rem;
  }

  .spm-chat-lock-pill {
    padding: 0.4rem 0.7rem;
  }

  .spm-chat-thread {
    padding: 1rem 1.2rem;
  }

  .spm-chat-bubble {
    max-width: 85%;
  }

  .spm-chat-action-backdrop {
    padding: 0;
  }

  .spm-chat-action-sheet {
    max-height: min(80dvh, 40rem);
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
    border-radius: 2rem 2rem 0 0;
    border-bottom: none;
    bottom: 0;
    transform: translateX(-50%);
  }

  .spm-chat-composer {
    padding: 0.8rem 1rem 1rem;
  }

  .spm-chat-compose-form {
    border-radius: 1.5rem;
  }
}
"""
lines[824:1982] = new_css.splitlines(True)

with open('s:/vyb-main/apps/web/app/styles/messages.css', 'w', encoding='utf-8') as f:
    f.writelines(lines)
