"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface MediaCarouselProps {
  /** Array of media items — url + kind pairs */
  items: { url: string; kind: "image" | "video" }[];
  /** Alt text for images */
  alt?: string;
  /** Called on double-tap (like gesture) */
  onDoubleTap?: () => void;
  /** Called on single-click (open lightbox) */
  onClick?: () => void;
  /** Post ID for heart burst */
  showHeartBurst?: boolean;
  heartBurstNode?: ReactNode;
}

export function MediaCarousel({
  items,
  alt = "Post media",
  onDoubleTap,
  onClick,
  showHeartBurst,
  heartBurstNode,
}: MediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const total = items.length;

  // Double-tap detection — only fires when user did NOT drag
  const lastTap = useRef(0);
  const dragOccurred = useRef(false);

  function handleTap() {
    // If the user swiped/dragged, suppress the tap entirely
    if (dragOccurred.current) {
      dragOccurred.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 310) {
      onDoubleTap?.();
    } else {
      onClick?.();
    }
    lastTap.current = now;
  }

  function snapTo(index: number) {
    const clampedIndex = Math.max(0, Math.min(index, total - 1));
    setActiveIndex(clampedIndex);
    const containerWidth = constraintsRef.current?.offsetWidth ?? 0;
    void animate(x, -clampedIndex * containerWidth, {
      type: "spring",
      stiffness: 300,
      damping: 30,
    });
  }

  function handleDragStart() {
    dragOccurred.current = false;
  }

  function handleDrag(_: unknown, info: { offset: { x: number } }) {
    // Mark as drag if finger moved more than 5px horizontally
    if (Math.abs(info.offset.x) > 5) {
      dragOccurred.current = true;
    }
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const containerWidth = constraintsRef.current?.offsetWidth ?? 0;
    const threshold = containerWidth * 0.25;
    const direction = info.offset.x < -threshold || info.velocity.x < -500 ? 1 : info.offset.x > threshold || info.velocity.x > 500 ? -1 : 0;
    snapTo(activeIndex + direction);
  }

  // re-snap on resize
  useEffect(() => {
    const el = constraintsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      x.set(-activeIndex * w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  if (total === 0) return null;

  // Single item — no carousel chrome needed
  if (total === 1) {
    const item = items[0]!;
    return (
      <div
        className="feed-carousel feed-carousel--single"
        role="button"
        tabIndex={0}
        onClick={handleTap}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTap(); } }}
      >
        {item.kind === "video" ? (
          <FeedVideo src={item.url} />
        ) : (
          <img
            src={item.url}
            alt={alt}
            className="feed-carousel__slide-img"
            loading="lazy"
          />
        )}
        {showHeartBurst && heartBurstNode}
      </div>
    );
  }

  return (
    <div
      className="feed-carousel"
      ref={constraintsRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Track */}
      <div className="feed-carousel__viewport" ref={trackRef}>
        <motion.div
          className="feed-carousel__track"
          style={{ x, width: `${total * 100}%` }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onTap={handleTap}
          whileTap={{ cursor: "grabbing" }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="feed-carousel__slide"
              style={{ width: `${100 / total}%` }}
            >
              {item.kind === "video" ? (
                <FeedVideo src={item.url} isActive={i === activeIndex} />
              ) : (
                <img
                  src={item.url}
                  alt={`${alt} ${i + 1}`}
                  className="feed-carousel__slide-img"
                  loading="lazy"
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Prev / Next arrows — appear on hover (desktop) */}
      <button
        type="button"
        className={`feed-carousel__arrow feed-carousel__arrow--prev${isHovered && activeIndex > 0 ? " is-visible" : ""}`}
        aria-label="Previous"
        onClick={(e) => { e.stopPropagation(); snapTo(activeIndex - 1); }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className={`feed-carousel__arrow feed-carousel__arrow--next${isHovered && activeIndex < total - 1 ? " is-visible" : ""}`}
        aria-label="Next"
        onClick={(e) => { e.stopPropagation(); snapTo(activeIndex + 1); }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {/* Pagination dots — bottom center */}
      <div className="feed-carousel__dots" aria-hidden="true">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`feed-carousel__dot${i === activeIndex ? " is-active" : ""}`}
            aria-label={`Go to slide ${i + 1}`}
            onClick={(e) => { e.stopPropagation(); snapTo(i); }}
          />
        ))}
      </div>

      {showHeartBurst && heartBurstNode}
    </div>
  );
}

/* ── FeedVideo: IntersectionObserver auto-play ────────────────────────────── */
interface FeedVideoProps {
  src: string;
  isActive?: boolean;
}

export function FeedVideo({ src, isActive = true }: FeedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && isActive) {
            video.play().catch(() => { /* user gesture required */ });
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [isActive]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="feed-carousel__slide-img"
      muted
      playsInline
      loop
      preload="none"
    />
  );
}
