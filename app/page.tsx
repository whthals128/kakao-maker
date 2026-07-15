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

type AssetKey = "logo" | "product";
type AssetState = {
  file: File | null;
  image: HTMLImageElement | null;
  url: string;
};

const EMPTY_ASSET: AssetState = { file: null, image: null, url: "" };

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

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string,
  requestedSize: number,
) {
  const maxWidth = 252;
  let size = requestedSize;
  ctx.font = `800 ${size}px "Arial", "Noto Sans KR", sans-serif`;
  while (size > 13 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `800 ${size}px "Arial", "Noto Sans KR", sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, WIDTH / 2, y, maxWidth);
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

    drawFittedText(ctx, line1.trim() || " ", 361.5, text1, line1Size);
    drawFittedText(ctx, line2.trim() || " ", 408.5, text2, line2Size);
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

  function setAsset(key: AssetKey, file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const setter = key === "logo" ? setLogo : setProduct;
      setter((current) => {
        if (current.url) URL.revokeObjectURL(current.url);
        return { file, image, url };
      });
      setNotice("");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice("이미지를 읽을 수 없습니다. PNG 또는 JPG 파일을 사용해주세요.");
    };
    image.src = url;
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
    setNotice("");
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
            <button className="text-button" type="button" onClick={reset}>초기화</button>
          </div>

          <UploadField asset={logo} assetKey="logo" label="브랜드 로고" hint="상단 편집 영역 안에서 확대" onFile={setAsset} />
          <UploadField asset={product} assetKey="product" label="상품 이미지" hint="중앙 영역에서 확대·위치 조절" onFile={setAsset} />

          <div className="field-block">
            <div className="field-heading"><div><strong>광고 문구</strong><span>긴 문구는 영역에 맞춰 자동 축소</span></div></div>
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
            <RangeField label="1행 글자" value={line1Size} min={16} max={26} suffix="px" onChange={setLine1Size} />
            <RangeField label="2행 글자" value={line2Size} min={16} max={26} suffix="px" onChange={setLine2Size} />
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
            <span className="privacy-note">이미지는 브라우저 안에서만 처리됩니다</span>
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

function RangeField({ label, value, min, max, suffix = "%", onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="range-field">
      <span>{label}<b>{value}{suffix}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
