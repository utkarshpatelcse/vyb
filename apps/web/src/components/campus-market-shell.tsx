"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

type MarketItem = {
  id: string;
  price: string;
  title: string;
  location: string;
  imageUrl: string;
  seller: string;
  condition: string;
  category: string;
  posted: string;
  campusSpot: string;
};

type MarketRequest = {
  id: string;
  tab: "buying" | "lend";
  tag: string;
  title: string;
  detail: string;
  budget: string;
  requester: string;
  posted: string;
  category: string;
  campusSpot: string;
  tone: "violet" | "magenta" | "cyan";
};

type CampusMarketShellProps = {
  viewerName: string;
  collegeName: string;
  viewerEmail: string;
  course?: string | null;
  stream?: string | null;
  role: string;
};

type ResizeSide = "left" | "right";
type MarketTab = "sale" | "buying" | "lend";

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 360;
const MIN_RIGHT_WIDTH = 280;
const MAX_RIGHT_WIDTH = 420;
const LEFT_WIDTH_STORAGE_KEY = "vyb-campus-left-width";
const RIGHT_WIDTH_STORAGE_KEY = "vyb-campus-right-width";

const MARKET_ITEMS: MarketItem[] = [
  {
    id: "1",
    price: "Rs 1,200",
    title: "Sony Headphones",
    location: "Sigra, VNS",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=80&auto=format&fit=crop",
    seller: "music.room",
    condition: "Lightly used",
    category: "Tech",
    posted: "12m ago",
    campusSpot: "Pickup near main gate"
  },
  {
    id: "2",
    price: "Rs 3,500",
    title: "Minimal Watch",
    location: "Lanka, VNS",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80&auto=format&fit=crop",
    seller: "aditya.design",
    condition: "Like new",
    category: "Fashion",
    posted: "43m ago",
    campusSpot: "Meet at cafe court"
  },
  {
    id: "3",
    price: "Rs 850",
    title: "Notebook Bundle",
    location: "Cantt, VNS",
    imageUrl: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=900&q=80&auto=format&fit=crop",
    seller: "notes.club",
    condition: "Fresh set",
    category: "Study",
    posted: "1h ago",
    campusSpot: "Library block"
  },
  {
    id: "4",
    price: "Rs 18,000",
    title: "Gaming Chair",
    location: "Sigra, VNS",
    imageUrl: "https://images.unsplash.com/photo-1598550476439-6847785fce66?w=900&q=80&auto=format&fit=crop",
    seller: "hostel.setup",
    condition: "Great condition",
    category: "Room",
    posted: "3h ago",
    campusSpot: "Hostel A lobby"
  },
  {
    id: "5",
    price: "Rs 5,400",
    title: "Scientific Calculator Kit",
    location: "Kiet Arcade",
    imageUrl: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=900&q=80&auto=format&fit=crop",
    seller: "ece.core",
    condition: "Exam ready",
    category: "Study",
    posted: "5h ago",
    campusSpot: "Academic block 2"
  },
  {
    id: "6",
    price: "Rs 2,100",
    title: "Desk Lamp + Organizer",
    location: "Girls Hostel",
    imageUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900&q=80&auto=format&fit=crop",
    seller: "room.vibes",
    condition: "Barely used",
    category: "Room",
    posted: "7h ago",
    campusSpot: "Common room desk"
  }
];

