export default function FocusMakerPage() {
  return (
    <main className="maker-embed-shell">
      <header className="maker-route-topbar focus-route">
        <a className="maker-route-brand" href="/" aria-label="Creative Maker 홈으로 이동">
          <span>F</span>
          <div><small>CREATIVE MAKER</small><b>FOCUS MAKER</b></div>
        </a>
        <nav aria-label="메이커 이동">
          <a href="/">전체 메이커</a>
          <a href="/kakao-maker">Kakao Maker</a>
        </nav>
      </header>
      <iframe
        className="maker-embed-frame"
        src="/focus-maker-app/index.html?embedded=1"
        title="Focus Maker 네이버 포커스템 소재 제작"
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
