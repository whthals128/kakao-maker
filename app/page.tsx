"use client";

import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const WIDTH = 1029;
const HEIGHT = 258;
const SAFE_AREA: Rect = { x: 48, y: 0, width: 933, height: 258 };
const COPY_AREA: Rect = { x: 48, y: 51, width: 933, height: 156 };
const OBJECT_MAX_WIDTH = 438;
const MIN_COPY_OBJECT_GAP = 33;
const MAX_FILE_BYTES = 300 * 1024;
const MAIN_COPY_COLOR = "#4C4C4C";
const SUB_COPY_COLOR = "#777777";
const COPY_FONT_MIN = 39;
const COPY_FONT_MAX = 51;
const DEFAULT_MAIN_FONT_SIZE = 48;
const DEFAULT_SUB_FONT_SIZE = 39;
const SETTINGS_KEY = "kakao-maker:settings:v1";
const DB_NAME = "kakao-maker-assets";
const STORE_NAME = "assets";

type TemplateType = "badge" | "center";
type ObjectSide = "left" | "right";
type CopyAlign = "left" | "center" | "right";
type AssetKey = "product" | "product2" | "advertiser";
type ProductAssetKey = Exclude<AssetKey, "advertiser">;
type StoredAssetKey = AssetKey | `${TemplateType}:${ProductAssetKey}`;
type ActiveLayer = "product" | "product2" | "both";
type ProductLayer = "product" | "product2";
type Rect = { x: number; y: number; width: number; height: number };
type CopyLine = {
  label: string;
  text: string;
  x: number;
  baseline: number;
  clipArea: Rect;
  align: CanvasTextAlign;
  size: number;
  weight: 400 | 700;
  color: string;
};
type AssetState = { file: File | null; image: HTMLImageElement | null; url: string };
type StoredAsset = { blob: Blob; name: string; type: string };
type CopyAlignmentSettings = {
  mainAlign: CopyAlign;
  subAlign: CopyAlign;
  centerLeftMainAlign: CopyAlign;
  centerRightMainAlign: CopyAlign;
  centerLeftSubAlign: CopyAlign;
  centerRightSubAlign: CopyAlign;
};
type TemplateDraft = {
  objectSide: ObjectSide;
  mainCopy: string;
  subCopy: string;
  centerLeftSub: string;
  centerRightSub: string;
  subCopyEnabled: boolean;
  centerLeftSubEnabled: boolean;
  centerRightSubEnabled: boolean;
  mainFontSize: number;
  subFontSize: number;
  mainAlign: CopyAlign;
  subAlign: CopyAlign;
  centerLeftMainAlign: CopyAlign;
  centerRightMainAlign: CopyAlign;
  centerLeftSubAlign: CopyAlign;
  centerRightSubAlign: CopyAlign;
  advertiserText: string;
  badgeText: string;
  background: string;
  textColor: string;
  badgeColor: string;
  productScale: number;
  productX: number;
  productY: number;
  product2Scale: number;
  product2X: number;
  product2Y: number;
  activeProduct: ActiveLayer;
  groupScaleOffset: number;
};
type Settings = {
  template: TemplateType;
  objectSide: ObjectSide;
  mainCopy: string;
  subCopy: string;
  centerLeftSub: string;
  centerRightSub: string;
  subCopyEnabled: boolean;
  centerLeftSubEnabled: boolean;
  centerRightSubEnabled: boolean;
  mainFontSize: number;
  subFontSize: number;
  mainAlign: CopyAlign;
  subAlign: CopyAlign;
  centerLeftMainAlign: CopyAlign;
  centerRightMainAlign: CopyAlign;
  centerLeftSubAlign: CopyAlign;
  centerRightSubAlign: CopyAlign;
  advertiserText: string;
  badgeText: string;
  background: string;
  textColor: string;
  badgeColor: string;
  productScale: number;
  productX: number;
  productY: number;
  product2Scale: number;
  product2X: number;
  product2Y: number;
  activeProduct: ActiveLayer;
  groupScaleOffset: number;
  showGuides: boolean;
  inquiry: string;
  templateDrafts?: Record<TemplateType, TemplateDraft>;
};

const DEFAULT_TEMPLATE_DRAFTS: Record<TemplateType, TemplateDraft> = {
  badge: {
    objectSide: "right", mainCopy: "쫀득쫀득 촉감의 매력", subCopy: "오늘만 10% 추가적립",
    centerLeftSub: "오늘만 10% 추가적립", centerRightSub: "니니즈 스페셜 필로우", advertiserText: "J.ESTINA",
    subCopyEnabled: true, centerLeftSubEnabled: false, centerRightSubEnabled: false,
    mainFontSize: DEFAULT_MAIN_FONT_SIZE, subFontSize: DEFAULT_SUB_FONT_SIZE,
    mainAlign: "left", subAlign: "left", centerLeftMainAlign: "left", centerRightMainAlign: "right",
    centerLeftSubAlign: "left", centerRightSubAlign: "right",
    badgeText: "10%", background: "#F5F5F5", textColor: "#4C4C4C", badgeColor: "#FF3B00",
    productScale: 100, productX: 0, productY: 0, product2Scale: 82, product2X: 62, product2Y: 18,
    activeProduct: "product", groupScaleOffset: 0,
  },
  center: {
    objectSide: "right", mainCopy: "쫀득쫀득", subCopy: "바디필로우",
    centerLeftSub: "", centerRightSub: "", advertiserText: "J.ESTINA",
    subCopyEnabled: true, centerLeftSubEnabled: false, centerRightSubEnabled: false,
    mainFontSize: DEFAULT_MAIN_FONT_SIZE, subFontSize: DEFAULT_SUB_FONT_SIZE,
    mainAlign: "left", subAlign: "left", centerLeftMainAlign: "left", centerRightMainAlign: "right",
    centerLeftSubAlign: "left", centerRightSubAlign: "right",
    badgeText: "10%", background: "#F5F5F5", textColor: "#4C4C4C", badgeColor: "#FF3B00",
    productScale: 100, productX: 0, productY: 0, product2Scale: 82, product2X: 62, product2Y: 18,
    activeProduct: "product", groupScaleOffset: 0,
  },
};

function normalizeCopyAlign(value: unknown, fallback: CopyAlign): CopyAlign {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function mergeTemplateDraft(template: TemplateType, saved: Partial<TemplateDraft> = {}): TemplateDraft {
  const fallback = DEFAULT_TEMPLATE_DRAFTS[template];
  const merged = { ...fallback, ...saved };
  const mainSize = Number(merged.mainFontSize);
  const subSize = Number(merged.subFontSize);
  return {
    ...merged,
    subCopyEnabled: typeof saved.subCopyEnabled === "boolean" ? saved.subCopyEnabled : Boolean(merged.subCopy.trim()),
    centerLeftSubEnabled: typeof saved.centerLeftSubEnabled === "boolean" ? saved.centerLeftSubEnabled : Boolean(merged.centerLeftSub.trim()),
    centerRightSubEnabled: typeof saved.centerRightSubEnabled === "boolean" ? saved.centerRightSubEnabled : Boolean(merged.centerRightSub.trim()),
    mainFontSize: Math.max(COPY_FONT_MIN, Math.min(COPY_FONT_MAX, Number.isFinite(mainSize) ? mainSize : fallback.mainFontSize)),
    subFontSize: Math.max(COPY_FONT_MIN, Math.min(COPY_FONT_MAX, Number.isFinite(subSize) ? subSize : fallback.subFontSize)),
    mainAlign: normalizeCopyAlign(merged.mainAlign, fallback.mainAlign),
    subAlign: normalizeCopyAlign(merged.subAlign, fallback.subAlign),
    centerLeftMainAlign: normalizeCopyAlign(merged.centerLeftMainAlign, fallback.centerLeftMainAlign),
    centerRightMainAlign: normalizeCopyAlign(merged.centerRightMainAlign, fallback.centerRightMainAlign),
    centerLeftSubAlign: normalizeCopyAlign(merged.centerLeftSubAlign, fallback.centerLeftSubAlign),
    centerRightSubAlign: normalizeCopyAlign(merged.centerRightSubAlign, fallback.centerRightSubAlign),
  };
}

const EMPTY_ASSET: AssetState = { file: null, image: null, url: "" };

function normalizeHex(value: string, fallback: string) {
  const next = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback;
}

function prepareAsset(file: File) {
  return new Promise<AssetState>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid-image"));
    };
    image.src = url;
  });
}

