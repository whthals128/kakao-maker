"use client";

import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { computePlacement } from "./protected-placement.js";
import { renderPlanToContext } from "./canvas-renderer.js";

type Channel = "meta" | "google" | "kakao" | "naver" | "brand" | "custom";
type Strategy = "preserve" | "extend" | "crop";
type ProtectedRegion = { x: number; y: number; width: number; height: number };
type AdSize = {
  id: string;
  channel: Channel;
  name: string;
  width: number;
  height: number;
  note?: string;
  custom?: boolean;
};

const PRESETS: AdSize[] = [
  { id: "meta-square", channel: "meta", name: "피드 정사각형", width: 1080, height: 1080 },
  { id: "meta-feed", channel: "meta", name: "피드 세로형", width: 1080, height: 1350 },
  { id: "meta-story", channel: "meta", name: "스토리 · 릴스", width: 1080, height: 1920 },
  { id: "meta-landscape", channel: "meta", name: "가로형", width: 1200, height: 628 },
  { id: "google-landscape", channel: "google", name: "반응형 가로", width: 1200, height: 628 },
  { id: "google-square", channel: "google", name: "반응형 정사각형", width: 1200, height: 1200 },
  { id: "google-portrait", channel: "google", name: "반응형 세로", width: 900, height: 1600 },
  { id: "google-300-250", channel: "google", name: "중간 직사각형", width: 300, height: 250 },
  { id: "google-336-280", channel: "google", name: "큰 직사각형", width: 336, height: 280 },
  { id: "google-728-90", channel: "google", name: "리더보드", width: 728, height: 90 },
  { id: "google-970-90", channel: "google", name: "큰 리더보드", width: 970, height: 90 },
  { id: "google-468-60", channel: "google", name: "배너", width: 468, height: 60 },
  { id: "google-300-600", channel: "google", name: "반 페이지", width: 300, height: 600 },
  { id: "google-160-600", channel: "google", name: "와이드 스카이스크래퍼", width: 160, height: 600 },
  { id: "google-250-250", channel: "google", name: "정사각형", width: 250, height: 250 },
  { id: "google-300-100", channel: "google", name: "모바일 대형 배너", width: 300, height: 100 },
  { id: "google-300-50", channel: "google", name: "모바일 배너", width: 300, height: 50 },
  { id: "kakao-2-1", channel: "kakao", name: "디스플레이 가로", width: 1200, height: 600 },
  { id: "kakao-square", channel: "kakao", name: "디스플레이 정사각형", width: 500, height: 500 },
  { id: "kakao-feed", channel: "kakao", name: "디스플레이 세로", width: 800, height: 1000 },
  { id: "kakao-story", channel: "kakao", name: "전체화면 세로", width: 720, height: 1280 },
  { id: "kakao-bizboard", channel: "kakao", name: "비즈보드", width: 1029, height: 258, note: "조립형" },
  { id: "naver-mobile", channel: "naver", name: "모바일 DA", width: 1250, height: 560, note: "세이프존" },
  { id: "naver-square", channel: "naver", name: "이미지 배너 1:1", width: 1200, height: 1200 },
  { id: "naver-native", channel: "naver", name: "DA 네이티브", width: 342, height: 228 },
  { id: "naver-feed-land", channel: "naver", name: "DA 피드 가로", width: 1200, height: 628 },
  { id: "naver-feed-square", channel: "naver", name: "DA 피드 정사각형", width: 1200, height: 1200 },
  { id: "naver-feed-portrait", channel: "naver", name: "DA 피드 세로", width: 1200, height: 1800 },
  { id: "naver-collection", channel: "naver", name: "DA 피드 컬렉션", width: 600, height: 600 },
  { id: "brand-pc-main", channel: "brand", name: "PC 라이트 메인", width: 472, height: 472, note: "최소" },
  { id: "brand-pc-thumb", channel: "brand", name: "PC 메인 섬네일", width: 232, height: 152, note: "3장" },
  { id: "brand-pc-sub5", channel: "brand", name: "PC 서브 5구", width: 232, height: 166, note: "5장" },
  { id: "brand-pc-sub2", channel: "brand", name: "PC 서브 2구", width: 222, height: 222, note: "2장" },
  { id: "brand-mo-main", channel: "brand", name: "모바일 라이트 메인", width: 208, height: 208, note: "최소" },
  { id: "brand-mo-sub", channel: "brand", name: "모바일 서브 섬네일", width: 240, height: 240, note: "최소" },
];