const MARKET_REQUESTS: MarketRequest[] = [
  {
    id: "r1",
    tab: "buying",
    tag: "Looking to buy",
    title: "Second-hand DSLR camera",
    detail: "Need one for the media club showcase next weekend.",
    budget: "Budget under Rs 15k",
    requester: "pixel.ankit",
    posted: "18m ago",
    category: "Tech",
    campusSpot: "Media lab pickup",
    tone: "violet"
  },
  {
    id: "r2",
    tab: "buying",
    tag: "Need urgently",
    title: "Thermodynamics notes bundle",
    detail: "Prefer clean handwritten notes or printed unit sheets.",
    budget: "Budget around Rs 400",
    requester: "mech.sarthak",
    posted: "1h ago",
    category: "Study",
    campusSpot: "Library steps",
    tone: "magenta"
  },
  {
    id: "r3",
    tab: "lend",
    tag: "Borrow for 2 days",
    title: "Tripod or phone gimbal",
    detail: "Need it for a campus fest reel shoot on Friday evening.",
    budget: "Can pay a short rental fee",
    requester: "frame.house",
    posted: "24m ago",
    category: "Tech",
    campusSpot: "Auditorium foyer",
    tone: "cyan"
  },
  {
    id: "r4",
    tab: "lend",
    tag: "Lend / rent",
    title: "Portable induction plate",
    detail: "Need it for a hostel cookout this weekend.",
    budget: "Open to rent or borrow",
    requester: "hostel.collective",
    posted: "2h ago",
    category: "Room",
    campusSpot: "Block C reception",
    tone: "violet"
  }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function IconBase({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`vyb-campus-icon ${className}`.trim()}>
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <IconBase>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.8a.7.7 0 0 1-.7-.7v-4.1a1.5 1.5 0 0 0-3 0v4.1a.7.7 0 0 1-.7.7H5a1 1 0 0 1-1-1z" fill="currentColor" />
    </IconBase>
  );
}

