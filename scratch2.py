import sys

with open('s:/vyb-main/apps/web/app/styles/messages.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_css = """/* Individual conversation item */
.spm-conv-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 1.25rem;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  text-decoration: none;
  color: inherit;
}

.spm-conv-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
  transform: translateX(4px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.spm-conv-item-unread {
  background: rgba(139, 92, 246, 0.08) !important;
  border-color: rgba(139, 92, 246, 0.2) !important;
  box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.1) !important;
}

.spm-conv-item-unread:hover {
  background: rgba(139, 92, 246, 0.12) !important;
  border-color: rgba(139, 92, 246, 0.3) !important;
}

/* Market chat border glow */
.spm-conv-item-market {
  border-color: rgba(20, 184, 166, 0.2) !important;
}

.spm-conv-item-market:hover {
  border-color: rgba(20, 184, 166, 0.4) !important;
}

.spm-market-glow {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(20, 184, 166, 0.2);
  background: linear-gradient(90deg, rgba(20, 184, 166, 0.05), transparent 60%);
}

/* Avatar + Live Pulse ring */
.spm-conv-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.spm-conv-avatar {
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6, #0ea5e9);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

/* Pulse ring glow */
.spm-pulse-ring {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 4px transparent;
  transition: box-shadow 0.3s ease;
}
.spm-pulse-online {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 3.5px rgba(16, 185, 129, 0.6);
  animation: spm-pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.spm-pulse-vibing {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 3.5px rgba(139, 92, 246, 0.7);
  animation: spm-pulse-purple 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.spm-pulse-away {
  box-shadow: 0 0 0 2px #0f172a, 0 0 0 3px rgba(255, 255, 255, 0.15);
}

@keyframes spm-pulse-green {
  0%, 100% { box-shadow: 0 0 0 2px #0f172a, 0 0 0 3.5px rgba(16, 185, 129, 0.5); }
  50% { box-shadow: 0 0 0 2px #0f172a, 0 0 0 6px rgba(16, 185, 129, 0.1); }
}
@keyframes spm-pulse-purple {
  0%, 100% { box-shadow: 0 0 0 2px #0f172a, 0 0 0 3.5px rgba(139, 92, 246, 0.6); }
  50% { box-shadow: 0 0 0 2px #0f172a, 0 0 0 6px rgba(139, 92, 246, 0.15); }
}

/* Status dot */
.spm-status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  border: 2px solid #0f172a;
}
.spm-status-online { background: #10b981; }
.spm-status-vibing { background: #8b5cf6; }
.spm-status-away { background: rgba(255, 255, 255, 0.3); }

/* Conv content */
.spm-conv-content {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.3rem;
}

.spm-conv-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.spm-conv-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-conv-time {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.8);
  flex-shrink: 0;
}

.spm-conv-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.spm-conv-preview {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spm-conv-item-unread .spm-conv-name {
  color: #fff;
  font-weight: 800;
}

.spm-conv-item-unread .spm-conv-preview {
  color: #e2e8f0;
  font-weight: 600;
}

.spm-conv-preview-market {
  color: #5eead4 !important;
}

.spm-unread-dot {
  flex-shrink: 0;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  animation: spm-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes spm-pop-in {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.spm-read-check {
  color: #8b5cf6;
  display: inline-flex;
  align-items: center;
}

.spm-key-pending {
  font-size: 0.75rem;
  color: #fbbf24;
  font-weight: 600;
}

/* List footer — holds subtle E2EE pill */
.spm-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(148, 163, 184, 0.6);
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* E2EE pill — now small & subtle in footer */
.spm-e2ee-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;"""
lines[374:601] = new_css.splitlines(True)

with open('s:/vyb-main/apps/web/app/styles/messages.css', 'w', encoding='utf-8') as f:
    f.writelines(lines)
