"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const WIDTH = 300;
const HEIGHT = 464;
const MAX_BYTES = 400 * 1024;
const LOGO_BOX = { x: 24, y: 40, width: 252, height: 28 };
const PRODUCT_BOX = { x: 24, y: 92, width: 252, height: 229 };
const TEXT_BOX = { x: 24, y: 345, width: 252, height: 80 };
const TEXT_FONT = "AppleSDGothicNeoEB00";
const TEXT_GAP = 17;
const SETTINGS_KEY = "focus-maker:last-settings:v1";
const ASSET_DB_NAME = "focus-maker-assets";
const ASSET_STORE_NAME = "last-assets";

type AssetKey = "logo" | "product";
type AssetState = {
  file: File | null;
  image: HTMLImageElement | null;
  url: string;
};

type StoredAsset = {
  blob: Blob;
  name: string;
  type: string;
};

type DraftSettings = {
  line1: string;
  line2: string;
  background: string;
  line1Color: string;
  line2Color: string;
  line1Size: number;
  line2Size: number;
  logoScale: number;
  productScale: number;
  productOffsetY: number;
  showGuides: boolean;
};

const EMPTY_ASSET: AssetState = { file: null, image: null, url: "" };

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

function openAssetDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) {
        request.result.createObjectStore(ASSET_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoredAsset(key: AssetKey, file: File) {
  const database = await openAssetDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).put(
      { blob: file, name: file.name, type: file.type } satisfies StoredAsset,
      key,
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readStoredAsset(key: AssetKey) {
  const database = await openAssetDatabase();
  const result = await new Promise<StoredAsset | undefined>((resolve, reject) => {
    const request = database.transaction(ASSET_STORE_NAME, "readonly").objectStore(ASSET_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as StoredAsset | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

async function clearStoredAssets() {
  const database = await openAssetDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function normalizeHex(value: string, fallback: string) {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(prefixed) ? prefixed : fallback;
}

function fitImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  scalePercent: number,
  offsetY = 0,
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
    box.x + (box.width - width) / 2,
    box.y + (box.height - height) / 2 + offsetY,
    width,
    height,
  );
  ctx.restore();
}

function fittedTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  requestedSize: number,
) {
  let size = requestedSize;
  ctx.font = `800 ${size}px "${TEXT_FONT}", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  while (size > 12 && ctx.measureText(text).width > TEXT_BOX.width) {
    size -= 1;
    ctx.font = `800 ${size}px "${TEXT_FONT}", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  }
  return size;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  first: { text: string; color: string; size: number },
  second: { text: string; color: string; size: number },
) {
  const firstSize = fittedTextSize(ctx, first.text, first.size);
  const firstMetrics = ctx.measureText(first.text);
  const firstAscent = firstMetrics.actualBoundingBoxAscent || firstSize * .8;
  const firstDescent = firstMetrics.actualBoundingBoxDescent || firstSize * .2;

  const secondSize = fittedTextSize(ctx, second.text, second.size);
  const secondMetrics = ctx.measureText(second.text);
  const secondAscent = secondMetrics.actualBoundingBoxAscent || secondSize * .8;
  const secondDescent = secondMetrics.actualBoundingBoxDescent || secondSize * .2;

  const contentHeight = firstAscent + firstDescent + TEXT_GAP + secondAscent + secondDescent;
  const firstBaseline = TEXT_BOX.y + (TEXT_BOX.height - contentHeight) / 2 + firstAscent;
  const secondBaseline = firstBaseline + firstDescent + TEXT_GAP + secondAscent;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.font = `800 ${firstSize}px "${TEXT_FONT}", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.fillStyle = first.color;
  ctx.fillText(first.text, WIDTH / 2, firstBaseline, TEXT_BOX.width);

  ctx.font = `800 ${secondSize}px "${TEXT_FONT}", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.fillStyle = second.color;
  ctx.fillText(second.text, WIDTH / 2, secondBaseline, TEXT_BOX.width);
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "계산 중";
  return `${Math.ceil(bytes / 1024)}KB`;
}

function UploadField({
  asset,
  assetKey,
  label,
  hint,
  onFile,
}: {
  asset: AssetState;
  assetKey: AssetKey;
  label: string;
  hint: string;
  onFile: (key: AssetKey, file?: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    onFile(assetKey, event.dataTransfer.files[0]);
  }

  return (
    <div className="field-block">
      <div className="field-heading">
        <div>
          <strong>{label}</strong>
          <span>{hint}</span>
        </div>
        {asset.file && <span className="complete-badge">완료</span>}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onFile(assetKey, event.target.files?.[0])}
      />
      <div
        className={`upload-box ${asset.file ? "has-file" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {asset.url ? (
          <>
            {/* Blob URLs are user-selected local files and cannot use Next Image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={`${label} 미리보기`} />
            <div className="upload-copy">
              <b>{asset.file?.name}</b>
              <span>클릭하여 교체</span>
            </div>
          </>
        ) : (
          <>
            <span className="upload-plus">+</span>
            <div className="upload-copy">
              <b>이미지 선택</b>
              <span>PNG 투명 배경 권장</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logo, setLogo] = useState<AssetState>(EMPTY_ASSET);
  const [product, setProduct] = useState<AssetState>(EMPTY_ASSET);
  const [line1, setLine1] = useState("브랜드명");
  const [line2, setLine2] = useState("상품을 소개하는 문구");
  const [background, setBackground] = useState("#F7E6D8");
  const [line1Color, setLine1Color] = useState("#171717");
  const [line2Color, setLine2Color] = useState("#A6572A");
  const [line1Size, setLine1Size] = useState(23);
  const [line2Size, setLine2Size] = useState(23);
  const [logoScale, setLogoScale] = useState(100);
  const [productScale, setProductScale] = useState(100);
  const [productOffsetY, setProductOffsetY] = useState(0);
  const [showGuides, setShowGuides] = useState(true);
  const [pngBytes, setPngBytes] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("마지막 작업 확인 중");

  const bg = normalizeHex(background, "#F7E6D8");
  const text1 = normalizeHex(line1Color, "#171717");
  const text2 = normalizeHex(line2Color, "#A6572A");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (logo.image) {
      fitImage(ctx, logo.image, LOGO_BOX, logoScale);
    }
    if (product.image) {
      fitImage(ctx, product.image, PRODUCT_BOX, productScale, productOffsetY);
    }

    drawTextBlock(
      ctx,
      { text: line1.trim() || " ", color: text1, size: line1Size },
      { text: line2.trim() || " ", color: text2, size: line2Size },
    );
  }, [bg, line1, line1Size, line2, line2Size, logo.image, logoScale, product.image, productOffsetY, productScale, text1, text2]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const timer = window.setTimeout(() => {
      canvas.toBlob((blob) => setPngBytes(blob?.size ?? null), "image/png");
    }, 80);
    return () => window.clearTimeout(timer);
  }, [draw]);

  useEffect(() => {
    let cancelled = false;

    async function restoreDraft() {
      try {
        const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const saved = JSON.parse(rawSettings) as Partial<DraftSettings>;
          if (typeof saved.line1 === "string") setLine1(saved.line1);
          if (typeof saved.line2 === "string") setLine2(saved.line2);
          if (typeof saved.background === "string") setBackground(saved.background);
          if (typeof saved.line1Color === "string") setLine1Color(saved.line1Color);
          if (typeof saved.line2Color === "string") setLine2Color(saved.line2Color);
          if (typeof saved.line1Size === "number") setLine1Size(saved.line1Size);
          if (typeof saved.line2Size === "number") setLine2Size(saved.line2Size);
          if (typeof saved.logoScale === "number") setLogoScale(saved.logoScale);
          if (typeof saved.productScale === "number") setProductScale(saved.productScale);
          if (typeof saved.productOffsetY === "number") setProductOffsetY(saved.productOffsetY);
          if (typeof saved.showGuides === "boolean") setShowGuides(saved.showGuides);
        }

        const [storedLogo, storedProduct] = await Promise.all([
          readStoredAsset("logo"),
          readStoredAsset("product"),
        ]);
        const [restoredLogo, restoredProduct] = await Promise.all([
          storedLogo
            ? prepareAsset(new File([storedLogo.blob], storedLogo.name, { type: storedLogo.type }))
            : null,
          storedProduct
            ? prepareAsset(new File([storedProduct.blob], storedProduct.name, { type: storedProduct.type }))
            : null,
        ]);

        if (cancelled) {
          if (restoredLogo?.url) URL.revokeObjectURL(restoredLogo.url);
          if (restoredProduct?.url) URL.revokeObjectURL(restoredProduct.url);
          return;
        }
        if (restoredLogo) setLogo(restoredLogo);
        if (restoredProduct) setProduct(restoredProduct);
        setSaveStatus(rawSettings || storedLogo || storedProduct ? "마지막 작업 복원됨" : "자동 저장 켜짐");
      } catch {
        setSaveStatus("자동 저장 준비됨");
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    }

    void restoreDraft();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      const settings: DraftSettings = {
        line1,
        line2,
        background,
        line1Color,
        line2Color,
        line1Size,
        line2Size,
        logoScale,
        productScale,
        productOffsetY,
        showGuides,
      };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setSaveStatus("자동 저장됨");
      } catch {
        setSaveStatus("설정 저장 실패");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [background, draftReady, line1, line1Color, line1Size, line2, line2Color, line2Size, logoScale, productOffsetY, productScale, showGuides]);

  function setAsset(key: AssetKey, file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setSaveStatus("이미지 저장 중");
    void prepareAsset(file).then(async (nextAsset) => {
      const setter = key === "logo" ? setLogo : setProduct;
      setter((current) => {
        if (current.url) URL.revokeObjectURL(current.url);
        return nextAsset;
      });
      setNotice("");
      try {
        await saveStoredAsset(key, file);
        setSaveStatus("자동 저장됨");
      } catch {
        setSaveStatus("이미지 저장 실패");
      }
    }).catch(() => {
      setNotice("이미지를 읽을 수 없습니다. PNG 또는 JPG 파일을 사용해주세요.");
      setSaveStatus("이미지 저장 실패");
    });
  }

  function reset() {
    if (logo.url) URL.revokeObjectURL(logo.url);
    if (product.url) URL.revokeObjectURL(product.url);
    setLogo(EMPTY_ASSET);
    setProduct(EMPTY_ASSET);
    setLine1("브랜드명");
    setLine2("상품을 소개하는 문구");
    setBackground("#F7E6D8");
    setLine1Color("#171717");
    setLine2Color("#A6572A");
    setLogoScale(100);
    setProductScale(100);
    setProductOffsetY(0);
    setLine1Size(23);
    setLine2Size(23);
    setShowGuides(true);
    setNotice("");
    window.localStorage.removeItem(SETTINGS_KEY);
    void clearStoredAssets().then(() => setSaveStatus("초기화됨")).catch(() => setSaveStatus("초기화 저장 실패"));
  }

  async function makeJpegBlob() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    for (let quality = 0.94; quality >= 0.58; quality -= 0.06) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.5));
  }

  async function download(format: "png" | "jpg") {
    const canvas = canvasRef.current;
    if (!canvas || !logo.image || !product.image) {
      setNotice("브랜드 로고와 상품 이미지를 모두 넣어주세요.");
      return;
    }
    const blob = format === "jpg"
      ? await makeJpegBlob()
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    if (blob.size > MAX_BYTES) {
      setNotice(`${format.toUpperCase()} 결과가 400KB를 초과합니다. JPG로 저장해주세요.`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (line1.trim() || "focustem").replace(/[\\/:*?"<>|]/g, "-");
    link.href = url;
    link.download = `${safeName}_포커스템_300x464.${format}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${format.toUpperCase()} ${formatBytes(blob.size)} 파일을 저장했습니다.`);
  }

  const ready = Boolean(logo.image && product.image && line1.trim() && line2.trim());
  const withinLimit = pngBytes !== null && pngBytes <= MAX_BYTES;

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="포커스템 메이커 홈">
          <span className="wordmark-icon">F</span>
          <span>Focus Maker</span>
        </a>
        <div className="topbar-meta">
          <span>네이버 포커스템</span>
          <b>300 × 464</b>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">NAVER SHOPPING BLOCK CREATIVE</p>
          <h1>로고와 상품만 넣으면<br /><span>포커스템 소재 완성.</span></h1>
          <p className="intro-copy">가이드 안전여백에 맞춰 로고·상품·문구를 자동 배치하고, 검수 규격에 맞는 이미지로 저장합니다.</p>
        </div>
        <div className="spec-strip" aria-label="제작 규격 요약">
          <div><b>300×464px</b><span>고정 캔버스</span></div>
          <div><b>400KB</b><span>최대 용량</span></div>
          <div><b>PNG · JPG</b><span>저장 형식</span></div>
        </div>
      </section>

      <section className="creator-shell">
        <aside className="control-panel">
          <div className="panel-title">
            <div><span>01</span><h2>소재 입력</h2></div>
            <div className="panel-actions">
              <span className="save-indicator">{saveStatus}</span>
              <button className="text-button" type="button" onClick={reset}>초기화</button>
            </div>
          </div>

          <UploadField asset={logo} assetKey="logo" label="브랜드 로고" hint="상단 편집 영역 안에서 확대" onFile={setAsset} />
          <UploadField asset={product} assetKey="product" label="상품 이미지" hint="중앙 영역에서 확대·위치 조절" onFile={setAsset} />

          <div className="field-block">
            <div className="field-heading"><div><strong>광고 문구</strong><span>{TEXT_FONT} 고정 · 행간 {TEXT_GAP}px</span></div></div>
            <label className="input-label">
              <span>1행</span>
              <input value={line1} maxLength={20} onChange={(event) => setLine1(event.target.value)} placeholder="브랜드명" />
            </label>
            <label className="input-label">
              <span>2행</span>
              <input value={line2} maxLength={24} onChange={(event) => setLine2(event.target.value)} placeholder="상품 소개 문구" />
            </label>
          </div>

          <div className="field-block color-section">
            <div className="field-heading"><div><strong>색상 코드</strong><span>HEX 코드 직접 입력</span></div></div>
            <div className="color-grid">
              <ColorField label="배경" value={background} fallback="#F7E6D8" onChange={setBackground} />
              <ColorField label="문구 1행" value={line1Color} fallback="#171717" onChange={setLine1Color} />
              <ColorField label="문구 2행" value={line2Color} fallback="#A6572A" onChange={setLine2Color} />
            </div>
          </div>

          <details className="detail-controls" open>
            <summary>이미지 배치 조정</summary>
            <p className="control-note">빨간 편집 박스 밖으로 나간 이미지는 저장할 때 잘립니다.</p>
            <RangeField label="로고 확대" value={logoScale} min={50} max={500} onChange={setLogoScale} />
            <RangeField label="상품 확대" value={productScale} min={50} max={400} onChange={setProductScale} />
            <RangeField label="상품 위·아래" value={productOffsetY} min={-110} max={110} suffix="px" onChange={setProductOffsetY} />
            <RangeField label="1행 글자" value={line1Size} min={12} max={32} suffix="px" editable onChange={setLine1Size} />
            <RangeField label="2행 글자" value={line2Size} min={12} max={32} suffix="px" editable onChange={setLine2Size} />
          </details>
        </aside>

        <section className="preview-panel">
          <div className="panel-title preview-title">
            <div><span>02</span><h2>실시간 미리보기</h2></div>
            <label className="switch-label">
              <input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />
              <span>편집 가이드</span>
            </label>
          </div>

          <div className="preview-stage">
            <div className="creative-frame">
              <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="포커스템 소재 미리보기" />
              {showGuides && (
                <div className="guide-overlay" aria-hidden="true">
                  <span className="guide-zone logo-zone"><b>로고 편집 영역</b></span>
                  <span className="guide-zone product-zone"><b>상품 편집 영역</b></span>
                  <span className="guide-line top"><b>40</b></span>
                  <span className="guide-line logo-gap"><b>24</b></span>
                  <span className="guide-line product-gap"><b>24</b></span>
                  <span className="guide-line bottom"><b>40</b></span>
                  <span className="guide-side left"><b>24</b></span>
                  <span className="guide-side right"><b>24</b></span>
                </div>
              )}
              {!logo.image && <span className="canvas-placeholder logo-placeholder">브랜드 로고</span>}
              {!product.image && <span className="canvas-placeholder product-placeholder">상품 이미지</span>}
            </div>
          </div>

          <div className="status-row">
            <div className={withinLimit ? "status-ok" : "status-warn"}>
              <span className="status-dot" />
              <div><b>{withinLimit ? "가이드 용량 적합" : "PNG 용량 확인 필요"}</b><small>예상 PNG {formatBytes(pngBytes)} / 최대 400KB</small></div>
            </div>
            <span className="privacy-note">마지막 작업과 이미지는 이 브라우저에 자동 저장됩니다</span>
          </div>

          {notice && <p className="notice" role="status">{notice}</p>}

          <div className="download-row">
            <button className="secondary-button" disabled={!ready} onClick={() => download("png")}>PNG 저장</button>
            <button className="primary-button" disabled={!ready} onClick={() => download("jpg")}><span>JPG 저장</span><small>400KB 자동 최적화</small></button>
          </div>
        </section>
      </section>

      <section className="guide-summary">
        <div>
          <p className="eyebrow">OFFICIAL SAFE AREA</p>
          <h2>가이드 여백을<br />자동으로 지킵니다.</h2>
        </div>
        <ol>
          <li><b>40px</b><span>로고 상단 여백</span></li>
          <li><b>24px</b><span>로고와 상품 사이</span></li>
          <li><b>24px</b><span>상품과 문구 사이</span></li>
          <li><b>24px</b><span>문구 좌우 여백</span></li>
          <li><b>40px</b><span>문구 하단 여백</span></li>
        </ol>
      </section>

      <footer><span>Focus Maker</span><p>포커스템 테스트 노출용 배너 제작 가이드 300×464 기준</p></footer>
    </main>
  );
}

function ColorField({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (value: string) => void }) {
  const normalized = normalizeHex(value, fallback);
  return (
    <label className="color-field">
      <span>{label}</span>
      <div>
        <input className="color-picker" type="color" value={normalized} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={`${label} 색상 선택`} />
        <input className="hex-input" value={value} maxLength={7} onChange={(event) => onChange(event.target.value.toUpperCase())} onBlur={() => onChange(normalized.toUpperCase())} aria-label={`${label} 색상 코드`} />
      </div>
    </label>
  );
}

function RangeField({ label, value, min, max, suffix = "%", editable = false, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; editable?: boolean; onChange: (value: number) => void }) {
  function updateValue(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onChange(Math.min(max, Math.max(min, nextValue)));
  }

  return (
    <label className="range-field">
      <span>
        {label}
        {editable ? (
          <span className="range-number-wrap">
            <input
              className="range-number"
              type="number"
              min={min}
              max={max}
              value={value}
              aria-label={`${label} 직접 입력`}
              onChange={(event) => updateValue(Number(event.target.value))}
            />
            <b>{suffix}</b>
          </span>
        ) : <b>{value}{suffix}</b>}
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => updateValue(Number(event.target.value))} />
    </label>
  );
}
