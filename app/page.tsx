const makers = [
  {
    key: "focus",
    eyebrow: "NAVER SHOPPING BLOCK",
    title: "FOCUS MAKER",
    description: "로고와 상품 이미지를 넣고 네이버 포커스템 300×464 소재를 제작합니다.",
    specs: ["300 × 464", "PNG · JPG", "400KB 자동 점검"],
    href: "/focus-maker",
    cta: "Focus Maker 시작",
  },
  {
    key: "kakao",
    eyebrow: "KAKAO BIZBOARD",
    title: "KAKAO MAKER",
    description: "배지 플래그형과 중앙 오브젝트형 비즈보드를 가이드 안에서 제작합니다.",
    specs: ["1029 × 258", "PNG", "심사 가이드 점검"],
    href: "/kakao-maker",
    cta: "Kakao Maker 시작",
  },
] as const;

export default function MakerHub() {
  return (
    <main className="hub-page">
      <header className="hub-topbar">
        <a className="hub-brand" href="/" aria-label="Creative Maker 홈">
          <span>CM</span>
          <b>CREATIVE MAKER</b>
        </a>
        <div className="hub-topbar-meta"><span>2 MAKERS</span><i /><span>MORE TO COME</span></div>
      </header>

      <section className="hub-hero">
        <div>
          <span className="hub-eyebrow">AD CREATIVE WORKSPACE</span>
          <h1>필요한 광고 소재를<br /><em>한 곳에서 만드세요.</em></h1>
          <p>채널별 가이드는 정확하게, 작업 과정은 익숙하게.<br />Focus Maker와 Kakao Maker를 하나의 제작 허브에서 이용할 수 있습니다.</p>
          <a className="hub-scroll-link" href="#makers">메이커 선택하기 <span>↓</span></a>
        </div>
        <aside className="hub-summary" aria-label="Creative Maker 서비스 요약">
          <div><span>AVAILABLE</span><b>02</b><small>지금 사용할 수 있는 메이커</small></div>
          <div><span>WORKFLOW</span><b>AUTO SAVE</b><small>메이커별 마지막 작업 자동 저장</small></div>
          <p>새로운 매체와 소재 유형을 지속적으로 추가할 예정입니다.</p>
        </aside>
      </section>

      <section className="hub-makers" id="makers" aria-labelledby="makers-title">
        <div className="hub-section-heading">
          <div><span>01</span><h2 id="makers-title">어떤 소재를 만들까요?</h2></div>
          <p>각 메이커의 작업과 이미지는 서로 분리되어 저장됩니다.</p>
        </div>

        <div className="hub-maker-grid">
          {makers.map((maker) => (
            <article className={`hub-maker-card ${maker.key}`} key={maker.key}>
              <div className="hub-maker-copy">
                <div className="hub-maker-label"><span>{maker.eyebrow}</span><b>사용 가능</b></div>
                <h3>{maker.title}</h3>
                <p>{maker.description}</p>
                <ul>{maker.specs.map((spec) => <li key={spec}>{spec}</li>)}</ul>
                <a href={maker.href}>{maker.cta}<span>→</span></a>
              </div>
              {maker.key === "focus" ? (
                <div className="hub-visual focus" aria-hidden="true">
                  <div className="focus-sheet"><i className="focus-logo" /><i className="focus-product" /><span /><span /></div>
                  <b>300 × 464</b>
                </div>
              ) : (
                <div className="hub-visual kakao" aria-hidden="true">
                  <div className="kakao-sheet"><span /><i /><span /></div>
                  <b>1029 × 258</b>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="hub-roadmap">
          <div><span>+</span><div><b>다음 메이커도 이곳에 추가됩니다</b><small>한 번 익힌 흐름으로 다양한 매체 소재를 제작할 수 있도록 확장합니다.</small></div></div>
          <p>필요한 소재 유형이 있다면 <a href="mailto:somin.jo@playd.com">somin.jo@playd.com</a>으로 알려주세요.</p>
        </div>
      </section>

      <footer className="hub-footer"><b>CREATIVE MAKER</b><span>Focus Maker · Kakao Maker</span><span>문의 somin.jo@playd.com</span></footer>
    </main>
  );
}
