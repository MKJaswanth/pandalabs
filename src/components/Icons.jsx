/**
 * Lightweight inline SVG icons for QA Lab.
 * Every icon inherits currentColor and accepts standard SVG props.
 * All icons are 16×16 by default; pass width/height to resize.
 */

const defaults = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function icon(paths) {
  return function Icon({ width, height, ...props } = {}) {
    return (
      <svg {...defaults} width={width ?? defaults.width} height={height ?? defaults.height} {...props}>
        {paths}
      </svg>
    )
  }
}

export const XIcon = icon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
)

export const CheckIcon = icon(
  <polyline points="20 6 9 17 4 12" />
)

export const PencilIcon = icon(
  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
)

export const UploadIcon = icon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>
)

export const DownloadIcon = icon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
)

export const ChevronLeftIcon = icon(
  <path d="m15 18-6-6 6-6" />
)

export const ChevronRightIcon = icon(
  <path d="m9 18 6-6-6-6" />
)

export const ChevronDownIcon = icon(
  <path d="m6 9 6 6 6-6" />
)

export const ArrowRightIcon = icon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>
)

export const CopyIcon = icon(
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>
)

export const PlusIcon = icon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
)

export const MinusIcon = icon(
  <line x1="5" y1="12" x2="19" y2="12" />
)

export const BugIcon = icon(
  <>
    <path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0Z" />
    <path d="M3 13h5" />
    <path d="M16 13h5" />
    <path d="M4 20l4-3" />
    <path d="m16 17 4 3" />
    <path d="M9 4 7 2" />
    <path d="m15 4 2-2" />
  </>
)

export const CheckCircleIcon = icon(
  <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>
)

export const TrashIcon = icon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </>
)

export const AlertTriangleIcon = icon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
)

export const ShieldCheckIcon = icon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <polyline points="9 12 11 14 15 10" />
  </>
)

export const BarChartIcon = icon(
  <>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </>
)

export const TrendingUpIcon = icon(
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>
)

export const PrintIcon = icon(
  <>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </>
)

export const SortAscIcon = icon(
  <>
    <path d="M11 11V3" />
    <path d="m7 7 4-4 4 4" />
    <path d="M16 13h3" />
    <path d="M16 17h5" />
    <path d="M16 21h7" />
  </>
)

export const SortDescIcon = icon(
  <>
    <path d="M11 13V21" />
    <path d="m7 17 4 4 4-4" />
    <path d="M16 3h7" />
    <path d="M16 7h5" />
    <path d="M16 11h3" />
  </>
)

export const SortNoneIcon = icon(
  <>
    <path d="m3 16 4 4 4-4" />
    <path d="M7 20V4" />
    <path d="m21 8-4-4-4 4" />
    <path d="M17 4v16" />
  </>
)

export const EyeIcon = icon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
)

export const EyeOffIcon = icon(
  <>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
    <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </>
)
