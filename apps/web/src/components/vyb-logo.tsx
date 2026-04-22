import Image from "next/image";

type VybLogoMarkProps = {
  className?: string;
  priority?: boolean;
  size?: number;
};

type VybLogoLockupProps = {
  className?: string;
  title?: string;
  subtitle?: string;
  priority?: boolean;
  compactOnSmallScreens?: boolean;
};

export function VybLogoMark({ className = "", priority = false, size = 64 }: VybLogoMarkProps) {
  return (
    <span className={`vyb-logo-mark ${className}`.trim()} aria-hidden="true">
      <Image
        src="/icons/icon.png"
        alt="Vyb"
        width={size}
        height={size}
        priority={priority}
        className="vyb-logo-mark-image"
      />
    </span>
  );
}

export function VybLogoLockup({
  className = "",
  title = "vyb",
  subtitle,
  priority = false,
  compactOnSmallScreens = false
}: VybLogoLockupProps) {
  return (
    <span
      className={`vyb-logo-lockup${compactOnSmallScreens ? " is-compact-on-small" : ""} ${className}`.trim()}
    >
      <VybLogoMark priority={priority} />
      <span className="vyb-logo-lockup-copy">
        <strong className="vyb-logo-wordmark">{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </span>
    </span>
  );
}