const CHANNELS: { id: "all" | "favorite" | Channel; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "favorite", label: "★ 즐겨찾기" },
  { id: "meta", label: "메타" },
  { id: "google", label: "구글" },
  { id: "kakao", label: "카카오" },
  { id: "naver", label: "네이버 DA" },
  { id: "brand", label: "브랜드검색" },
  { id: "custom", label: "직접 추가" },
];

const CHANNEL_LABEL: Record<Channel, string> = {
  meta: "메타",
  google: "구글",
  kakao: "카카오",
  naver: "네이버 DA",
  brand: "브랜드검색",
  custom: "직접 추가",
};

const REQUEST_CHIPS = ["인물 얼굴을 꼭 살려주세요", "제품을 중앙에 유지해주세요", "이미지 속 문구를 자르지 마세요", "로고 주변 여백을 지켜주세요"];

const previewImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadPreviewImage(source: string) {
  const cached = previewImageCache.get(source);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = source;
  });
  previewImageCache.set(source, pending);
  return pending;
}

function ResultCanvas({ imageUrl, size, plan }: { imageUrl: string; size: AdSize; plan: ReturnType<typeof computePlacement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planSignature = JSON.stringify(plan);

  useEffect(() => {
    let cancelled = false;
    loadPreviewImage(imageUrl).then((image) => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const previewScale = Math.min(1, 720 / Math.max(size.width, size.height));
      canvas.width = Math.max(1, Math.round(size.width * previewScale));
      canvas.height = Math.max(1, Math.round(size.height * previewScale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(canvas.width / size.width, 0, 0, canvas.height / size.height, 0, 0);
      renderPlanToContext(ctx, image, size.width, size.height, plan);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [imageUrl, size.width, size.height, planSignature]);

  return <canvas ref={canvasRef} aria-label={`${size.name} 변환 미리보기`} />;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [activeChannel, setActiveChannel] = useState<(typeof CHANNELS)[number]["id"]>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customSizes, setCustomSizes] = useState<AdSize[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [globalRequest, setGlobalRequest] = useState("");
  const [strategies, setStrategies] = useState<Record<string, Strategy>>({});
  const [cropYOffsets, setCropYOffsets] = useState<Record<string, number>>({});
  const [openRequests, setOpenRequests] = useState<string[]>([]);
  const [cardRequests, setCardRequests] = useState<Record<string, string>>({});
  const [savedRequests, setSavedRequests] = useState<string[]>([]);
  const [protectMode, setProtectMode] = useState(false);
  const [protectedRegion, setProtectedRegion] = useState<ProtectedRegion | null>(null);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("resize-favorites") || "[]"));
      setCustomSizes(JSON.parse(localStorage.getItem("resize-custom-sizes") || "[]"));
    } catch {
      // Ignore invalid local data and start clean.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("resize-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("resize-custom-sizes", JSON.stringify(customSizes));
  }, [customSizes]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const allSizes = useMemo(() => [...PRESETS, ...customSizes], [customSizes]);
  const visibleSizes = useMemo(() => {
    if (activeChannel === "all") return allSizes;
    if (activeChannel === "favorite") return allSizes.filter((size) => favorites.includes(size.id));
    return allSizes.filter((size) => size.channel === activeChannel);
  }, [activeChannel, allSizes, favorites]);
  const selectedSizes = useMemo(() => allSizes.filter((size) => selected.includes(size.id)), [allSizes, selected]);

  function acceptFile(nextFile?: File) {
    if (!nextFile || !nextFile.type.startsWith("image/")) return;
    if (imageUrl) {
      previewImageCache.delete(imageUrl);
      URL.revokeObjectURL(imageUrl);
    }
    const url = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setImageUrl(url);
    setSourceSize({ width: 0, height: 0 });
    setProtectedRegion(null);
    setProtectMode(false);
    setCropYOffsets({});
    setGenerated(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    acceptFile(event.dataTransfer.files[0]);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setGenerated(false);
  }

  function addRequestChip(chip: string) {
    setGlobalRequest((current) => current.includes(chip) ? current : [current, chip].filter(Boolean).join(" · "));
  }

  function selectionPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function startRegionSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!protectMode) return;
    const point = selectionPoint(event);
    dragStart.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    setProtectedRegion({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function updateRegionSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!protectMode || !dragStart.current) return;
    const point = selectionPoint(event);
    const start = dragStart.current;
    setProtectedRegion({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  function finishRegionSelection(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    const point = selectionPoint(event);
    const rect = event.currentTarget.getBoundingClientRect();
    const region = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    dragStart.current = null;
    setProtectMode(false);
    setProtectedRegion(region.width * rect.width >= 2 && region.height * rect.height >= 2 ? region : null);
  }

  function cancelRegionSelection() {
    dragStart.current = null;
    setProtectMode(false);
    setProtectedRegion(null);
  }

  function addCustomSize() {
    const width = Number(customWidth);
    const height = Number(customHeight);
    if (!width || !height || width < 40 || height < 40) return;
    const id = `custom-${Date.now()}`;
    const size: AdSize = { id, channel: "custom", name: customName.trim() || "내 사이즈", width, height, custom: true };
    setCustomSizes((current) => [...current, size]);
    setSelected((current) => [...current, id]);
    setCustomName("");
    setCustomWidth("");
    setCustomHeight("");
    setCustomFormOpen(false);
    setActiveChannel("custom");
  }

  function removeCustomSize(id: string) {
    setCustomSizes((current) => current.filter((size) => size.id !== id));
    setSelected((current) => current.filter((item) => item !== id));
    setFavorites((current) => current.filter((item) => item !== id));
  }

  function inferredStrategy(size: AdSize): Strategy {
    if (!sourceSize.width) return "preserve";
    const sourceRatio = sourceSize.width / sourceSize.height;
    const targetRatio = size.width / size.height;
    const difference = Math.abs(Math.log(sourceRatio / targetRatio));
    return difference < 0.12 ? "preserve" : "extend";
  }

  function strategyFor(size: AdSize) {
    return strategies[size.id] || inferredStrategy(size);
  }

  function setStrategy(id: string, strategy: Strategy) {
    setStrategies((current) => ({ ...current, [id]: strategy }));
  }

  function placementFor(size: AdSize, strategy: Strategy, imageWidth = sourceSize.width, imageHeight = sourceSize.height) {
    if (!imageWidth || !imageHeight) return null;
    return computePlacement({
      mode: strategy,
      region: protectedRegion,
      targetWidth: size.width,
      targetHeight: size.height,
      imageWidth,
      imageHeight,
      verticalOffset: (cropYOffsets[size.id] || 0) / 100,
    });
  }

  function generate() {
    if (!file || selected.length === 0) return;
    setGenerated(true);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function downloadOutput(size: AdSize) {
    if (!imageUrl) return;
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const strategy = strategyFor(size);
    const plan = placementFor(size, strategy, image.naturalWidth, image.naturalHeight);
    if (!plan) return;

    renderPlanToContext(ctx, image, size.width, size.height, plan);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "creative"}_${size.width}x${size.height}.png`;
    link.href = downloadUrl;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="리사이즈랩 홈">
          <span className="brand-mark">R</span>
          <span>리사이즈랩</span>
          <span className="beta">BETA</span>
        </a>
        <div className="topbar-actions">
          <button className="ghost-button">작업 내역</button>
          <button className="avatar" aria-label="내 계정">SJ</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">광고 소재 사이즈 자동 변환</p>
          <h1>원본은 살리고,<br /><span>모든 광고 지면에 딱 맞게.</span></h1>
          <p className="hero-copy">이미지 한 장만 올리세요. 매체별 규격에 맞춰 원본 훼손을 최소화한 소재를 한 번에 만듭니다.</p>
        </div>
        <div className="principle-card">
          <span className="principle-icon">◎</span>
          <div><strong>원본 보존 우선</strong><p>자르기 전에 여백 확장과 비율 맞춤을 먼저 시도해요.</p></div>
        </div>
      </section>

      <section className="workspace">
        <div className="step-card upload-card">
          <div className="section-heading">
            <span className="step-number">1</span>
            <div><h2>원본 이미지 올리기</h2><p>JPG, PNG, WebP · 최대 20MB</p></div>
          </div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])} />
          {!imageUrl ? (
            <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}>
              <span className="upload-icon">＋</span>
              <strong>이미지를 여기에 놓아주세요</strong>
              <span>또는 클릭해서 파일 선택</span>
            </div>
          ) : (
            <div className={`source-preview ${protectMode ? "selecting-region" : ""}`}>
              <div className="source-canvas">
                <div className="image-stage" style={{ width: `min(100%, ${260 * (sourceSize.width && sourceSize.height ? sourceSize.width / sourceSize.height : 1)}px)`, aspectRatio: sourceSize.width && sourceSize.height ? `${sourceSize.width} / ${sourceSize.height}` : "1" }}>
                  <img src={imageUrl} alt="업로드한 원본" onLoad={(event) => setSourceSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
                  <div className="selection-layer" onPointerDown={startRegionSelection} onPointerMove={updateRegionSelection} onPointerUp={finishRegionSelection} onPointerCancel={cancelRegionSelection}>
                    {protectedRegion && <span className="protected-region" style={{ left: `${protectedRegion.x * 100}%`, top: `${protectedRegion.y * 100}%`, width: `${protectedRegion.width * 100}%`, height: `${protectedRegion.height * 100}%` }}><b>제품 보호 영역</b></span>}
                    {protectMode && !protectedRegion && <em>제품 주위를 드래그해주세요</em>}
                  </div>
                </div>
              </div>
              <div className="source-info">
                <div><strong>{file?.name}</strong><span>{sourceSize.width} × {sourceSize.height}px</span></div>
                <div className="source-buttons"><button disabled={!sourceSize.width} className={protectedRegion ? "region-active" : ""} onClick={() => { setProtectMode(true); setProtectedRegion(null); setCropYOffsets({}); }}>⌗ {protectedRegion ? "제품 범위 다시 지정" : "제품 범위 지정"}</button><button onClick={() => inputRef.current?.click()}>이미지 교체</button></div>
              </div>
              <span className="original-badge">원본</span>
            </div>
          )}

          <div className="request-box">
            <div className="request-title"><span>✦</span><div><strong>이미지를 어떻게 살릴까요?</strong><p>자동 조정 시 꼭 지켜야 할 내용을 알려주세요.</p></div></div>
            <div className="request-chips">
              {REQUEST_CHIPS.map((chip) => <button key={chip} onClick={() => addRequestChip(chip)}>{chip}</button>)}
            </div>
            <textarea value={globalRequest} onChange={(event) => setGlobalRequest(event.target.value)} placeholder="예: 오른쪽 인물을 자르지 말고, 왼쪽에 카피를 넣을 여백을 만들어주세요." rows={3} />
            <span className="request-help">{protectedRegion ? "제품 보호 영역이 지정됐어요. 모든 사이즈에서 이 영역을 우선 보존합니다." : "이 요청은 선택한 모든 사이즈에 우선 적용됩니다."}</span>
          </div>
        </div>

        <div className="step-card size-card">
          <div className="section-heading size-heading">
            <span className="step-number">2</span>
            <div><h2>필요한 사이즈 고르기</h2><p>즐겨찾기와 직접 만든 사이즈는 다음에도 유지돼요.</p></div>
            <button className="add-size-button" onClick={() => setCustomFormOpen((value) => !value)}>＋ 사이즈 직접 추가</button>
          </div>

          {customFormOpen && (
            <div className="custom-form">
              <label>이름<input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="예: 자사몰 메인 배너" /></label>
              <label>가로(px)<input type="number" min="40" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} placeholder="1200" /></label>
              <span className="multiply">×</span>
              <label>세로(px)<input type="number" min="40" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} placeholder="400" /></label>
              <button onClick={addCustomSize}>추가하기</button>
            </div>
          )}

          <div className="channel-tabs" role="tablist" aria-label="매체 선택">
            {CHANNELS.map((channel) => (
              <button key={channel.id} role="tab" aria-selected={activeChannel === channel.id} className={activeChannel === channel.id ? "active" : ""} onClick={() => setActiveChannel(channel.id)}>{channel.label}</button>
            ))}
          </div>

          {visibleSizes.length ? (
            <div className="size-grid">
              {visibleSizes.map((size) => {
                const checked = selected.includes(size.id);
                const favorite = favorites.includes(size.id);
                return (
                  <article className={`size-option ${checked ? "selected" : ""}`} key={size.id}>
                    <button className="select-area" onClick={() => toggleSelected(size.id)} aria-pressed={checked}>
                      <span className="checkmark">{checked ? "✓" : ""}</span>
                      <span className="size-copy"><strong>{size.name}</strong><span>{size.width} × {size.height}</span><small>{CHANNEL_LABEL[size.channel]}{size.note ? ` · ${size.note}` : ""}</small></span>
                    </button>
                    <button className={`star ${favorite ? "on" : ""}`} onClick={() => toggleFavorite(size.id)} aria-label={`${size.name} ${favorite ? "즐겨찾기 해제" : "즐겨찾기"}`}>{favorite ? "★" : "☆"}</button>
                    {size.custom && <button className="remove-custom" onClick={() => removeCustomSize(size.id)} aria-label={`${size.name} 삭제`}>×</button>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><span>☆</span><strong>아직 저장된 사이즈가 없어요</strong><p>별표를 누르거나 직접 사이즈를 추가해보세요.</p></div>
          )}

          <div className="generate-bar">
            <div><strong>{selected.length}개 사이즈 선택</strong><span>{file ? "이미지 준비 완료" : "먼저 원본 이미지를 올려주세요"}</span></div>
            <button className="primary-button" disabled={!file || selected.length === 0} onClick={generate}>{selected.length}개 소재 만들기 <span>→</span></button>
          </div>
        </div>
      </section>

      {generated && (
        <section className="results" id="results">
          <div className="results-heading"><div><p className="eyebrow">변환 결과</p><h2>원본을 지키는 방식으로 만들었어요</h2><p>결과마다 방식을 바꾸거나, 원하는 수정 내용을 바로 요청할 수 있습니다.</p></div><span className="result-count">{selectedSizes.length}개 완료</span></div>
          <div className="results-grid">
            {selectedSizes.map((size) => {
              const strategy = strategyFor(size);
              const requestOpen = openRequests.includes(size.id);
              const plan = placementFor(size, strategy);
              if (!plan) return null;
              const cropOffset = cropYOffsets[size.id] || 0;
              const canMoveVertically = strategy === "crop" && !plan.fallback && plan.verticalTravel.total > .5;
              const positionLabel = cropOffset === 0 ? "가운데" : cropOffset < 0 ? `위 ${Math.abs(cropOffset)}%` : `아래 ${cropOffset}%`;
              return (
                <article className="result-card" key={size.id}>
                  <div className={`result-preview strategy-${strategy}`} style={{ aspectRatio: `${size.width} / ${size.height}` }}>
                    <ResultCanvas imageUrl={imageUrl} size={size} plan={plan} />
                    {size.id === "naver-mobile" && <span className="safe-zone">안전 영역</span>}
                    {protectedRegion && <span className="focus-indicator">⌗ {plan.fallback ? "보호영역 우선 · 배경확장" : strategy === "crop" ? "보호영역 중앙" : "보호영역 고정"}</span>}
                  </div>
                  <div className="result-body">
                    <div className="result-title"><div><strong>{size.name}</strong><span>{size.width} × {size.height} · {CHANNEL_LABEL[size.channel]}</span></div><span className={`strategy-badge ${plan.fallback ? "extend" : strategy}`}>{plan.fallback ? "보호 우선 확장" : strategy === "preserve" ? protectedRegion ? "보호영역 맞춤" : "원본 맞춤" : strategy === "extend" ? "원본 가장자리 확장" : protectedRegion ? "보호영역 크롭" : "가운데 크롭"}</span></div>
                    <div className="strategy-control" aria-label={`${size.name} 맞춤 방식`}>
                      <button className={strategy === "preserve" ? "active" : ""} onClick={() => setStrategy(size.id, "preserve")}>원본 맞춤</button>
                      <button className={strategy === "extend" ? "active" : ""} onClick={() => setStrategy(size.id, "extend")}>배경 확장</button>
                      <button className={strategy === "crop" ? "active" : ""} onClick={() => setStrategy(size.id, "crop")}>크롭</button>
                    </div>
                    <p className="mode-description">{strategy === "preserve" ? "원본 전체를 담고 보호영역을 가운데에 고정해요." : strategy === "extend" ? "원본 전체를 유지하고 가장자리 장면을 반사해 빈 공간까지 이어 붙여요." : plan.fallback ? "보호영역이 지면보다 커서 자르지 않고 원본 가장자리를 확장했어요." : "보호영역을 가운데에 두고 지면을 가득 채워요."}</p>
                    {strategy === "crop" && (
                      <div className={`crop-position-control ${canMoveVertically ? "" : "disabled"}`}>
                        <div><label htmlFor={`crop-y-${size.id}`}>제품 상하 위치 <strong>{positionLabel}</strong></label><button disabled={cropOffset === 0} onClick={() => setCropYOffsets((current) => ({ ...current, [size.id]: 0 }))}>가운데로</button></div>
                        <div className="position-slider"><span>위</span><input id={`crop-y-${size.id}`} type="range" min="-100" max="100" step="1" value={cropOffset} disabled={!canMoveVertically} onChange={(event) => setCropYOffsets((current) => ({ ...current, [size.id]: Number(event.target.value) }))} /><span>아래</span></div>
                        <small>{plan.fallback ? "보호영역이 잘리지 않도록 배경 확장으로 전환됐어요." : canMoveVertically ? "보호영역이 잘리지 않는 범위에서만 이동해요." : "이 규격에서는 이동할 수 있는 여유가 없어요."}</small>
                      </div>
                    )}
                    <div className="result-actions">
                      <button className="request-button" onClick={() => setOpenRequests((current) => current.includes(size.id) ? current.filter((id) => id !== size.id) : [...current, size.id])}>✦ 이 사이즈 수정 요청</button>
                      <button className="download-button" onClick={() => downloadOutput(size)}>↓ PNG</button>
                    </div>
                    {requestOpen && (
                      <div className="card-request">
                        <label htmlFor={`request-${size.id}`}>AI에게 원하는 결과를 설명해주세요</label>
                        <textarea id={`request-${size.id}`} value={cardRequests[size.id] || ""} onChange={(event) => setCardRequests((current) => ({ ...current, [size.id]: event.target.value }))} placeholder="예: 얼굴이 잘리지 않도록 이미지를 조금 왼쪽으로 옮겨주세요." rows={3} />
                        <button onClick={() => setSavedRequests((current) => current.includes(size.id) ? current : [...current, size.id])}>{savedRequests.includes(size.id) ? "요청 반영 대기 중 ✓" : "이 요청으로 다시 만들기"}</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <footer><span>리사이즈랩 BETA</span><p>광고 소재 제작 시간을 줄이고, 중요한 크리에이티브는 지킵니다.</p></footer>
    </main>
  );
}