function EventsIcon() {
  return (
    <IconBase>
      <path d="M7 3v3M17 3v3M5 8h14M6 5h12a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ReelsIcon() {
  return (
    <IconBase>
      <path d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 0 3 4M11.5 3l3 4M16.5 3l3 4M10 10.5l5 2.9L10 16.3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ProfileIcon() {
  return (
    <IconBase>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 7.2C6 16.9 8.7 15 12 15s6 1.9 6 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m21 21-4.3-4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

function HeartIcon() {
  return (
    <IconBase>
      <path d="M12 20.4s-6.6-4.3-8.6-8A4.8 4.8 0 0 1 11 6.9L12 8l1-1.1a4.8 4.8 0 0 1 7.6 5.5c-2 3.7-8.6 8-8.6 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MarketIcon() {
  return (
    <IconBase>
      <path d="M4 8.5 5.6 4h12.8L20 8.5M5 10v7.2A1.8 1.8 0 0 0 6.8 19h10.4A1.8 1.8 0 0 0 19 17.2V10M9 13h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function LocationIcon() {
  return (
    <IconBase>
      <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

function SparkIcon() {
  return (
    <IconBase>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ChevronRightIcon() {
  return (
    <IconBase>
      <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}

function ShieldIcon() {
  return (
    <IconBase>
      <path d="M12 3.8 19 6.7v4.7c0 4.2-2.9 8-7 8.8-4.1-.8-7-4.6-7-8.8V6.7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.4 12 1.8 1.8 3.4-3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.8v4.6l3 1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function MessageIcon() {
  return (
    <IconBase>
      <path d="M5.8 17.8a7.7 7.7 0 1 1 3 1.1L4 20l1.8-4.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function BoltIcon() {
  return (
    <IconBase>
      <path d="M13.2 2 6 13h4.8L9.8 22 17 11h-4.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function PackageIcon() {
  return (
    <IconBase>
      <path d="m12 3 7 3.8v10.4L12 21 5 17.2V6.8Zm0 0L5 6.8 12 11l7-4.2M12 11v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function getTabLabel(tab: MarketTab) {
  if (tab === "sale") {
    return "Items for sale";
  }

  if (tab === "buying") {
    return "Buying requests";
  }

  return "Lend / rent";
}

export function CampusMarketShell({
  viewerName,
  collegeName,
  viewerEmail,
  course,
  stream,
  role
}: CampusMarketShellProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeResize, setActiveResize] = useState<ResizeSide | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>("sale");
  const [searchValue, setSearchValue] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const resizeState = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const storedLeftWidth = Number.parseInt(window.localStorage.getItem(LEFT_WIDTH_STORAGE_KEY) ?? "", 10);
    const storedRightWidth = Number.parseInt(window.localStorage.getItem(RIGHT_WIDTH_STORAGE_KEY) ?? "", 10);

    if (Number.isFinite(storedLeftWidth)) {
      setLeftWidth(clamp(storedLeftWidth, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
    }

    if (Number.isFinite(storedRightWidth)) {
      setRightWidth(clamp(storedRightWidth, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    if (!activeResize) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const currentResize = resizeState.current;

      if (!currentResize) {
        return;
      }

      if (currentResize.side === "left") {
        const nextWidth = clamp(currentResize.startWidth + (event.clientX - currentResize.startX), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH);
        setLeftWidth(nextWidth);
        return;
      }

      const nextWidth = clamp(currentResize.startWidth - (event.clientX - currentResize.startX), MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH);
      setRightWidth(nextWidth);
    }

    function handlePointerUp() {
      resizeState.current = null;
      setActiveResize(null);
    }

    document.body.classList.add("vyb-campus-is-resizing");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.classList.remove("vyb-campus-is-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResize]);

  function startResizeDrag(side: ResizeSide, event: PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth < 900) {
      return;
    }

    event.preventDefault();
    resizeState.current = {
      side,
      startX: event.clientX,
      startWidth: side === "left" ? leftWidth : rightWidth
    };
    setActiveResize(side);
  }

  const navItems = [
    { label: "Home", href: "/home", icon: <HomeIcon /> },
    { label: "Events", href: "/events", icon: <EventsIcon /> },
    { label: "Market", href: "/market", icon: <MarketIcon />, active: true },
    { label: "Vibes", href: "/vibes", icon: <ReelsIcon /> },
    { label: "Profile", href: "/dashboard", icon: <ProfileIcon /> }
  ];

  const saleCategories = ["All", ...new Set(MARKET_ITEMS.map((item) => item.category))];
  const requestCategories = [
    "All",
    ...new Set(
      MARKET_REQUESTS.filter((request) => request.tab === activeTab).map((request) => request.category)
    )
  ];
  const categoryOptions = activeTab === "sale" ? saleCategories : requestCategories;

  useEffect(() => {
    if (!categoryOptions.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categoryOptions]);

  const normalizedQuery = searchValue.trim().toLowerCase();

  const filteredItems = MARKET_ITEMS.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const haystack = `${item.title} ${item.location} ${item.seller} ${item.condition} ${item.category} ${item.campusSpot}`.toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const filteredRequests = MARKET_REQUESTS.filter((request) => request.tab === activeTab).filter((request) => {
    const matchesCategory = activeCategory === "All" || request.category === activeCategory;
    const haystack = `${request.title} ${request.detail} ${request.budget} ${request.requester} ${request.category} ${request.campusSpot}`.toLowerCase();
    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const visibleCount = activeTab === "sale" ? filteredItems.length : filteredRequests.length;
  const identityLine = [course, stream].filter(Boolean).join(" / ") || collegeName;
  const tabCounts = {
    sale: MARKET_ITEMS.length,
    buying: MARKET_REQUESTS.filter((request) => request.tab === "buying").length,
    lend: MARKET_REQUESTS.filter((request) => request.tab === "lend").length
  };

  const layoutStyle = {
    "--vyb-campus-left-width": `${leftWidth}px`,
    "--vyb-campus-right-width": `${rightWidth}px`
  } as CSSProperties;

  return (
    <main className="vyb-campus-home" style={layoutStyle}>
      <aside className="vyb-campus-sidebar vyb-campus-rail">
        <Link href="/home" className="vyb-campus-branding">
          VYB
        </Link>

        <nav className="vyb-campus-nav">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={`vyb-campus-nav-item${item.active ? " is-active" : ""}`}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="vyb-campus-sidebar-footer">
          <div className="vyb-campus-sidebar-user">
            <strong>{viewerName}</strong>
            <span>{collegeName}</span>
          </div>
          <SignOutButton className="vyb-campus-signout" />
        </div>
      </aside>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-left${activeResize === "left" ? " is-active" : ""}`}
        aria-label="Resize left sidebar"
        onPointerDown={(event) => startResizeDrag("left", event)}
      />

      <section className="vyb-campus-main vyb-market-main">
        <header className="vyb-market-header">
          <div className="vyb-market-brand-block">
            <span className="vyb-market-kicker">Campus marketplace</span>
            <strong className="vyb-market-brand">VYB Shop</strong>
          </div>

          <label className="vyb-market-search-box">
            <SearchIcon />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={activeTab === "sale" ? "Search items, sellers, or pickup spots" : "Search requests, budgets, or categories"}
              aria-label="Search the campus marketplace"
            />
          </label>

          <div className="vyb-market-header-actions">
            <button type="button" className="vyb-market-header-icon" aria-label="Saved listings">
              <HeartIcon />
            </button>
            <button type="button" className="vyb-market-create-button">
              <PlusIcon />
              <span>Post listing</span>
            </button>
          </div>
        </header>

        <div className="vyb-market-shell">
          <section className="vyb-market-toolbar">
            <div className="vyb-market-toolbar-copy">
              <div>
                <span className="vyb-market-section-label">{getTabLabel(activeTab)}</span>
                <h2>Marketplace feed for verified campus deals</h2>
              </div>
              <p>
                {visibleCount} result{visibleCount === 1 ? "" : "s"} showing in {collegeName}
              </p>
            </div>

            <div className="vyb-market-tabs" role="tablist" aria-label="Marketplace sections">
              <button
                type="button"
                className={`vyb-market-tab${activeTab === "sale" ? " is-active" : ""}`}
                onClick={() => setActiveTab("sale")}
              >
                <span>Items for sale</span>
                <strong>{tabCounts.sale}</strong>
              </button>
              <button
                type="button"
                className={`vyb-market-tab${activeTab === "buying" ? " is-active" : ""}`}
                onClick={() => setActiveTab("buying")}
              >
                <span>Buying requests</span>
                <strong>{tabCounts.buying}</strong>
              </button>
              <button
                type="button"
                className={`vyb-market-tab${activeTab === "lend" ? " is-active" : ""}`}
                onClick={() => setActiveTab("lend")}
              >
                <span>Lend / rent</span>
                <strong>{tabCounts.lend}</strong>
              </button>
            </div>

            <div className="vyb-market-category-row" aria-label="Marketplace filters">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`vyb-market-category-chip${activeCategory === category ? " is-active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {activeTab === "sale" ? (
            filteredItems.length > 0 ? (
              <div className="vyb-market-grid">
                {filteredItems.map((item) => (
                  <article key={item.id} className="vyb-market-card">
                    <div className="vyb-market-card-media">
                      <img src={item.imageUrl} alt={item.title} className="vyb-market-img" />
                      <div className="vyb-market-card-badges">
                        <span className="vyb-market-condition-badge">{item.condition}</span>
                        <button type="button" className="vyb-market-save-button" aria-label={`Save ${item.title}`}>
                          <HeartIcon />
                        </button>
                      </div>
                    </div>

                    <div className="vyb-market-info">
                      <div className="vyb-market-topline">
                        <span className="vyb-market-category">{item.category}</span>
                        <span className="vyb-market-posted">
                          <ClockIcon />
                          {item.posted}
                        </span>
                      </div>

                      <span className="vyb-market-price">{item.price}</span>
                      <p className="vyb-market-title">{item.title}</p>
                      <p className="vyb-market-seller">@{item.seller}</p>

                      <div className="vyb-market-meta-list">
                        <span className="vyb-market-loc">
                          <LocationIcon />
                          {item.location}
                        </span>
                        <span className="vyb-market-loc">
                          <SparkIcon />
                          {item.campusSpot}
                        </span>
                      </div>

                      <div className="vyb-market-card-actions">
                        <button type="button" className="vyb-market-card-primary">
                          <MessageIcon />
                          <span>Message seller</span>
                        </button>
                        <button type="button" className="vyb-market-card-secondary">
                          Details
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="vyb-market-empty-state">
                <strong>No listings match that search yet.</strong>
                <p>Try another category or clear the search to see more items from the campus marketplace.</p>
              </div>
            )
          ) : filteredRequests.length > 0 ? (
            <div className="vyb-market-request-list">
              {filteredRequests.map((request) => (
                <article key={request.id} className="vyb-market-request-item">
                  <div className="vyb-market-request-copy">
                    <div className="vyb-market-request-topline">
                      <span className={`vyb-market-req-tag is-${request.tone}`}>{request.tag}</span>
                      <span className="vyb-market-posted">
                        <ClockIcon />
                        {request.posted}
                      </span>
                    </div>

                    <h3>{request.title}</h3>
                    <p>{request.detail}</p>

                    <div className="vyb-market-request-meta">
                      <span>
                        <LocationIcon />
                        {request.campusSpot}
                      </span>
                      <span>
                        <PackageIcon />
                        {request.budget}
                      </span>
                      <span>
                        <ProfileIcon />
                        @{request.requester}
                      </span>
                    </div>
                  </div>

                  <button type="button" className="vyb-market-request-action">
                    <span>Offer help</span>
                    <ChevronRightIcon />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="vyb-market-empty-state">
              <strong>No requests match that filter right now.</strong>
              <p>Switch categories or post the first request so others on campus can respond.</p>
            </div>
          )}
        </div>

        <button type="button" className="vyb-market-fab" aria-label="Create a market post">
          <PlusIcon />
        </button>
      </section>

      <button
        type="button"
        className={`vyb-campus-resizer vyb-campus-resizer-right${activeResize === "right" ? " is-active" : ""}`}
        aria-label="Resize right sidebar"
        onPointerDown={(event) => startResizeDrag("right", event)}
      />

      <aside className="vyb-campus-right-panel vyb-campus-rail">
        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Your market vibe</span>
          <div className="vyb-market-side-user">
            <img src={`https://i.pravatar.cc/120?u=${encodeURIComponent(viewerEmail)}`} alt={viewerName} />
            <div>
              <strong>{viewerName}</strong>
              <span>{identityLine}</span>
            </div>
          </div>

          <div className="vyb-market-side-stats">
            <div>
              <span>Role</span>
              <strong>{role}</strong>
            </div>
            <div>
              <span>Saved</span>
              <strong>12</strong>
            </div>
          </div>
        </div>

        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Market guidelines</span>
          <ul className="vyb-market-guideline-list">
            <li>Meet in visible campus spots before handing over payment.</li>
            <li>Verify item condition on the spot and confirm accessories.</li>
            <li>Use requests when you need something specific quickly.</li>
          </ul>
        </div>

        <div className="vyb-campus-side-card vyb-market-side-card">
          <span className="vyb-campus-side-label">Your active items</span>
          <div className="vyb-market-side-list">
            <div className="vyb-market-side-list-item">
              <strong>Start your first listing</strong>
              <span>Turn spare notes, gear, or room essentials into quick campus deals.</span>
            </div>
            <div className="vyb-market-side-list-item">
              <strong>Post a request</strong>
              <span>Need a calculator, tripod, or lab coat? Ask the community directly.</span>
            </div>
          </div>
          <button type="button" className="vyb-market-side-cta">
            Create post
          </button>
        </div>

        <SignOutButton className="vyb-campus-signout vyb-campus-signout-wide" />
      </aside>

      <nav className="vyb-campus-bottom-nav">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={`vyb-campus-bottom-item${item.active ? " is-active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