function preparePublicAsset(url: string) {
  return new Promise<AssetState>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ file: null, image, url });
    image.onerror = () => reject(new Error("invalid-public-image"));
    image.src = url;
  });
}

function revokeAssetUrl(asset: AssetState) {
  if (asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAsset(key: StoredAssetKey, file: File) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(
      { blob: file, name: file.name, type: file.type } satisfies StoredAsset,
      key,
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readAsset(key: StoredAssetKey) {
  const database = await openDatabase();
  const result = await new Promise<StoredAsset | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as StoredAsset | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

async function clearAssets() {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function getProductBox(template: TemplateType, objectSide: ObjectSide): Rect {
  if (template === "center") {
    return { x: Math.round((WIDTH - OBJECT_MAX_WIDTH) / 2), y: 0, width: OBJECT_MAX_WIDTH, height: HEIGHT };
  }
  return objectSide === "right"
    ? { x: SAFE_AREA.x + SAFE_AREA.width - OBJECT_MAX_WIDTH, y: 0, width: OBJECT_MAX_WIDTH, height: HEIGHT }
    : { x: SAFE_AREA.x, y: 0, width: OBJECT_MAX_WIDTH, height: HEIGHT };
}

function getAlignedTextX(area: Rect, align: CopyAlign) {
  if (align === "center") return area.x + area.width / 2;
  return align === "right" ? area.x + area.width : area.x;
}

function getCopyLines(
  ctx: CanvasRenderingContext2D,
  template: TemplateType,
  objectSide: ObjectSide,
  mainCopy: string,
  subCopy: string,
  centerLeftSub: string,
  centerRightSub: string,
  subCopyEnabled: boolean,
  centerLeftSubEnabled: boolean,
  centerRightSubEnabled: boolean,
  mainFontSize: number,
  subFontSize: number,
  alignments: CopyAlignmentSettings,
) {
  if (template === "badge") {
    const productBox = getProductBox(template, objectSide);
    const copyAreaX = objectSide === "right" ? SAFE_AREA.x : productBox.x + productBox.width + MIN_COPY_OBJECT_GAP;
    const maxWidth = objectSide === "right"
      ? productBox.x - MIN_COPY_OBJECT_GAP - copyAreaX
      : SAFE_AREA.x + SAFE_AREA.width - copyAreaX;
    const copyArea = { x: copyAreaX, y: COPY_AREA.y, width: maxWidth, height: COPY_AREA.height };
    const activeSubCopy = subCopyEnabled ? subCopy.trim() : "";
    const mainBaseline = activeSubCopy ? 113 : 145;
    return [
      { label: "메인카피", text: mainCopy.trim(), x: getAlignedTextX(copyArea, alignments.mainAlign), baseline: mainBaseline, clipArea: copyArea, align: alignments.mainAlign, size: mainFontSize, weight: 700, color: MAIN_COPY_COLOR },
      { label: "서브카피", text: activeSubCopy, x: getAlignedTextX(copyArea, alignments.subAlign), baseline: 174, clipArea: copyArea, align: alignments.subAlign, size: subFontSize, weight: 400, color: SUB_COPY_COLOR },
    ] satisfies CopyLine[];
  }

  const productBox = getProductBox(template, objectSide);
  const leftX = SAFE_AREA.x;
  const rightX = SAFE_AREA.x + SAFE_AREA.width;
  const leftWidth = productBox.x - MIN_COPY_OBJECT_GAP - leftX;
  const rightWidth = rightX - (productBox.x + productBox.width + MIN_COPY_OBJECT_GAP);
  const leftArea = { x: leftX, y: COPY_AREA.y, width: leftWidth, height: COPY_AREA.height };
  const rightArea = { x: rightX - rightWidth, y: COPY_AREA.y, width: rightWidth, height: COPY_AREA.height };
  const activeLeftSub = centerLeftSubEnabled ? centerLeftSub.trim() : "";
  const activeRightSub = centerRightSubEnabled ? centerRightSub.trim() : "";
  const leftMainBaseline = activeLeftSub ? 113 : 145;
  const rightMainBaseline = activeRightSub ? 113 : 145;
  return [
    {
      label: "좌측 메인카피", text: mainCopy.trim(), x: getAlignedTextX(leftArea, alignments.centerLeftMainAlign), baseline: leftMainBaseline, clipArea: leftArea, align: alignments.centerLeftMainAlign,
      size: mainFontSize, weight: 700, color: MAIN_COPY_COLOR,
    },
    {
      label: "좌측 서브카피", text: activeLeftSub, x: getAlignedTextX(leftArea, alignments.centerLeftSubAlign), baseline: 174, clipArea: leftArea, align: alignments.centerLeftSubAlign,
      size: subFontSize, weight: 400, color: SUB_COPY_COLOR,
    },
    {
      label: "우측 메인카피", text: subCopy.trim(), x: getAlignedTextX(rightArea, alignments.centerRightMainAlign), baseline: rightMainBaseline, clipArea: rightArea, align: alignments.centerRightMainAlign,
      size: mainFontSize, weight: 700, color: MAIN_COPY_COLOR,
    },
    {
      label: "우측 서브카피", text: activeRightSub, x: getAlignedTextX(rightArea, alignments.centerRightSubAlign), baseline: 174, clipArea: rightArea, align: alignments.centerRightSubAlign,
      size: subFontSize, weight: 400, color: SUB_COPY_COLOR,
    },
  ] satisfies CopyLine[];
}

function intersectsRect(first: Rect, second: Rect) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  scalePercent: number,
  offsetX: number,
  offsetY: number,
) {
  const baseScale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const scale = baseScale * (scalePercent / 100);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  ctx.drawImage(
    image,
    box.x + (box.width - width) / 2 + offsetX,
    box.y + (box.height - height) / 2 + offsetY,
    width,
    height,
  );
  ctx.restore();
}

function traceBadgeFlag(ctx: CanvasRenderingContext2D, x: number) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + 64, 0);
  ctx.lineTo(x + 64, 58);
  ctx.lineTo(x + 32, 78);
  ctx.lineTo(x, 58);
  ctx.closePath();
}

function getVisibleImageRect(
  image: HTMLImageElement | null,
  box: Rect,
  scalePercent: number,
  offsetX: number,
  offsetY: number,
) {
  if (!image) return null;
  const baseScale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const scale = baseScale * (scalePercent / 100);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const imageX = box.x + (box.width - width) / 2 + offsetX;
  const imageY = box.y + (box.height - height) / 2 + offsetY;
  const left = Math.max(box.x, imageX);
  const top = Math.max(box.y, imageY);
  const right = Math.min(box.x + box.width, imageX + width);
  const bottom = Math.min(box.y + box.height, imageY + height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function pointInRect(x: number, y: number, rect: Rect | null) {
  return Boolean(rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
}

function drawAdvertiser(
  ctx: CanvasRenderingContext2D,
  asset: AssetState,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
) {
  if (asset.image) {
    const maxWidth = 104;
    const maxHeight = 38;
    const scale = Math.min(maxWidth / asset.image.naturalWidth, maxHeight / asset.image.naturalHeight);
    const width = asset.image.naturalWidth * scale;
    const height = asset.image.naturalHeight * scale;
    const left = align === "right" ? x - width : x;
    ctx.drawImage(asset.image, left, y - height, width, height);
    return;
  }
  ctx.fillStyle = "#202020";
  ctx.font = "800 18px Pretendard, 'Noto Sans KR', sans-serif";
  ctx.textAlign = align;
  ctx.textBaseline = "bottom";
  ctx.fillText(text.trim() || "광고주체", x, y, 110);
}

function UploadField({
  label,
  hint,
  asset,
  assetKey,
  onFile,
  onPaste,
}: {
  label: string;
  hint: string;
  asset: AssetState;
  assetKey: AssetKey;
  onFile: (key: AssetKey, file?: File) => void;
  onPaste: (key: AssetKey) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onFile(assetKey, event.dataTransfer.files[0]);
  }

  function paste(event: ReactClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    onFile(assetKey, file);
  }

  return (
    <div className="field-block">
      <div className="field-heading">
        <div><strong>{label}</strong><span>{hint}</span></div>
        {asset.image && <span className="complete-badge">등록됨</span>}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onFile(assetKey, event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div
        className={`upload-box ${asset.url ? "has-file" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        onPaste={paste}
        role="group"
        aria-label={`${label} 이미지 드롭 또는 붙여넣기 영역`}
        tabIndex={0}
      >
        {asset.url ? (
          <>
            {/* Blob URL from a local upload. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={`${label} 미리보기`} />
            <div className="upload-copy"><b>{asset.file?.name ?? (assetKey === "advertiser" ? "제이에스티나 기본 로고" : "등록된 이미지")}</b><span>Ctrl+V 붙여넣기 또는 드래그 가능</span></div>
          </>
        ) : (
          <>
            <span className="upload-plus">+</span>
            <div className="upload-copy"><b>이미지 드롭·붙여넣기 영역</b><span>PNG 투명 배경 권장 · Ctrl+V 가능</span></div>
          </>
        )}
      </div>
      <div className="upload-actions">
        <button className="file-button" type="button" onClick={() => inputRef.current?.click()}>파일 선택</button>
        <button className="paste-button" type="button" onClick={() => onPaste(assetKey)}>클립보드 붙여넣기 <kbd>Ctrl</kbd><b>+</b><kbd>V</kbd></button>
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>{label}<b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function CopyAlignSelect({ label, value, disabled = false, onChange }: {
  label: string;
  value: CopyAlign;
  disabled?: boolean;
  onChange: (value: CopyAlign) => void;
}) {
  return (
    <select
      className="copy-align-select"
      aria-label={`${label} 정렬`}
      title={`${label} 정렬`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as CopyAlign)}
    >
      <option value="left">좌</option>
      <option value="center">중앙</option>
      <option value="right">우</option>
    </select>
  );
}

const TYPE_COPY = {
  badge: {
    number: "01",
    title: "배지 플래그형",
    summary: "혜택 배지를 한쪽 끝에 고정하고 오브젝트를 좌·우 정렬하는 구성",
  },
  center: {
    number: "02",
    title: "중앙 오브젝트형",
    summary: "오브젝트를 중앙에 두고 좌·우 카피를 균형 있게 배치하는 구성",
  },
} satisfies Record<TemplateType, { number: string; title: string; summary: string }>;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin1X: number; origin1Y: number; origin2X: number; origin2Y: number; layer: ActiveLayer; moved: boolean; cycleOnClick: boolean } | null>(null);
  const templateDraftsRef = useRef<Record<TemplateType, TemplateDraft>>({
    badge: { ...DEFAULT_TEMPLATE_DRAFTS.badge },
    center: { ...DEFAULT_TEMPLATE_DRAFTS.center },
  });
  const templateAssetsRef = useRef<Record<TemplateType, Record<ProductAssetKey, AssetState>>>({
    badge: { product: EMPTY_ASSET, product2: EMPTY_ASSET },
    center: { product: EMPTY_ASSET, product2: EMPTY_ASSET },
  });
  const [template, setTemplate] = useState<TemplateType>("badge");
  const [objectSide, setObjectSide] = useState<ObjectSide>("right");
  const [product, setProduct] = useState<AssetState>(EMPTY_ASSET);
  const [product2, setProduct2] = useState<AssetState>(EMPTY_ASSET);
  const [advertiser, setAdvertiser] = useState<AssetState>(EMPTY_ASSET);
  const [mainCopy, setMainCopy] = useState("쫀득쫀득 촉감의 매력");
  const [subCopy, setSubCopy] = useState("오늘만 10% 추가적립");
  const [centerLeftSub, setCenterLeftSub] = useState("오늘만 10% 추가적립");
  const [centerRightSub, setCenterRightSub] = useState("니니즈 스페셜 필로우");
  const [subCopyEnabled, setSubCopyEnabled] = useState(true);
  const [centerLeftSubEnabled, setCenterLeftSubEnabled] = useState(false);
  const [centerRightSubEnabled, setCenterRightSubEnabled] = useState(false);
  const [mainFontSize, setMainFontSize] = useState(DEFAULT_MAIN_FONT_SIZE);
  const [subFontSize, setSubFontSize] = useState(DEFAULT_SUB_FONT_SIZE);
  const [mainAlign, setMainAlign] = useState<CopyAlign>("left");
  const [subAlign, setSubAlign] = useState<CopyAlign>("left");
  const [centerLeftMainAlign, setCenterLeftMainAlign] = useState<CopyAlign>("left");
  const [centerRightMainAlign, setCenterRightMainAlign] = useState<CopyAlign>("right");
  const [centerLeftSubAlign, setCenterLeftSubAlign] = useState<CopyAlign>("left");
  const [centerRightSubAlign, setCenterRightSubAlign] = useState<CopyAlign>("right");
  const [advertiserText, setAdvertiserText] = useState("J.ESTINA");
  const [badgeText, setBadgeText] = useState("10%");
  const [background, setBackground] = useState("#F5F5F5");
  const [textColor, setTextColor] = useState("#4C4C4C");
  const [badgeColor, setBadgeColor] = useState("#FF3B00");
  const [productScale, setProductScale] = useState(100);
  const [productX, setProductX] = useState(0);
  const [productY, setProductY] = useState(0);
  const [product2Scale, setProduct2Scale] = useState(82);
  const [product2X, setProduct2X] = useState(62);
  const [product2Y, setProduct2Y] = useState(18);
  const [activeProduct, setActiveProduct] = useState<ActiveLayer>("product");
  const [groupScaleOffset, setGroupScaleOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [notice, setNotice] = useState("");
  const [inquiry, setInquiry] = useState("");
  const [saveStatus, setSaveStatus] = useState("자동 저장 준비 중");
  const [fileBytes, setFileBytes] = useState<number | null>(null);
  const [layoutIssues, setLayoutIssues] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  const bg = normalizeHex(background, "#F5F5F5");
  const flagColor = normalizeHex(badgeColor, "#FF3B00");
  const currentProductBox = getProductBox(template, objectSide);
  const productRect = getVisibleImageRect(product.image, currentProductBox, productScale, productX, productY);
  const product2Rect = getVisibleImageRect(product2.image, currentProductBox, product2Scale, product2X, product2Y);

  const draw = useCallback(() => {
    if (!fontsReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const productBox = getProductBox(template, objectSide);
    if (product.image) drawContainedImage(ctx, product.image, productBox, productScale, productX, productY);
    if (product2.image) drawContainedImage(ctx, product2.image, productBox, product2Scale, product2X, product2Y);

    const copyLines = getCopyLines(ctx, template, objectSide, mainCopy, subCopy, centerLeftSub, centerRightSub, subCopyEnabled, centerLeftSubEnabled, centerRightSubEnabled, mainFontSize, subFontSize, {
      mainAlign, subAlign, centerLeftMainAlign, centerRightMainAlign, centerLeftSubAlign, centerRightSubAlign,
    });
    for (const line of copyLines) {
      if (!line.text) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(line.clipArea.x, line.clipArea.y, line.clipArea.width, line.clipArea.height);
      ctx.clip();
      ctx.fillStyle = line.color;
      ctx.textAlign = line.align;
      ctx.textBaseline = "alphabetic";
      ctx.font = `${line.weight} ${line.size}px Pretendard, "Noto Sans KR", sans-serif`;
      ctx.fillText(line.text, line.x, line.baseline);
      ctx.restore();
    }

    if (template === "badge") {
      const advertiserX = objectSide === "right" ? SAFE_AREA.x + SAFE_AREA.width - 2 : SAFE_AREA.x + 2;
      drawAdvertiser(ctx, advertiser, advertiserText, advertiserX, 226, objectSide === "right" ? "right" : "left");

      const flagX = objectSide === "right"
        ? SAFE_AREA.x + SAFE_AREA.width - 64
        : SAFE_AREA.x;
      ctx.fillStyle = flagColor;
      traceBadgeFlag(ctx, flagX);
      ctx.fill();
      ctx.save();
      traceBadgeFlag(ctx, flagX);
      ctx.clip();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 26px Pretendard, 'Noto Sans KR', sans-serif";
      ctx.fillText(badgeText.trim() || "10%", flagX + 32, 28);
      ctx.restore();
    } else {
      drawAdvertiser(ctx, advertiser, advertiserText, SAFE_AREA.x + SAFE_AREA.width - 2, 42, "right");
    }
  }, [advertiser, advertiserText, badgeText, bg, centerLeftMainAlign, centerLeftSub, centerLeftSubAlign, centerLeftSubEnabled, centerRightMainAlign, centerRightSub, centerRightSubAlign, centerRightSubEnabled, flagColor, fontsReady, mainAlign, mainCopy, mainFontSize, objectSide, product.image, product2.image, product2Scale, product2X, product2Y, productScale, productX, productY, subAlign, subCopy, subCopyEnabled, subFontSize, template]);

  const validateLayout = useCallback(() => {
    const issues: string[] = [];
    const productBox = getProductBox(template, objectSide);
    const firstRect = getVisibleImageRect(product.image, productBox, productScale, productX, productY);
    const secondRect = getVisibleImageRect(product2.image, productBox, product2Scale, product2X, product2Y);

    if (template === "badge") {
      const flagCopy = badgeText.trim();
      const flagRect = {
        x: objectSide === "right" ? SAFE_AREA.x + SAFE_AREA.width - 64 : SAFE_AREA.x,
        y: 0,
        width: 64,
        height: 78,
      };
      if ([firstRect, secondRect].some((rect) => rect && intersectsRect(rect, flagRect))) {
        issues.push("오브젝트와 배지 플래그가 겹칩니다. 이미지 크기나 위치를 조정하세요.");
      }
      if (!flagCopy || /\s/u.test(flagCopy)) issues.push("배지 플래그 문구는 띄어쓰기 없는 1어절로 입력하세요.");
      if (flagCopy && (!/^[\p{L}\p{N}%!+]+$/u.test(flagCopy) || /[%!+]{2,}/u.test(flagCopy))) {
        issues.push("배지 플래그 특수기호는 %, !, +만 사용할 수 있고 연속 기재할 수 없습니다.");
      }
    }
    return Array.from(new Set(issues));
  }, [badgeText, objectSide, product.image, product2.image, product2Scale, product2X, product2Y, productScale, productX, productY, template]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      document.fonts.load(`400 ${COPY_FONT_MAX}px Pretendard`),
      document.fonts.load(`700 ${COPY_FONT_MAX}px Pretendard`),
      document.fonts.load("800 26px Pretendard"),
    ]).finally(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    draw();
    if (canvasRef.current) setLayoutIssues(validateLayout());
    const timer = window.setTimeout(() => {
      canvasRef.current?.toBlob((blob) => setFileBytes(blob?.size ?? null), "image/png");
    }, 80);
    return () => window.clearTimeout(timer);
  }, [draw, validateLayout]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        let restoredTemplate: TemplateType = "badge";
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Settings>;
          const savedTemplate: TemplateType = saved.template === "center" ? "center" : "badge";
          restoredTemplate = savedTemplate;
          if (saved.templateDrafts?.badge && saved.templateDrafts?.center) {
            templateDraftsRef.current = {
              badge: mergeTemplateDraft("badge", saved.templateDrafts.badge),
              center: mergeTemplateDraft("center", saved.templateDrafts.center),
            };
          } else {
            templateDraftsRef.current[savedTemplate] = mergeTemplateDraft(savedTemplate, saved as Partial<TemplateDraft>);
          }
          setTemplate(savedTemplate);
          applyTemplateDraft(templateDraftsRef.current[savedTemplate]);
          if (typeof saved.showGuides === "boolean") setShowGuides(saved.showGuides);
          if (typeof saved.inquiry === "string") setInquiry(saved.inquiry);
        }
        const [badgeProduct, badgeProduct2, centerProduct, centerProduct2, legacyProduct, legacyProduct2, storedAdvertiser] = await Promise.all([
          readAsset("badge:product"), readAsset("badge:product2"), readAsset("center:product"), readAsset("center:product2"),
          readAsset("product"), readAsset("product2"), readAsset("advertiser"),
        ]);
        const prepareStored = (stored?: StoredAsset) => stored
          ? prepareAsset(new File([stored.blob], stored.name, { type: stored.type }))
          : Promise.resolve(null);
        const [nextBadgeProduct, nextBadgeProduct2, nextCenterProduct, nextCenterProduct2, nextAdvertiser] = await Promise.all([
          prepareStored(badgeProduct ?? (restoredTemplate === "badge" ? legacyProduct : undefined)),
          prepareStored(badgeProduct2 ?? (restoredTemplate === "badge" ? legacyProduct2 : undefined)),
          prepareStored(centerProduct ?? (restoredTemplate === "center" ? legacyProduct : undefined)),
          prepareStored(centerProduct2 ?? (restoredTemplate === "center" ? legacyProduct2 : undefined)),
          storedAdvertiser
            ? prepareAsset(new File([storedAdvertiser.blob], storedAdvertiser.name, { type: storedAdvertiser.type }))
            : preparePublicAsset("/jestina-advertiser.png"),
        ]);
        if (cancelled) {
          if (nextBadgeProduct) revokeAssetUrl(nextBadgeProduct);
          if (nextBadgeProduct2) revokeAssetUrl(nextBadgeProduct2);
          if (nextCenterProduct) revokeAssetUrl(nextCenterProduct);
          if (nextCenterProduct2) revokeAssetUrl(nextCenterProduct2);
          if (nextAdvertiser) revokeAssetUrl(nextAdvertiser);
          return;
        }
        templateAssetsRef.current = {
          badge: { product: nextBadgeProduct ?? EMPTY_ASSET, product2: nextBadgeProduct2 ?? EMPTY_ASSET },
          center: { product: nextCenterProduct ?? EMPTY_ASSET, product2: nextCenterProduct2 ?? EMPTY_ASSET },
        };
        setProduct(templateAssetsRef.current[restoredTemplate].product);
        setProduct2(templateAssetsRef.current[restoredTemplate].product2);
        if (nextAdvertiser) setAdvertiser(nextAdvertiser);
      } catch {
        setNotice("이전 작업을 불러오지 못했습니다. 새 작업은 정상적으로 진행할 수 있습니다.");
      } finally {
        if (!cancelled) {
          setDraftReady(true);
          setSaveStatus("자동 저장됨");
        }
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const savingTimer = window.setTimeout(() => setSaveStatus("저장 중…"), 0);
    const timer = window.setTimeout(() => {
      const currentDraft: TemplateDraft = {
        objectSide, mainCopy, subCopy, centerLeftSub, centerRightSub, advertiserText, badgeText,
        subCopyEnabled, centerLeftSubEnabled, centerRightSubEnabled, mainFontSize, subFontSize,
        mainAlign, subAlign, centerLeftMainAlign, centerRightMainAlign, centerLeftSubAlign, centerRightSubAlign,
        background, textColor, badgeColor, productScale, productX, productY,
        product2Scale, product2X, product2Y, activeProduct, groupScaleOffset,
      };
      templateDraftsRef.current[template] = currentDraft;
      const settings: Settings = {
        template, objectSide, mainCopy, subCopy, centerLeftSub, centerRightSub, advertiserText, badgeText,
        subCopyEnabled, centerLeftSubEnabled, centerRightSubEnabled, mainFontSize, subFontSize,
        mainAlign, subAlign, centerLeftMainAlign, centerRightMainAlign, centerLeftSubAlign, centerRightSubAlign,
        background, textColor, badgeColor, productScale, productX, productY,
        product2Scale, product2X, product2Y, activeProduct, groupScaleOffset, showGuides, inquiry,
        templateDrafts: {
          badge: { ...templateDraftsRef.current.badge },
          center: { ...templateDraftsRef.current.center },
        },
      };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaveStatus(`자동 저장됨 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}`);
    }, 350);
    return () => {
      window.clearTimeout(savingTimer);
      window.clearTimeout(timer);
    };
  }, [activeProduct, advertiserText, background, badgeColor, badgeText, centerLeftMainAlign, centerLeftSub, centerLeftSubAlign, centerLeftSubEnabled, centerRightMainAlign, centerRightSub, centerRightSubAlign, centerRightSubEnabled, draftReady, groupScaleOffset, inquiry, mainAlign, mainCopy, mainFontSize, objectSide, product2Scale, product2X, product2Y, productScale, productX, productY, showGuides, subAlign, subCopy, subCopyEnabled, subFontSize, template, textColor]);

  function setAsset(key: AssetKey, file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    void prepareAsset(file).then(async (next) => {
      if (key === "advertiser") {
        setAdvertiser((current) => {
          revokeAssetUrl(current);
          return next;
        });
        await saveAsset("advertiser", file);
      } else {
        const setter = key === "product" ? setProduct : setProduct2;
        setter((current) => {
          revokeAssetUrl(current);
          return next;
        });
        templateAssetsRef.current[template][key] = next;
        await saveAsset(`${template}:${key}`, file);
        setActiveProduct(key);
      }
      setSaveStatus("자동 저장됨");
      setNotice(`${key === "advertiser" ? "광고주체 이미지" : key === "product2" ? "상품 이미지 2" : "상품 이미지 1"}를 적용했습니다.`);
    }).catch(() => setNotice("이미지 파일을 읽지 못했습니다. PNG, JPG 또는 WEBP 파일을 사용해주세요."));
  }

  async function pasteAsset(key: AssetKey) {
    if (!navigator.clipboard?.read) {
      setNotice("이 브라우저에서는 붙여넣기 버튼을 지원하지 않습니다. 업로드 영역을 선택한 뒤 Ctrl+V를 눌러주세요.");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((value) => value.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        setAsset(key, new File([blob], `${key}-${Date.now()}.${type.split("/")[1] || "png"}`, { type }));
        return;
      }
      setNotice("클립보드에서 이미지를 찾지 못했습니다.");
    } catch {
      setNotice("클립보드 접근이 허용되지 않았습니다. 업로드 영역에서 Ctrl+V를 사용해주세요.");
    }
  }

  function currentTemplateDraft(): TemplateDraft {
    return {
      objectSide, mainCopy, subCopy, centerLeftSub, centerRightSub, advertiserText, badgeText,
      subCopyEnabled, centerLeftSubEnabled, centerRightSubEnabled, mainFontSize, subFontSize,
      mainAlign, subAlign, centerLeftMainAlign, centerRightMainAlign, centerLeftSubAlign, centerRightSubAlign,
      background, textColor, badgeColor, productScale, productX, productY,
      product2Scale, product2X, product2Y, activeProduct, groupScaleOffset,
    };
  }

  function applyTemplateDraft(draft: TemplateDraft) {
    setObjectSide(draft.objectSide);
    setMainCopy(draft.mainCopy);
    setSubCopy(draft.subCopy);
    setCenterLeftSub(draft.centerLeftSub);
    setCenterRightSub(draft.centerRightSub);
    setSubCopyEnabled(draft.subCopyEnabled);
    setCenterLeftSubEnabled(draft.centerLeftSubEnabled);
    setCenterRightSubEnabled(draft.centerRightSubEnabled);
    setMainFontSize(Math.max(COPY_FONT_MIN, Math.min(COPY_FONT_MAX, draft.mainFontSize)));
    setSubFontSize(Math.max(COPY_FONT_MIN, Math.min(COPY_FONT_MAX, draft.subFontSize)));
    setMainAlign(draft.mainAlign);
    setSubAlign(draft.subAlign);
    setCenterLeftMainAlign(draft.centerLeftMainAlign);
    setCenterRightMainAlign(draft.centerRightMainAlign);
    setCenterLeftSubAlign(draft.centerLeftSubAlign);
    setCenterRightSubAlign(draft.centerRightSubAlign);
    setAdvertiserText(draft.advertiserText);
    setBadgeText(draft.badgeText);
    setBackground(draft.background);
    setTextColor(draft.textColor);
    setBadgeColor(draft.badgeColor);
    setProductScale(draft.productScale);
    setProductX(draft.productX);
    setProductY(draft.productY);
    setProduct2Scale(draft.product2Scale);
    setProduct2X(draft.product2X);
    setProduct2Y(draft.product2Y);
    setActiveProduct(draft.activeProduct);
    setGroupScaleOffset(draft.groupScaleOffset);
  }

  function changeTemplate(next: TemplateType) {
    if (next === template) return;
    templateDraftsRef.current[template] = currentTemplateDraft();
    templateAssetsRef.current[template] = { product, product2 };
    setTemplate(next);
    applyTemplateDraft(templateDraftsRef.current[next]);
    setProduct(templateAssetsRef.current[next].product);
    setProduct2(templateAssetsRef.current[next].product2);
    setNotice(`${TYPE_COPY[next].title}의 마지막 작업을 불러왔습니다.`);
  }

  function zoomActive(delta: number) {
    if (activeProduct === "product" && product.image) {
      setProductScale((value) => Math.max(55, Math.min(180, value + delta)));
      return;
    }
    if (activeProduct === "product2" && product2.image) {
      setProduct2Scale((value) => Math.max(40, Math.min(180, value + delta)));
      return;
    }
    if (activeProduct === "both" && product.image && product2.image) {
      setProductScale((value) => Math.max(55, Math.min(180, value + delta)));
      setProduct2Scale((value) => Math.max(40, Math.min(180, value + delta)));
    }
  }

  function changeGroupScaleOffset(next: number) {
    const delta = next - groupScaleOffset;
    setProductScale((value) => Math.max(55, Math.min(180, value + delta)));
    setProduct2Scale((value) => Math.max(40, Math.min(180, value + delta)));
    setGroupScaleOffset(next);
  }

  function wheelObjectZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if (!product.image && !product2.image) return;
    event.preventDefault();
    zoomActive(event.deltaY < 0 ? 4 : -4);
  }

  function startObjectDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const surface = event.currentTarget.getBoundingClientRect();
    const pointX = (event.clientX - surface.left) * (WIDTH / surface.width);
    const pointY = (event.clientY - surface.top) * (HEIGHT / surface.height);
    const hitLayers: ProductLayer[] = [];
    if (pointInRect(pointX, pointY, productRect)) hitLayers.push("product");
    if (pointInRect(pointX, pointY, product2Rect)) hitLayers.push("product2");

    let layer: ActiveLayer | null = null;
    let cycleOnClick = false;
    if (hitLayers.length === 1) {
      layer = hitLayers[0];
    } else if (hitLayers.length === 2) {
      if (activeProduct === "product" || activeProduct === "product2") {
        layer = activeProduct;
        cycleOnClick = true;
      } else {
        layer = "product2";
      }
    } else {
      layer = activeProduct === "both" && product.image && product2.image
        ? "both"
        : activeProduct === "product2" && product2.image
          ? "product2"
          : product.image
            ? "product"
            : product2.image
              ? "product2"
              : null;
    }
    if (!layer) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin1X: productX,
      origin1Y: productY,
      origin2X: product2X,
      origin2Y: product2Y,
      layer,
      moved: false,
      cycleOnClick,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveProduct(layer);
    setIsDragging(true);
    event.preventDefault();
  }

  function moveObjectDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - drag.startX) * (WIDTH / rect.width);
    const deltaY = (event.clientY - drag.startY) * (HEIGHT / rect.height);
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) drag.moved = true;
    if (drag.layer === "product" || drag.layer === "both") {
      setProductX(Math.round(Math.max(-120, Math.min(120, drag.origin1X + deltaX))));
      setProductY(Math.round(Math.max(-90, Math.min(90, drag.origin1Y + deltaY))));
    }
    if (drag.layer === "product2" || drag.layer === "both") {
      setProduct2X(Math.round(Math.max(-150, Math.min(150, drag.origin2X + deltaX))));
      setProduct2Y(Math.round(Math.max(-100, Math.min(100, drag.origin2Y + deltaY))));
    }
  }

  function endObjectDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (!drag.moved && drag.cycleOnClick) {
      setActiveProduct(drag.layer === "product" ? "product2" : "product");
    }
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function reset() {
    const productAssets = [product, product2, ...Object.values(templateAssetsRef.current).flatMap((assets) => [assets.product, assets.product2])];
    new Set(productAssets.map((asset) => asset.url).filter((url) => url.startsWith("blob:"))).forEach((url) => URL.revokeObjectURL(url));
    revokeAssetUrl(advertiser);
    setProduct(EMPTY_ASSET);
    setProduct2(EMPTY_ASSET);
    setAdvertiser(EMPTY_ASSET);
    templateDraftsRef.current = {
      badge: { ...DEFAULT_TEMPLATE_DRAFTS.badge },
      center: { ...DEFAULT_TEMPLATE_DRAFTS.center },
    };
    templateAssetsRef.current = {
      badge: { product: EMPTY_ASSET, product2: EMPTY_ASSET },
      center: { product: EMPTY_ASSET, product2: EMPTY_ASSET },
    };
    setTemplate("badge");
    setObjectSide("right");
    setMainCopy("쫀득쫀득 촉감의 매력");
    setSubCopy("오늘만 10% 추가적립");
    setCenterLeftSub("");
    setCenterRightSub("");
    setSubCopyEnabled(true);
    setCenterLeftSubEnabled(false);
    setCenterRightSubEnabled(false);
    setMainFontSize(DEFAULT_MAIN_FONT_SIZE);
    setSubFontSize(DEFAULT_SUB_FONT_SIZE);
    setMainAlign("left");
    setSubAlign("left");
    setCenterLeftMainAlign("left");
    setCenterRightMainAlign("right");
    setCenterLeftSubAlign("left");
    setCenterRightSubAlign("right");
    setAdvertiserText("J.ESTINA");
    setBadgeText("10%");
    setBackground("#F5F5F5");
    setTextColor("#4C4C4C");
    setBadgeColor("#FF3B00");
    setProductScale(100);
    setProductX(0);
    setProductY(0);
    setProduct2Scale(82);
    setProduct2X(62);
    setProduct2Y(18);
    setActiveProduct("product");
    setGroupScaleOffset(0);
    setShowGuides(true);
    setInquiry("");
    setNotice("초기화했습니다.");
    window.localStorage.removeItem(SETTINGS_KEY);
    void clearAssets()
      .then(() => preparePublicAsset("/jestina-advertiser.png"))
      .then(setAdvertiser)
      .catch(() => setNotice("기본 광고주체 이미지를 불러오지 못했습니다."));
  }

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!complete) {
      setNotice("상품 이미지·카피·광고주체를 먼저 입력해주세요.");
      return;
    }
    if (layoutIssues.length) {
      setNotice(layoutIssues[0]);
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    if (blob.size > MAX_FILE_BYTES) {
      setNotice(`PNG 용량이 ${Math.ceil(blob.size / 1024)}KB입니다. 공식 상한 300KB 이하로 이미지 크기나 수를 조정해주세요.`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kakao-bizboard-${template}-1029x258.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("공식 규격 PNG 파일을 저장했습니다.");
  }

  function sendInquiry() {
    const message = inquiry.trim();
    if (!message) {
      setNotice("문의 내용을 입력해주세요.");
      return;
    }
    const subject = encodeURIComponent(`[Kakao Maker 문의] ${typeInfo.title}`);
    const body = encodeURIComponent(`안녕하세요. Kakao Maker 관련 문의드립니다.\n\n${message}\n\n선택한 제작 유형: ${typeInfo.title}`);
    window.location.href = `mailto:somin.jo@playd.com?subject=${subject}&body=${body}`;
    setNotice("메일 앱을 열었습니다. 내용을 확인한 뒤 최종 발송해주세요.");
  }

  const hasCopy = template === "badge"
    ? Boolean(mainCopy.trim() || subCopy.trim())
    : Boolean(mainCopy.trim() || subCopy.trim() || centerLeftSub.trim() || centerRightSub.trim());
  const complete = Boolean((product.image || product2.image) && (advertiser.image || advertiserText.trim()) && hasCopy);
  const fileTooLarge = fileBytes !== null && fileBytes > MAX_FILE_BYTES;
  const readyToDownload = complete && layoutIssues.length === 0 && fileBytes !== null && !fileTooLarge;
  const typeInfo = TYPE_COPY[template];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Kakao Maker 홈"><span className="brand-mark">K</span><b>KAKAO MAKER</b></a>
        <div className="topbar-meta"><span>KAKAO BIZBOARD</span><i /> <span>1029 × 258</span></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">BIZBOARD CREATIVE TOOL</span>
          <h1>카카오 비즈보드,<br /><em>가이드 안에서 자유롭게.</em></h1>
          <p>유형을 선택하고 카피와 이미지를 넣으면 공식 심사 기준을 실시간 점검해<br className="desktop-only" /> 1029×258 소재로 저장할 수 있습니다.</p>
        </div>
        <div className="hero-spec">
          <div><span>CANVAS</span><b>1029 × 258</b><small>공식 완성 규격</small></div>
          <div><span>SAFE AREA</span><b>933 × 258</b><small>내부 지정 영역</small></div>
          <div><span>OBJECT</span><b>438 × 258</b><small>오브젝트 최대 영역</small></div>
        </div>
      </section>

      <section className="type-section" aria-labelledby="type-title">
        <div className="section-heading"><span>STEP 01</span><div><h2 id="type-title">제작 유형 선택</h2><p>유형마다 오브젝트와 광고주체의 허용 위치가 다릅니다.</p></div></div>
        <div className="type-grid">
          {(Object.keys(TYPE_COPY) as TemplateType[]).map((key) => (
            <button key={key} type="button" className={`type-card ${template === key ? "active" : ""}`} onClick={() => changeTemplate(key)} aria-pressed={template === key}>
              <span>{TYPE_COPY[key].number}</span>
              <div className={`mini-creative ${key}`}><i className="mini-copy" /><i className="mini-object" />{key === "badge" && <i className="mini-badge" />}</div>
              <strong>{TYPE_COPY[key].title}</strong>
              <small>{TYPE_COPY[key].summary}</small>
              <b>{template === key ? "선택됨" : "이 유형으로 제작"}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="maker-section" aria-labelledby="maker-title">
        <div className="section-heading maker-heading"><span>STEP 02</span><div><h2 id="maker-title">{typeInfo.title} 제작</h2><p>{typeInfo.summary}</p></div>
          <details className="maker-contact-compact">
            <summary>문의·추가 요청 <b>somin.jo@playd.com</b></summary>
            <div className="maker-contact-popover">
              <p>문의사항 및 추가 요청 사항은 <a href="mailto:somin.jo@playd.com">somin.jo@playd.com</a>으로 연락바랍니다.</p>
              <div className="maker-contact-form">
                <label htmlFor="maker-inquiry" className="visually-hidden">문의 내용</label>
                <textarea id="maker-inquiry" value={inquiry} maxLength={1000} placeholder="문의 또는 추가 요청 사항을 입력해주세요." onChange={(event) => setInquiry(event.target.value)} />
                <button type="button" onClick={sendInquiry} disabled={!inquiry.trim()}>문의 발송</button>
              </div>
            </div>
          </details>
          </div>
        <div className="maker-shell">
          <aside className="control-panel">
            <div className="panel-title"><div><span>INPUT</span><h3>소재 구성</h3></div><div className="panel-actions"><span className={saveStatus.startsWith("저장 중") ? "save-status saving" : "save-status"}>{saveStatus}</span><button type="button" onClick={reset}>전체 초기화</button></div></div>

            {template === "badge" && (
              <div className="field-block compact">
                <div className="field-heading"><div><strong>오브젝트 정렬</strong><span>플래그는 바깥쪽 끝에 자동 배치</span></div></div>
                <div className="segmented">
                  <button type="button" className={objectSide === "left" ? "active" : ""} onClick={() => setObjectSide("left")}>좌측 오브젝트</button>
                  <button type="button" className={objectSide === "right" ? "active" : ""} onClick={() => setObjectSide("right")}>우측 오브젝트</button>
                </div>
              </div>
            )}

            <UploadField label="상품 이미지 1" hint="투명 배경 PNG 권장" asset={product} assetKey="product" onFile={setAsset} onPaste={pasteAsset} />
            <div className="adjust-box">
              <div className="adjust-heading"><strong>이미지 1 조절</strong><button type="button" onClick={() => { setProductScale(100); setProductX(0); setProductY(0); }}>조절값 초기화</button></div>
              <RangeField label="크기" value={productScale} min={55} max={180} unit="%" onChange={setProductScale} />
              <RangeField label="가로 위치" value={productX} min={-120} max={120} unit="px" onChange={setProductX} />
              <RangeField label="세로 위치" value={productY} min={-90} max={90} unit="px" onChange={setProductY} />
            </div>

            <UploadField label="상품 이미지 2" hint="선택 입력 · 이미지 1 위에 배치" asset={product2} assetKey="product2" onFile={setAsset} onPaste={pasteAsset} />
            <div className="adjust-box second-layer">
              <div className="adjust-heading"><strong>이미지 2 조절</strong><button type="button" onClick={() => { setProduct2Scale(82); setProduct2X(62); setProduct2Y(18); }}>조절값 초기화</button></div>
              <p className="layer-note">이미지 2는 이미지 1 위에 그려져 겹침 구성을 만들 수 있습니다.</p>
              <RangeField label="크기" value={product2Scale} min={40} max={180} unit="%" onChange={setProduct2Scale} />
              <RangeField label="가로 위치" value={product2X} min={-150} max={150} unit="px" onChange={setProduct2X} />
              <RangeField label="세로 위치" value={product2Y} min={-100} max={100} unit="px" onChange={setProduct2Y} />
            </div>

            {product.image && product2.image && (
              <div className="adjust-box group-adjust">
                <div className="adjust-heading"><strong>두 이미지 함께 조절</strong><button type="button" onClick={() => changeGroupScaleOffset(0)}>공용 크기 초기화</button></div>
                <p className="layer-note">두 이미지의 현재 크기 차이를 유지한 채 함께 확대·축소합니다.</p>
                <RangeField label="함께 크기" value={groupScaleOffset} min={-40} max={40} unit="%" onChange={changeGroupScaleOffset} />
              </div>
            )}

            {template === "badge" && (
              <div className="field-block">
                <div className="field-heading"><div><strong>배지 플래그</strong><span>혜택 정보 1어절 · 특수기호 %, !, +만 허용</span></div></div>
                <div className="inline-fields"><label className="text-input"><span>문구</span><input value={badgeText} onChange={(event) => setBadgeText(event.target.value)} /></label><label className="color-input"><input type="color" value={flagColor} onChange={(event) => setBadgeColor(event.target.value)} /><input value={badgeColor} onChange={(event) => setBadgeColor(event.target.value)} aria-label="배지 색상 코드" /></label></div>
              </div>
            )}

            <div className="field-block">
              <div className="field-heading"><div><strong>광고주체 표기</strong><span>제이에스티나 로고가 기본 적용됩니다.</span></div></div>
              <label className="text-input"><span>명칭</span><input value={advertiserText} maxLength={24} onChange={(event) => setAdvertiserText(event.target.value)} /></label>
              <UploadField label="워드마크 / 로고" hint="기본값 · J.ESTINA" asset={advertiser} assetKey="advertiser" onFile={setAsset} onPaste={pasteAsset} />
            </div>

            <div className="field-block compact">
              <div className="field-heading"><div><strong>색상</strong><span>카피 컬러는 메이커 권장값으로 적용됩니다.</span></div></div>
              <div className="color-grid compliant-colors">
                <label><span>배경</span><div><input type="color" value={bg} onChange={(event) => setBackground(event.target.value)} /><input value={background} onChange={(event) => setBackground(event.target.value)} /></div></label>
                <div className="locked-copy-colors"><span>카피 기본</span><b><i style={{ background: MAIN_COPY_COLOR }} />메인 {MAIN_COPY_COLOR}</b><b><i style={{ background: SUB_COPY_COLOR }} />서브 {SUB_COPY_COLOR}</b></div>
              </div>
            </div>
          </aside>

          <div className="preview-panel">
            <div className="preview-title"><div><span>LIVE PREVIEW</span><h3>{typeInfo.title}</h3></div>{template === "center" && <span className="center-area-chip">좌측 카피 · 중앙 오브젝트 · 우측 카피</span>}<label><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /> 가이드 영역</label></div>
            <div className="preview-copy-editor">
              <div className="preview-copy-heading">
                <div><strong>카피 바로 입력</strong><span>메인·서브 각각 39~51pt · 1pt 단위</span></div>
                <div className="copy-size-controls" aria-label="카피 글자 크기 조절">
                  <label><span>메인</span><input type="range" min={COPY_FONT_MIN} max={COPY_FONT_MAX} step={1} value={mainFontSize} aria-label={`메인카피 글자 크기 ${mainFontSize}pt`} onChange={(event) => setMainFontSize(Number(event.target.value))} /><b>{mainFontSize}pt</b></label>
                  <label><span>서브</span><input type="range" min={COPY_FONT_MIN} max={COPY_FONT_MAX} step={1} value={subFontSize} aria-label={`서브카피 글자 크기 ${subFontSize}pt`} onChange={(event) => setSubFontSize(Number(event.target.value))} /><b>{subFontSize}pt</b></label>
                </div>
              </div>
              <div className={`preview-copy-grid ${template}`}>
                {template === "center" ? (
                  <>
                    <div className="copy-control-field"><label><span>좌측 메인</span><input value={mainCopy} onChange={(event) => setMainCopy(event.target.value)} /></label><CopyAlignSelect label="좌측 메인카피" value={centerLeftMainAlign} onChange={setCenterLeftMainAlign} /></div>
                    <div className="copy-control-field"><label><span>우측 메인</span><input value={subCopy} onChange={(event) => setSubCopy(event.target.value)} /></label><CopyAlignSelect label="우측 메인카피" value={centerRightMainAlign} onChange={setCenterRightMainAlign} /></div>
                    <div className={`copy-control-field ${centerLeftSubEnabled ? "" : "off"}`}><label><span>좌측 서브</span><input value={centerLeftSub} disabled={!centerLeftSubEnabled} placeholder="서브카피를 켜주세요" onChange={(event) => setCenterLeftSub(event.target.value)} /></label><div className="copy-field-actions"><button className="copy-use-toggle" type="button" aria-pressed={centerLeftSubEnabled} onClick={() => setCenterLeftSubEnabled((enabled) => !enabled)}>{centerLeftSubEnabled ? "ON" : "OFF"}</button><CopyAlignSelect label="좌측 서브카피" value={centerLeftSubAlign} disabled={!centerLeftSubEnabled} onChange={setCenterLeftSubAlign} /></div></div>
                    <div className={`copy-control-field ${centerRightSubEnabled ? "" : "off"}`}><label><span>우측 서브</span><input value={centerRightSub} disabled={!centerRightSubEnabled} placeholder="서브카피를 켜주세요" onChange={(event) => setCenterRightSub(event.target.value)} /></label><div className="copy-field-actions"><button className="copy-use-toggle" type="button" aria-pressed={centerRightSubEnabled} onClick={() => setCenterRightSubEnabled((enabled) => !enabled)}>{centerRightSubEnabled ? "ON" : "OFF"}</button><CopyAlignSelect label="우측 서브카피" value={centerRightSubAlign} disabled={!centerRightSubEnabled} onChange={setCenterRightSubAlign} /></div></div>
                  </>
                ) : (
                  <>
                    <div className="copy-control-field"><label><span>메인카피</span><input value={mainCopy} onChange={(event) => setMainCopy(event.target.value)} /></label><CopyAlignSelect label="메인카피" value={mainAlign} onChange={setMainAlign} /></div>
                    <div className={`copy-control-field ${subCopyEnabled ? "" : "off"}`}><label><span>서브카피</span><input value={subCopy} disabled={!subCopyEnabled} placeholder="서브카피를 켜주세요" onChange={(event) => setSubCopy(event.target.value)} /></label><div className="copy-field-actions"><button className="copy-use-toggle" type="button" aria-pressed={subCopyEnabled} onClick={() => setSubCopyEnabled((enabled) => !enabled)}>{subCopyEnabled ? "ON" : "OFF"}</button><CopyAlignSelect label="서브카피" value={subAlign} disabled={!subCopyEnabled} onChange={setSubAlign} /></div></div>
                  </>
                )}
              </div>
            </div>
            <div className="drag-toolbar">
              <span>미리보기에서 이동할 이미지</span>
              <div className="layer-selector">
                <button type="button" disabled={!product.image} className={activeProduct === "product" ? "active" : ""} onClick={() => setActiveProduct("product")}>이미지 1</button>
                <button type="button" disabled={!product2.image} className={activeProduct === "product2" ? "active" : ""} onClick={() => setActiveProduct("product2")}>이미지 2</button>
                <button type="button" disabled={!product.image || !product2.image} className={activeProduct === "both" ? "active" : ""} onClick={() => setActiveProduct("both")}>두 이미지 함께</button>
              </div>
              <div className="zoom-controls">
                <button type="button" onClick={() => zoomActive(-5)} aria-label="선택 이미지 축소">−</button>
                <b>{activeProduct === "product" ? productScale : activeProduct === "product2" ? product2Scale : `${productScale}·${product2Scale}`}%</b>
                <button type="button" onClick={() => zoomActive(5)} aria-label="선택 이미지 확대">+</button>
              </div>
              <small>이미지를 클릭해 선택 · 겹친 곳은 반복 클릭 · 드래그로 이동</small>
            </div>
            <div className="preview-stage">
              <div className="creative-frame">
                <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="카카오 비즈보드 소재 미리보기" />
                {!product.image && !product2.image && <div className={`product-placeholder ${template} ${objectSide}`}>상품 이미지 1 · 2</div>}
                <div
                  className={`canvas-drag-surface ${isDragging ? "dragging" : ""}`}
                  onPointerDown={startObjectDrag}
                  onPointerMove={moveObjectDrag}
                  onPointerUp={endObjectDrag}
                  onPointerCancel={endObjectDrag}
                  onWheel={wheelObjectZoom}
                  aria-label={`${activeProduct === "product" ? "상품 이미지 1" : activeProduct === "product2" ? "상품 이미지 2" : "두 상품 이미지"} 이동 및 확대 영역`}
                />
                {showGuides && (
                  <div className={`guide-overlay ${template} ${objectSide}`}>
                    <div className="guide-safe"><span>내부 지정영역 933×258</span></div>
                    {template === "center" ? (
                      <>
                        <div className="guide-copy left"><span>좌측 카피 안전영역</span></div>
                        <div className="guide-copy right"><span>우측 카피 안전영역</span></div>
                        <div className="guide-gap left"><span>33px</span></div>
                        <div className="guide-gap right"><span>33px</span></div>
                      </>
                    ) : (
                      <>
                        <div className="guide-copy"><span>카피 안전영역</span></div>
                        <div className="guide-gap"><span>33px</span></div>
                      </>
                    )}
                    <div className="guide-object"><span>오브젝트 최대영역 438×258</span>{template === "center" && <i className="object-half-line"><b>배너 중앙</b></i>}</div>
                    <div className="guide-ad"><span>광고주체</span></div>
                    {template === "badge" && <div className="guide-flag"><span>배지</span></div>}
                  </div>
                )}
                {showGuides && (activeProduct === "product" || activeProduct === "both") && productRect && (
                  <div className="image-selection image-one" style={{ left: `${productRect.x / WIDTH * 100}%`, top: `${productRect.y / HEIGHT * 100}%`, width: `${productRect.width / WIDTH * 100}%`, height: `${productRect.height / HEIGHT * 100}%` }}><span>이미지 1 선택</span></div>
                )}
                {showGuides && (activeProduct === "product2" || activeProduct === "both") && product2Rect && (
                  <div className="image-selection image-two" style={{ left: `${product2Rect.x / WIDTH * 100}%`, top: `${product2Rect.y / HEIGHT * 100}%`, width: `${product2Rect.width / WIDTH * 100}%`, height: `${product2Rect.height / HEIGHT * 100}%` }}><span>이미지 2 선택</span></div>
                )}
              </div>
            </div>
            {showGuides && (
              <div className="guide-legend" role="note">
                <span className="copy-key"><i />주황: 카피 안전영역</span>
                <span className="object-key"><i />파랑: 오브젝트 최대영역</span>
                <span className="gap-key"><i />노랑: 최소 간격 33px</span>
                <b>텍스트와 오브젝트는 각 허용영역 밖으로 나간 부분이 자동으로 잘립니다.</b>
              </div>
            )}
            <div className="preview-meta">
              <div className={`status ${readyToDownload ? "complete" : complete ? "error" : "pending"}`}><i /><div><b>{readyToDownload ? "기본 심사 항목 통과" : complete ? "수정이 필요한 항목이 있습니다" : "필수 요소를 입력해주세요"}</b><small>{readyToDownload ? "1029×258 PNG로 저장할 수 있습니다." : complete ? (layoutIssues[0] ?? (fileTooLarge ? "PNG 용량을 300KB 이하로 줄여주세요." : "PNG를 점검하고 있습니다.")) : "상품 이미지 · 카피 · 광고주체가 필요합니다."}</small></div></div>
              <div className={`file-info ${fileTooLarge ? "too-large" : ""}`}><span>PNG 예상 용량 · 최대 300KB</span><b>{fileBytes === null ? "계산 중" : `${Math.ceil(fileBytes / 1024)} KB`}</b></div>
            </div>
            {layoutIssues.length > 0 && <div className="compliance-alert" role="alert"><b>가이드 점검</b><ul>{layoutIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            {notice && <p className="notice" role="status">{notice}</p>}
            <div className="download-row"><span>공식 포맷 PNG-24/32 · JPG 저장 미지원</span><button className="primary" type="button" onClick={() => void download()} disabled={!readyToDownload}><span>PNG 소재 저장</span><small>1029 × 258</small></button></div>
          </div>
        </div>
      </section>

      <section className="guideline-section" aria-labelledby="guide-title">
        <div className="section-heading light"><span>GUIDE</span><div><h2 id="guide-title">{typeInfo.title} 제작 가이드</h2><p>현재 선택한 유형에 적용되는 핵심 심사 기준입니다.</p></div></div>
        <div className="guide-cards">
          <article><span>01</span><h3>광고주체 표기</h3>{template === "badge" ? <ul><li>기존 오브젝트 영역 안에서 반드시 표기합니다.</li><li>오브젝트 좌·우 정렬에 맞춰 하단 끝에 배치합니다.</li><li>카피·오브젝트의 가독성을 침범하지 않는 크기로 구성합니다.</li></ul> : <ul><li>중앙 오브젝트형에 한해 카피 영역 내 표기가 허용됩니다.</li><li>지정 영역 좌측 최상단 또는 우측 최상단 정렬만 가능합니다.</li><li>영역 내 자유 배치나 카피·오브젝트와의 밀착은 불가합니다.</li></ul>}</article>
          <article><span>02</span><h3>카피 가이드</h3>{template === "badge" ? <ul><li>메인·서브 카피는 각각 최대 1줄입니다.</li><li>메인은 Pretendard Bold, 39~51pt, #4C4C4C입니다.</li><li>서브는 Pretendard Regular, 39~51pt, #777777입니다.</li><li>서브는 ON/OFF할 수 있으며 배지 플래그는 1어절로 구성합니다.</li></ul> : <ul><li>좌·우 메인과 좌·우 서브는 각각 최대 1줄입니다.</li><li>메인·서브 모두 39~51pt 범위에서 1pt 단위로 조절합니다.</li><li>같은 카피 유형은 좌우 크기·굵기·색상을 동일하게 적용합니다.</li><li>좌·우 서브는 각각 ON/OFF하고 모든 카피의 정렬을 선택할 수 있습니다.</li></ul>}</article>
          <article><span>03</span><h3>오브젝트·출력 가이드</h3>{template === "badge" ? <ul><li>완성 규격은 1029×258, 내부 지정영역은 933×258입니다.</li><li>오브젝트는 좌측 또는 우측에 두며 중앙 배열은 불가합니다.</li><li>두 이미지를 합친 오브젝트 그룹은 최대 438×258입니다.</li><li>카피·오브젝트가 허용영역을 넘으면 바깥 부분은 자동으로 잘립니다.</li></ul> : <ul><li>완성 규격은 1029×258, 내부 지정영역은 933×258입니다.</li><li>오브젝트 그룹을 소재 중앙 최대영역 안에 배치합니다.</li><li>두 이미지를 합친 오브젝트 그룹은 최대 438×258입니다.</li><li>좌우 카피·오브젝트가 허용영역을 넘으면 바깥 부분은 자동으로 잘립니다.</li></ul>}</article>
        </div>
        <p className="review-note"><b>심사 유의사항</b> PNG-24/32, 300KB 이하로 등록해야 합니다. 본 완화 가이드는 카카오 제공 PSD 템플릿 사용을 전제로 하므로 최종 집행 전 PSD 템플릿과 모먼트 에셋 기준을 함께 확인하세요.</p>
      </section>

      <footer>
        <span>KAKAO MAKER</span>
        <p>카카오 비즈보드 PSD 제작 가이드 v2025.07.09 기준</p>
        <p>문의사항 및 추가 요청 사항은 <a href="mailto:somin.jo@playd.com">somin.jo@playd.com</a>으로 연락바랍니다.</p>
      </footer>
    </main>
  );
}
