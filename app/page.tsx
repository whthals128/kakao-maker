"use client";

import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Channel = "meta" | "google" | "kakao" | "naver" | "brand" | "custom";
type Strategy = "preserve" | "extend" | "crop";
type ProtectedRegion = { x: number; y: number; width: number; height: number };
type ImagePlacement = { x: number; y: number; width: number; height: number; needsBackdrop: boolean };
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
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(nextFile);
    const image = new Image();
    image.onload = () => setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
    setFile(nextFile);
    setImageUrl(url);
    setProtectedRegion(null);
    setProtectMode(false);
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

  function finishRegionSelection() {
    if (!dragStart.current) return;
    dragStart.current = null;
    setProtectMode(false);
    setProtectedRegion((region) => region && region.width > .02 && region.height > .02 ? region : null);
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

  function protectedCropPlacement(targetWidth: number, targetHeight: number, imageWidth = sourceSize.width, imageHeight = sourceSize.height): ImagePlacement | null {
    if (!protectedRegion || !imageWidth || !imageHeight) return null;

    // Give the user-drawn box a small safety margin so the product never sits on a crop edge.
    const margin = .015;
    const left = Math.max(0, protectedRegion.x - margin);
    const top = Math.max(0, protectedRegion.y - margin);
    const right = Math.min(1, protectedRegion.x + protectedRegion.width + margin);
    const bottom = Math.min(1, protectedRegion.y + protectedRegion.height + margin);
    const regionWidth = Math.max(.001, right - left) * imageWidth;
    const regionHeight = Math.max(.001, bottom - top) * imageHeight;
    const coverScale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
    const keepRegionScale = Math.min(targetWidth / regionWidth, targetHeight / regionHeight);
    const scale = Math.min(coverScale, keepRegionScale);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const desiredX = targetWidth / 2 - ((left + right) / 2) * imageWidth * scale;
    const desiredY = targetHeight / 2 - ((top + bottom) / 2) * imageHeight * scale;

    const placeAxis = (target: number, drawn: number, start: number, end: number, desired: number) => {
      if (drawn <= target) return (target - drawn) / 2;
      const minimum = Math.max(target - drawn, -start);
      const maximum = Math.min(0, target - end);
      return Math.max(minimum, Math.min(maximum, desired));
    };

    const x = placeAxis(targetWidth, width, left * imageWidth * scale, right * imageWidth * scale, desiredX);
    const y = placeAxis(targetHeight, height, top * imageHeight * scale, bottom * imageHeight * scale, desiredY);
    return { x, y, width, height, needsBackdrop: width < targetWidth - .5 || height < targetHeight - .5 };
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
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = size.width / size.height;
    const cover = strategy === "crop";
    const protectedPlacement = cover ? protectedCropPlacement(size.width, size.height, image.naturalWidth, image.naturalHeight) : null;

    if (strategy === "extend" || protectedPlacement?.needsBackdrop) {
      const bgScale = targetRatio > sourceRatio ? size.width / image.naturalWidth : size.height / image.naturalHeight;
      const bgWidth = image.naturalWidth * bgScale;
      const bgHeight = image.naturalHeight * bgScale;
      ctx.filter = `blur(${Math.max(size.width, size.height) * 0.025}px) brightness(.72)`;
      ctx.drawImage(image, (size.width - bgWidth) / 2, (size.height - bgHeight) / 2, bgWidth, bgHeight);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#eef0f5";
      ctx.fillRect(0, 0, size.width, size.height);
    }

    const scale = cover
      ? (targetRatio > sourceRatio ? size.width / image.naturalWidth : size.height / image.naturalHeight)
      : (targetRatio > sourceRatio ? size.height / image.naturalHeight : size.width / image.naturalWidth);
    const drawWidth = protectedPlacement?.width ?? image.naturalWidth * scale;
    const drawHeight = protectedPlacement?.height ?? image.naturalHeight * scale;
    const drawX = protectedPlacement?.x ?? (size.width - drawWidth) / 2;
    const drawY = protectedPlacement?.y ?? (size.height - drawHeight) / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const link = document.createElement("a");
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "creative"}_${size.width}x${size.height}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
                <div className="image-stage">
                  <img src={imageUrl} alt="업로드한 원본" />
                  <div className="selection-layer" onPointerDown={startRegionSelection} onPointerMove={updateRegionSelection} onPointerUp={finishRegionSelection} onPointerCancel={finishRegionSelection}>
                    {protectedRegion && <span className="protected-region" style={{ left: `${protectedRegion.x * 100}%`, top: `${protectedRegion.y * 100}%`, width: `${protectedRegion.width * 100}%`, height: `${protectedRegion.height * 100}%` }}><b>제품 보호 영역</b></span>}
                    {protectMode && !protectedRegion && <em>제품 주위를 드래그해주세요</em>}
                  </div>
                </div>
              </div>
              <div className="source-info">
                <div><strong>{file?.name}</strong><span>{sourceSize.width} × {sourceSize.height}px</span></div>
                <div className="source-buttons"><button className={protectedRegion ? "region-active" : ""} onClick={() => { setProtectMode(true); setProtectedRegion(null); }}>⌗ {protectedRegion ? "제품 범위 다시 지정" : "제품 범위 지정"}</button><button onClick={() => inputRef.current?.click()}>이미지 교체</button></div>
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
              const protectedPlacement = strategy === "crop" ? protectedCropPlacement(size.width, size.height) : null;
              const placementStyle = protectedPlacement ? {
                left: `${protectedPlacement.x / size.width * 100}%`,
                top: `${protectedPlacement.y / size.height * 100}%`,
                width: `${protectedPlacement.width / size.width * 100}%`,
                height: `${protectedPlacement.height / size.height * 100}%`,
              } : undefined;
              return (
                <article className="result-card" key={size.id}>
                  <div className={`result-preview strategy-${strategy}`} style={{ aspectRatio: `${size.width} / ${size.height}` }}>
                    {(strategy === "extend" || protectedPlacement?.needsBackdrop) && <img className="blur-layer" src={imageUrl} alt="" />}
                    <img className={`main-layer ${protectedPlacement ? "protected-placement" : ""}`} src={imageUrl} alt={`${size.name} 미리보기`} style={placementStyle} />
                    {size.id === "naver-mobile" && <span className="safe-zone">안전 영역</span>}
                    {protectedRegion && <span className="focus-indicator">⌗ 보호영역 전체 보존</span>}
                  </div>
                  <div className="result-body">
                    <div className="result-title"><div><strong>{size.name}</strong><span>{size.width} × {size.height} · {CHANNEL_LABEL[size.channel]}</span></div><span className={`strategy-badge ${strategy}`}>{strategy === "preserve" ? "원본 유지" : strategy === "extend" ? "배경 확장" : protectedPlacement?.needsBackdrop ? "보호영역 맞춤" : protectedPlacement ? "보호 크롭" : "스마트 크롭"}</span></div>
                    <div className="strategy-control" aria-label={`${size.name} 맞춤 방식`}>
                      <button className={strategy === "preserve" ? "active" : ""} onClick={() => setStrategy(size.id, "preserve")}>원본 맞춤</button>
                      <button className={strategy === "extend" ? "active" : ""} onClick={() => setStrategy(size.id, "extend")}>배경 확장</button>
                      <button className={strategy === "crop" ? "active" : ""} onClick={() => setStrategy(size.id, "crop")}>크롭</button>
                    </div>
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
