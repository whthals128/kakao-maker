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

const WIDTH = 933;
const HEIGHT = 258;
const SETTINGS_KEY = "kakao-maker:settings:v1";
const DB_NAME = "kakao-maker-assets";
const STORE_NAME = "assets";

type TemplateType = "badge" | "center";
type ObjectSide = "left" | "right";
type AssetKey = "product" | "product2" | "advertiser";
type ActiveLayer = "product" | "product2" | "both";
type AssetState = { file: File | null; image: HTMLImageElement | null; url: string };
type StoredAsset = { blob: Blob; name: string; type: string };
type Settings = {
  template: TemplateType;
  objectSide: ObjectSide;
  mainCopy: string;
  subCopy: string;
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
  showGuides: boolean;
};

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

async function saveAsset(key: AssetKey, file: File) {
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

async function readAsset(key: AssetKey) {
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

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, preferred: number, weight = 700) {
  let size = preferred;
  while (size > 24) {
    ctx.font = `${weight} ${size}px Pretendard, "Noto Sans KR", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
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
        onChange={(event: ChangeEvent<HTMLInputElement>) => onFile(assetKey, event.target.files?.[0])}
      />
      <div
        className={`upload-box ${asset.url ? "has-file" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        onPaste={paste}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {asset.url ? (
          <>
            {/* Blob URL from a local upload. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={`${label} 미리보기`} />
            <div className="upload-copy"><b>{asset.file?.name ?? (assetKey === "advertiser" ? "제이에스티나 기본 로고" : "등록된 이미지")}</b><span>클릭하여 교체 · Ctrl+V 가능</span></div>
          </>
        ) : (
          <>
            <span className="upload-plus">+</span>
            <div className="upload-copy"><b>이미지 선택</b><span>PNG 투명 배경 권장 · 드래그 가능</span></div>
          </>
        )}
      </div>
      <button className="paste-button" type="button" onClick={() => onPaste(assetKey)}>클립보드 이미지 붙여넣기 <kbd>Ctrl</kbd><b>+</b><kbd>V</kbd></button>
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
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin1X: number; origin1Y: number; origin2X: number; origin2Y: number; layer: ActiveLayer } | null>(null);
  const [template, setTemplate] = useState<TemplateType>("badge");
  const [objectSide, setObjectSide] = useState<ObjectSide>("right");
  const [product, setProduct] = useState<AssetState>(EMPTY_ASSET);
  const [product2, setProduct2] = useState<AssetState>(EMPTY_ASSET);
  const [advertiser, setAdvertiser] = useState<AssetState>(EMPTY_ASSET);
  const [mainCopy, setMainCopy] = useState("니니즈 쫀득쫀득 촉감의 매력");
  const [subCopy, setSubCopy] = useState("오늘만 10% 추가적립");
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
  const [showGuides, setShowGuides] = useState(true);
  const [notice, setNotice] = useState("");
  const [fileBytes, setFileBytes] = useState<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const bg = normalizeHex(background, "#F5F5F5");
  const copyColor = normalizeHex(textColor, "#4C4C4C");
  const flagColor = normalizeHex(badgeColor, "#FF3B00");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (template === "badge") {
      const productBox = objectSide === "right"
        ? { x: 544, y: 0, width: 342, height: 258 }
        : { x: 47, y: 0, width: 342, height: 258 };
      const copyX = objectSide === "right" ? 47 : 886;
      const copyAlign: CanvasTextAlign = objectSide === "right" ? "left" : "right";
      const copyWidth = 500;

      if (product.image) drawContainedImage(ctx, product.image, productBox, productScale, productX, productY);
      if (product2.image) drawContainedImage(ctx, product2.image, productBox, product2Scale, product2X, product2Y);

      ctx.fillStyle = copyColor;
      ctx.textAlign = copyAlign;
      ctx.textBaseline = "alphabetic";
      const mainSize = fitFont(ctx, mainCopy, copyWidth, 43, 700);
      ctx.font = `700 ${mainSize}px Pretendard, "Noto Sans KR", sans-serif`;
      ctx.fillText(mainCopy.trim() || "메인카피", copyX, 118, copyWidth);
      const subSize = fitFont(ctx, subCopy, copyWidth, 32, 400);
      ctx.font = `400 ${subSize}px Pretendard, "Noto Sans KR", sans-serif`;
      ctx.fillText(subCopy.trim() || "서브카피", copyX, 166, copyWidth);

      const advertiserX = objectSide === "right" ? 884 : 49;
      drawAdvertiser(ctx, advertiser, advertiserText, advertiserX, 226, objectSide === "right" ? "right" : "left");

      const flagX = objectSide === "right" ? 841 : 29;
      ctx.fillStyle = flagColor;
      ctx.beginPath();
      ctx.moveTo(flagX, 0);
      ctx.lineTo(flagX + 64, 0);
      ctx.lineTo(flagX + 64, 58);
      ctx.lineTo(flagX + 32, 78);
      ctx.lineTo(flagX, 58);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 26px Pretendard, 'Noto Sans KR', sans-serif";
      ctx.fillText(badgeText.trim() || "10%", flagX + 32, 28, 58);
    } else {
      const productBox = { x: 248, y: 0, width: 438, height: 258 };
      if (product.image) drawContainedImage(ctx, product.image, productBox, productScale, productX, productY);
      if (product2.image) drawContainedImage(ctx, product2.image, productBox, product2Scale, product2X, product2Y);

      ctx.fillStyle = copyColor;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const leftSize = fitFont(ctx, mainCopy, 270, 40, 700);
      ctx.font = `700 ${leftSize}px Pretendard, "Noto Sans KR", sans-serif`;
      ctx.fillText(mainCopy.trim() || "좌측 카피", 47, 139, 270);
      ctx.textAlign = "right";
      const rightSize = fitFont(ctx, subCopy, 270, 40, 700);
      ctx.font = `700 ${rightSize}px Pretendard, "Noto Sans KR", sans-serif`;
      ctx.fillText(subCopy.trim() || "우측 카피", 886, 139, 270);
      drawAdvertiser(ctx, advertiser, advertiserText, 884, 42, "right");
    }
  }, [advertiser, advertiserText, badgeText, bg, copyColor, flagColor, mainCopy, objectSide, product.image, product2.image, product2Scale, product2X, product2Y, productScale, productX, productY, subCopy, template]);

  useEffect(() => {
    draw();
    const timer = window.setTimeout(() => {
      canvasRef.current?.toBlob((blob) => setFileBytes(blob?.size ?? null), "image/png");
    }, 80);
    return () => window.clearTimeout(timer);
  }, [draw]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Settings>;
          if (saved.template === "badge" || saved.template === "center") setTemplate(saved.template);
          if (saved.objectSide === "left" || saved.objectSide === "right") setObjectSide(saved.objectSide);
          if (typeof saved.mainCopy === "string") setMainCopy(saved.mainCopy);
          if (typeof saved.subCopy === "string") setSubCopy(saved.subCopy);
          if (typeof saved.advertiserText === "string") setAdvertiserText(saved.advertiserText);
          if (typeof saved.badgeText === "string") setBadgeText(saved.badgeText);
          if (typeof saved.background === "string") setBackground(saved.background);
          if (typeof saved.textColor === "string") setTextColor(saved.textColor);
          if (typeof saved.badgeColor === "string") setBadgeColor(saved.badgeColor);
          if (typeof saved.productScale === "number") setProductScale(saved.productScale);
          if (typeof saved.productX === "number") setProductX(saved.productX);
          if (typeof saved.productY === "number") setProductY(saved.productY);
          if (typeof saved.product2Scale === "number") setProduct2Scale(saved.product2Scale);
          if (typeof saved.product2X === "number") setProduct2X(saved.product2X);
          if (typeof saved.product2Y === "number") setProduct2Y(saved.product2Y);
          if (typeof saved.showGuides === "boolean") setShowGuides(saved.showGuides);
        }
        const [storedProduct, storedProduct2, storedAdvertiser] = await Promise.all([readAsset("product"), readAsset("product2"), readAsset("advertiser")]);
        const [nextProduct, nextProduct2, nextAdvertiser] = await Promise.all([
          storedProduct ? prepareAsset(new File([storedProduct.blob], storedProduct.name, { type: storedProduct.type })) : null,
          storedProduct2 ? prepareAsset(new File([storedProduct2.blob], storedProduct2.name, { type: storedProduct2.type })) : null,
          storedAdvertiser
            ? prepareAsset(new File([storedAdvertiser.blob], storedAdvertiser.name, { type: storedAdvertiser.type }))
            : preparePublicAsset("/jestina-advertiser.png"),
        ]);
        if (cancelled) {
          if (nextProduct) revokeAssetUrl(nextProduct);
          if (nextProduct2) revokeAssetUrl(nextProduct2);
          if (nextAdvertiser) revokeAssetUrl(nextAdvertiser);
          return;
        }
        if (nextProduct) setProduct(nextProduct);
        if (nextProduct2) setProduct2(nextProduct2);
        if (nextAdvertiser) setAdvertiser(nextAdvertiser);
      } catch {
        setNotice("이전 작업을 불러오지 못했습니다. 새 작업은 정상적으로 진행할 수 있습니다.");
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const settings: Settings = {
        template, objectSide, mainCopy, subCopy, advertiserText, badgeText,
        background, textColor, badgeColor, productScale, productX, productY,
        product2Scale, product2X, product2Y, showGuides,
      };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [advertiserText, background, badgeColor, badgeText, draftReady, mainCopy, objectSide, product2Scale, product2X, product2Y, productScale, productX, productY, showGuides, subCopy, template, textColor]);

  function setAsset(key: AssetKey, file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    void prepareAsset(file).then(async (next) => {
      const setter = key === "product" ? setProduct : key === "product2" ? setProduct2 : setAdvertiser;
      setter((current) => {
        revokeAssetUrl(current);
        return next;
      });
      await saveAsset(key, file);
      if (key === "product" || key === "product2") setActiveProduct(key);
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

  function changeTemplate(next: TemplateType) {
    setTemplate(next);
    setProductScale(100);
    setProductX(0);
    setProductY(0);
    setProduct2Scale(82);
    setProduct2X(62);
    setProduct2Y(18);
    setActiveProduct("product");
    setGroupScaleOffset(0);
    if (next === "center") {
      setMainCopy("쫀득쫀득 촉감의");
      setSubCopy("니니즈 필로우");
    } else {
      setMainCopy("니니즈 쫀득쫀득 촉감의 매력");
      setSubCopy("오늘만 10% 추가적립");
    }
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
    const layer: ActiveLayer | null = activeProduct === "both" && product.image && product2.image
      ? "both"
      : activeProduct === "product2" && product2.image
        ? "product2"
        : product.image
          ? "product"
          : product2.image
            ? "product2"
            : null;
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
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function reset() {
    revokeAssetUrl(product);
    revokeAssetUrl(product2);
    revokeAssetUrl(advertiser);
    setProduct(EMPTY_ASSET);
    setProduct2(EMPTY_ASSET);
    setAdvertiser(EMPTY_ASSET);
    setTemplate("badge");
    setObjectSide("right");
    setMainCopy("니니즈 쫀득쫀득 촉감의 매력");
    setSubCopy("오늘만 10% 추가적립");
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
    setNotice("초기화했습니다.");
    window.localStorage.removeItem(SETTINGS_KEY);
    void clearAssets()
      .then(() => preparePublicAsset("/jestina-advertiser.png"))
      .then(setAdvertiser)
      .catch(() => setNotice("기본 광고주체 이미지를 불러오지 못했습니다."));
  }

  async function download(format: "png" | "jpg") {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!product.image && !product2.image) {
      setNotice("먼저 상품 이미지를 등록해주세요.");
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${format === "jpg" ? "jpeg" : "png"}`, .94));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kakao-bizboard-${template}-933x258.${format}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${format.toUpperCase()} 파일을 저장했습니다.`);
  }

  const complete = Boolean((product.image || product2.image) && (advertiser.image || advertiserText.trim()) && mainCopy.trim() && subCopy.trim());
  const typeInfo = TYPE_COPY[template];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Kakao Maker 홈"><span className="brand-mark">K</span><b>KAKAO MAKER</b></a>
        <div className="topbar-meta"><span>KAKAO BIZBOARD</span><i /> <span>933 × 258</span></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">BIZBOARD CREATIVE TOOL</span>
          <h1>카카오 비즈보드,<br /><em>가이드 안에서 자유롭게.</em></h1>
          <p>유형을 선택하고 카피와 이미지를 넣으면 심사 가이드에 맞춘<br className="desktop-only" /> 933×258 소재를 바로 확인하고 저장할 수 있습니다.</p>
        </div>
        <div className="hero-spec">
          <div><span>CANVAS</span><b>933 × 258</b><small>공식 비즈보드 규격</small></div>
          <div><span>OBJECT</span><b>438 × 258</b><small>오브젝트 최대 영역</small></div>
          <div><span>TYPEFACE</span><b>Pretendard</b><small>카피 권장 서체</small></div>
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
        <div className="section-heading"><span>STEP 02</span><div><h2 id="maker-title">{typeInfo.title} 제작</h2><p>{typeInfo.summary}</p></div></div>
        <div className="maker-shell">
          <aside className="control-panel">
            <div className="panel-title"><div><span>INPUT</span><h3>소재 구성</h3></div><button type="button" onClick={reset}>전체 초기화</button></div>

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

            <div className="field-block">
              <div className="field-heading"><div><strong>{template === "center" ? "좌·우 카피" : "카피"}</strong><span>{template === "center" ? "각 1줄" : "메인 1줄 · 서브 1줄"}</span></div></div>
              <label className="text-input"><span>{template === "center" ? "좌측" : "메인"}</span><input value={mainCopy} maxLength={30} onChange={(event) => setMainCopy(event.target.value)} /></label>
              <label className="text-input"><span>{template === "center" ? "우측" : "서브"}</span><input value={subCopy} maxLength={30} onChange={(event) => setSubCopy(event.target.value)} /></label>
            </div>

            {template === "badge" && (
              <div className="field-block">
                <div className="field-heading"><div><strong>배지 플래그</strong><span>혜택 정보 한 어절</span></div></div>
                <div className="inline-fields"><label className="text-input"><span>문구</span><input value={badgeText} maxLength={6} onChange={(event) => setBadgeText(event.target.value)} /></label><label className="color-input"><input type="color" value={flagColor} onChange={(event) => setBadgeColor(event.target.value)} /><input value={badgeColor} onChange={(event) => setBadgeColor(event.target.value)} aria-label="배지 색상 코드" /></label></div>
              </div>
            )}

            <div className="field-block">
              <div className="field-heading"><div><strong>광고주체 표기</strong><span>제이에스티나 로고가 기본 적용됩니다.</span></div></div>
              <label className="text-input"><span>명칭</span><input value={advertiserText} maxLength={24} onChange={(event) => setAdvertiserText(event.target.value)} /></label>
              <UploadField label="워드마크 / 로고" hint="기본값 · J.ESTINA" asset={advertiser} assetKey="advertiser" onFile={setAsset} onPaste={pasteAsset} />
            </div>

            <div className="field-block compact">
              <div className="field-heading"><div><strong>기본 색상</strong><span>가독성 확보 필수</span></div></div>
              <div className="color-grid">
                <label><span>배경</span><div><input type="color" value={bg} onChange={(event) => setBackground(event.target.value)} /><input value={background} onChange={(event) => setBackground(event.target.value)} /></div></label>
                <label><span>카피</span><div><input type="color" value={copyColor} onChange={(event) => setTextColor(event.target.value)} /><input value={textColor} onChange={(event) => setTextColor(event.target.value)} /></div></label>
              </div>
            </div>
          </aside>

          <div className="preview-panel">
            <div className="preview-title"><div><span>LIVE PREVIEW</span><h3>{typeInfo.title}</h3></div>{template === "center" && <span className="center-area-chip">실제 삽입 영역 438×258 · 50% 중앙선</span>}<label><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /> 가이드 영역</label></div>
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
              <small>드래그로 이동 · 마우스 휠 또는 −/+로 확대</small>
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
                    <div className="guide-copy"><span>카피 영역</span></div>
                    <div className="guide-object"><span>{template === "center" ? "실제 오브젝트 삽입 영역 438×258" : "오브젝트 최대 438×258"}</span>{template === "center" && <i className="object-half-line"><b>50% 중앙선</b></i>}</div>
                    <div className="guide-ad"><span>광고주체</span></div>
                    {template === "badge" && <div className="guide-flag"><span>배지</span></div>}
                  </div>
                )}
              </div>
            </div>
            <div className="preview-meta">
              <div className={complete ? "status complete" : "status pending"}><i /><div><b>{complete ? "필수 요소 입력 완료" : "필수 요소를 입력해주세요"}</b><small>{complete ? "배치와 가독성을 최종 확인하세요." : "상품 이미지 · 카피 · 광고주체가 필요합니다."}</small></div></div>
              <div className="file-info"><span>PNG 예상 용량</span><b>{fileBytes === null ? "계산 중" : `${Math.ceil(fileBytes / 1024)} KB`}</b></div>
            </div>
            {notice && <p className="notice" role="status">{notice}</p>}
            <div className="download-row"><button type="button" onClick={() => void download("jpg")}>JPG 저장</button><button className="primary" type="button" onClick={() => void download("png")}><span>PNG 소재 저장</span><small>933 × 258</small></button></div>
          </div>
        </div>
      </section>

      <section className="guideline-section" aria-labelledby="guide-title">
        <div className="section-heading light"><span>GUIDE</span><div><h2 id="guide-title">{typeInfo.title} 제작 가이드</h2><p>현재 선택한 유형에 적용되는 핵심 심사 기준입니다.</p></div></div>
        <div className="guide-cards">
          <article><span>01</span><h3>광고주체 표기</h3>{template === "badge" ? <ul><li>기존 오브젝트 영역 안에서 표기합니다.</li><li>오브젝트 좌·우 정렬에 맞춰 하단 끝에 배치합니다.</li><li>카피·오브젝트의 가독성을 침범하지 않는 크기로 구성합니다.</li></ul> : <ul><li>중앙 오브젝트형은 카피 영역 내 표기가 허용됩니다.</li><li>카피 영역 좌측 최상단 또는 우측 최상단에 정렬합니다.</li><li>영역 내 자유 배치나 카피와의 겹침은 불가합니다.</li></ul>}</article>
          <article><span>02</span><h3>카피 가이드</h3>{template === "badge" ? <ul><li>메인·서브 카피는 각각 최대 1줄로 사용합니다.</li><li>오브젝트와 겹치지 않고 충분한 여백을 확보합니다.</li><li>기울기·왜곡·과도한 자간 등 임의 변형은 불가합니다.</li></ul> : <ul><li>오브젝트 양쪽 카피의 시각적 균형을 맞춥니다.</li><li>각 카피는 최대 1줄, Pretendard 사용을 권장합니다.</li><li>오브젝트와 카피 사이에 명확한 간격을 확보합니다.</li></ul>}</article>
          <article><span>03</span><h3>오브젝트 가이드</h3>{template === "badge" ? <ul><li>933×258 영역 안에서 좌측 또는 우측 정렬이 가능합니다.</li><li>상품 이미지 2개를 각각 조절하고 겹쳐 배치할 수 있습니다.</li><li>단일 오브젝트 최대 크기는 438×258입니다.</li><li>배지 플래그는 오브젝트 좌·우 정렬일 때만 사용합니다.</li></ul> : <ul><li>오브젝트를 소재 중앙에 배치하고 양쪽 균형을 유지합니다.</li><li>상품 이미지 2개를 각각 조절하고 겹쳐 배치할 수 있습니다.</li><li>인지가 어려운 작은 이미지나 저화질 이미지는 사용할 수 없습니다.</li><li>오브젝트 최대 크기는 438×258을 넘지 않습니다.</li></ul>}</article>
        </div>
        <p className="review-note"><b>심사 유의사항</b> 규격을 지켜도 소재 구성이 조화롭지 않거나 의미 전달이 불명확하면 심사가 보류될 수 있습니다.</p>
      </section>

      <footer>
        <span>KAKAO MAKER</span>
        <p>카카오 비즈보드 PSD 제작 가이드 v2025.07.09 기준</p>
        <p>문의사항 및 추가 요청 사항은 <a href="mailto:somin.jo@playd.com">somin.jo@playd.com</a>으로 연락바랍니다.</p>
      </footer>
    </main>
  );
}
