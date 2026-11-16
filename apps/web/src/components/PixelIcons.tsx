"use client";

import React from "react";
import type { FieldType } from "@/lib/form-types";

export interface PixelIconProps {
  size?: number;
  className?: string;
}

function PixelSvg({
  size = 16,
  className = "",
  children,
}: PixelIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pixel-icon ${className}`.trim()}
    >
      {children}
    </svg>
  );
}

export function PixelQuestionsIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Pixel Document / Notepad */}
      <rect x="2" y="1" width="9" height="2" />
      <rect x="2" y="3" width="2" height="11" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="13" y="4" width="2" height="10" />
      <rect x="4" y="13" width="9" height="2" />
      {/* Corner fold */}
      <rect x="10" y="3" width="1" height="2" />
      <rect x="11" y="4" width="2" height="1" />
      {/* Ruled lines */}
      <rect x="5" y="6" width="6" height="1" />
      <rect x="5" y="8" width="6" height="1" />
      <rect x="5" y="10" width="4" height="1" />
    </PixelSvg>
  );
}

export function PixelEyeIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Top lid */}
      <rect x="5" y="3" width="6" height="1" />
      <rect x="3" y="4" width="2" height="1" />
      <rect x="11" y="4" width="2" height="1" />
      <rect x="2" y="5" width="1" height="2" />
      <rect x="13" y="5" width="1" height="2" />
      {/* Outer corners */}
      <rect x="1" y="7" width="1" height="2" />
      <rect x="14" y="7" width="1" height="2" />
      {/* Bottom lid */}
      <rect x="2" y="9" width="1" height="2" />
      <rect x="13" y="9" width="1" height="2" />
      <rect x="3" y="11" width="2" height="1" />
      <rect x="11" y="11" width="2" height="1" />
      <rect x="5" y="12" width="6" height="1" />
      {/* Pupil */}
      <rect x="6" y="6" width="4" height="4" />
    </PixelSvg>
  );
}

export function PixelCatalogIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Pixel Folder */}
      <rect x="1" y="2" width="6" height="2" />
      <rect x="7" y="3" width="1" height="1" />
      <rect x="1" y="4" width="14" height="2" />
      <rect x="1" y="6" width="2" height="7" />
      <rect x="13" y="6" width="2" height="7" />
      <rect x="1" y="13" width="14" height="2" />
      {/* Inner label tab */}
      <rect x="5" y="8" width="6" height="2" />
    </PixelSvg>
  );
}

export function PixelSettingsIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Top & bottom gear teeth */}
      <rect x="7" y="1" width="2" height="2" />
      <rect x="7" y="13" width="2" height="2" />
      {/* Left & right gear teeth */}
      <rect x="1" y="7" width="2" height="2" />
      <rect x="13" y="7" width="2" height="2" />
      {/* Diagonal teeth */}
      <rect x="3" y="3" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="3" y="11" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      {/* Ring */}
      <rect x="5" y="3" width="6" height="2" />
      <rect x="5" y="11" width="6" height="2" />
      <rect x="3" y="5" width="2" height="6" />
      <rect x="11" y="5" width="2" height="6" />
      {/* Center nut */}
      <rect x="7" y="7" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelPhoneIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="4" y="1" width="8" height="2" />
      <rect x="4" y="13" width="8" height="2" />
      <rect x="3" y="2" width="2" height="12" />
      <rect x="11" y="2" width="2" height="12" />
      {/* Notch / speaker */}
      <rect x="7" y="3" width="2" height="1" />
      {/* Home indicator */}
      <rect x="7" y="12" width="2" height="1" />
      {/* Screen inner lines */}
      <rect x="6" y="6" width="4" height="1" />
      <rect x="6" y="8" width="4" height="1" />
    </PixelSvg>
  );
}

export function PixelDesktopIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Monitor frame */}
      <rect x="1" y="2" width="14" height="2" />
      <rect x="1" y="10" width="14" height="2" />
      <rect x="1" y="4" width="2" height="6" />
      <rect x="13" y="4" width="2" height="6" />
      {/* Stand */}
      <rect x="7" y="12" width="2" height="2" />
      <rect x="4" y="14" width="8" height="1" />
      {/* Screen accent */}
      <rect x="4" y="5" width="5" height="1" />
      <rect x="4" y="7" width="8" height="1" />
    </PixelSvg>
  );
}

export function PixelPlusIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="7" y="2" width="2" height="12" />
      <rect x="2" y="7" width="12" height="2" />
    </PixelSvg>
  );
}

export function PixelTextIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Serif T */}
      <rect x="2" y="2" width="12" height="2" />
      <rect x="2" y="4" width="2" height="1" />
      <rect x="12" y="4" width="2" height="1" />
      <rect x="7" y="4" width="2" height="9" />
      <rect x="5" y="13" width="6" height="2" />
    </PixelSvg>
  );
}

export function PixelDropdownIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Outer box */}
      <rect x="1" y="3" width="14" height="2" />
      <rect x="1" y="11" width="14" height="2" />
      <rect x="1" y="5" width="2" height="6" />
      <rect x="13" y="5" width="2" height="6" />
      {/* Text line + Down triangle */}
      <rect x="4" y="7" width="4" height="2" />
      <rect x="10" y="7" width="2" height="1" />
      <rect x="10" y="8" width="1" height="1" />
    </PixelSvg>
  );
}

export function PixelRadioIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="5" y="2" width="6" height="2" />
      <rect x="5" y="12" width="6" height="2" />
      <rect x="2" y="5" width="2" height="6" />
      <rect x="12" y="5" width="2" height="6" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="3" y="11" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      {/* Inner dot */}
      <rect x="6" y="6" width="4" height="4" />
    </PixelSvg>
  );
}

export function PixelCheckboxIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="2" width="12" height="2" />
      <rect x="2" y="12" width="12" height="2" />
      <rect x="2" y="4" width="2" height="8" />
      <rect x="12" y="4" width="2" height="8" />
      {/* Checkmark */}
      <rect x="5" y="8" width="2" height="2" />
      <rect x="7" y="9" width="2" height="2" />
      <rect x="9" y="6" width="2" height="3" />
    </PixelSvg>
  );
}

export function PixelClipIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Pixel Paperclip / Upload */}
      <rect x="5" y="1" width="6" height="2" />
      <rect x="3" y="3" width="2" height="9" />
      <rect x="11" y="3" width="2" height="10" />
      <rect x="5" y="13" width="6" height="2" />
      <rect x="7" y="5" width="2" height="7" />
      <rect x="7" y="11" width="2" height="1" />
    </PixelSvg>
  );
}

export function PixelDateIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Top binder rings */}
      <rect x="4" y="1" width="2" height="2" />
      <rect x="10" y="1" width="2" height="2" />
      {/* Header bar */}
      <rect x="2" y="3" width="12" height="3" />
      {/* Frame */}
      <rect x="2" y="6" width="2" height="7" />
      <rect x="12" y="6" width="2" height="7" />
      <rect x="2" y="13" width="12" height="2" />
      {/* Grid dots */}
      <rect x="5" y="8" width="2" height="1" />
      <rect x="9" y="8" width="2" height="1" />
      <rect x="5" y="10" width="2" height="1" />
      <rect x="9" y="10" width="2" height="1" />
    </PixelSvg>
  );
}

export function PixelDividerIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="1" y="7" width="3" height="2" />
      <rect x="6" y="7" width="4" height="2" />
      <rect x="12" y="7" width="3" height="2" />
    </PixelSvg>
  );
}

export function PixelEmailIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="1" y="3" width="14" height="2" />
      <rect x="1" y="11" width="14" height="2" />
      <rect x="1" y="5" width="2" height="6" />
      <rect x="13" y="5" width="2" height="6" />
      {/* V-flap */}
      <rect x="3" y="5" width="2" height="2" />
      <rect x="11" y="5" width="2" height="2" />
      <rect x="5" y="7" width="2" height="2" />
      <rect x="9" y="7" width="2" height="2" />
      <rect x="7" y="8" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelHashIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="5" y="2" width="2" height="12" />
      <rect x="9" y="2" width="2" height="12" />
      <rect x="2" y="5" width="12" height="2" />
      <rect x="2" y="9" width="12" height="2" />
    </PixelSvg>
  );
}

export function PixelParagraphIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="3" width="12" height="2" />
      <rect x="2" y="7" width="12" height="2" />
      <rect x="2" y="11" width="8" height="2" />
    </PixelSvg>
  );
}

export function PixelShortTextIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="5" width="9" height="2" />
      <rect x="2" y="9" width="12" height="2" />
    </PixelSvg>
  );
}

export function PixelInfoIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="2" width="12" height="2" />
      <rect x="2" y="12" width="12" height="2" />
      <rect x="2" y="4" width="2" height="8" />
      <rect x="12" y="4" width="2" height="8" />
      {/* i dot & stem */}
      <rect x="7" y="5" width="2" height="2" />
      <rect x="7" y="8" width="2" height="3" />
    </PixelSvg>
  );
}

export function PixelArrowUpIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="7" y="2" width="2" height="12" />
      <rect x="5" y="4" width="2" height="2" />
      <rect x="9" y="4" width="2" height="2" />
      <rect x="3" y="6" width="2" height="2" />
      <rect x="11" y="6" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelArrowDownIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="7" y="2" width="2" height="12" />
      <rect x="3" y="8" width="2" height="2" />
      <rect x="11" y="8" width="2" height="2" />
      <rect x="5" y="10" width="2" height="2" />
      <rect x="9" y="10" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelArrowLeftIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="7" width="12" height="2" />
      <rect x="4" y="5" width="2" height="2" />
      <rect x="4" y="9" width="2" height="2" />
      <rect x="6" y="3" width="2" height="2" />
      <rect x="6" y="11" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelArrowRightIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="2" y="7" width="12" height="2" />
      <rect x="10" y="5" width="2" height="2" />
      <rect x="10" y="9" width="2" height="2" />
      <rect x="8" y="3" width="2" height="2" />
      <rect x="8" y="11" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelDuplicateIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Back sheet */}
      <rect x="2" y="2" width="8" height="2" />
      <rect x="2" y="4" width="2" height="7" />
      {/* Front sheet */}
      <rect x="6" y="5" width="8" height="2" />
      <rect x="6" y="7" width="2" height="7" />
      <rect x="12" y="7" width="2" height="7" />
      <rect x="6" y="13" width="8" height="2" />
    </PixelSvg>
  );
}

export function PixelTrashIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Lid handle & bar */}
      <rect x="6" y="1" width="4" height="2" />
      <rect x="2" y="3" width="12" height="2" />
      {/* Bin walls */}
      <rect x="3" y="6" width="2" height="8" />
      <rect x="11" y="6" width="2" height="8" />
      <rect x="3" y="13" width="10" height="2" />
      {/* Ribs */}
      <rect x="6" y="7" width="1" height="5" />
      <rect x="9" y="7" width="1" height="5" />
    </PixelSvg>
  );
}

export function PixelSaveIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      {/* Pixel Floppy Disk */}
      <rect x="2" y="2" width="10" height="2" />
      <rect x="12" y="3" width="2" height="11" />
      <rect x="2" y="4" width="2" height="10" />
      <rect x="2" y="13" width="12" height="2" />
      {/* Top shutter */}
      <rect x="5" y="4" width="5" height="3" />
      {/* Bottom label area */}
      <rect x="5" y="9" width="6" height="4" />
    </PixelSvg>
  );
}

export function PixelLockIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="5" y="2" width="6" height="2" />
      <rect x="4" y="4" width="2" height="3" />
      <rect x="10" y="4" width="2" height="3" />
      <rect x="3" y="7" width="10" height="7" />
    </PixelSvg>
  );
}

export function PixelSparkleIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="7" y="1" width="2" height="14" />
      <rect x="1" y="7" width="14" height="2" />
      <rect x="5" y="5" width="6" height="6" />
    </PixelSvg>
  );
}

export function PixelDragHandleIcon({ size = 16, className }: PixelIconProps) {
  return (
    <PixelSvg size={size} className={className}>
      <rect x="3" y="5" width="2" height="2" />
      <rect x="7" y="5" width="2" height="2" />
      <rect x="11" y="5" width="2" height="2" />
      <rect x="3" y="9" width="2" height="2" />
      <rect x="7" y="9" width="2" height="2" />
      <rect x="11" y="9" width="2" height="2" />
    </PixelSvg>
  );
}

export function PixelFieldTypeIcon({
  type,
  size = 16,
  className,
}: PixelIconProps & { type: FieldType }) {
  switch (type) {
    case "short_text":
      return <PixelShortTextIcon size={size} className={className} />;
    case "long_text":
      return <PixelParagraphIcon size={size} className={className} />;
    case "dropdown":
      return <PixelDropdownIcon size={size} className={className} />;
    case "single_choice":
      return <PixelRadioIcon size={size} className={className} />;
    case "multiple_choice":
      return <PixelCheckboxIcon size={size} className={className} />;
    case "date":
      return <PixelDateIcon size={size} className={className} />;
    case "email":
      return <PixelEmailIcon size={size} className={className} />;
    case "number":
      return <PixelHashIcon size={size} className={className} />;
    case "file_upload":
      return <PixelClipIcon size={size} className={className} />;
    case "heading":
      return <PixelTextIcon size={size} className={className} />;
    case "instructions":
      return <PixelInfoIcon size={size} className={className} />;
    case "section":
      return <PixelDividerIcon size={size} className={className} />;
    default:
      return <PixelShortTextIcon size={size} className={className} />;
  }
}
