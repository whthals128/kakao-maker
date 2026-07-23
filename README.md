# Creative Maker

채널별 광고 소재를 한 사이트에서 제작하는 웹 서비스입니다. 현재 Focus Maker와 Kakao Maker를 제공하며 새로운 매체와 소재 유형을 지속적으로 추가할 수 있는 허브 구조로 구성되어 있습니다.

## Live

- [Creative Maker 실행하기](https://kakao-maker-kr.whthals128.chatgpt.site/)

## 제공 메이커

### Focus Maker

- 네이버 포커스템 300×464 소재 제작
- 브랜드 로고와 상품 이미지 등록
- 이미지 크기·위치 및 광고 문구 조정
- PNG·JPG 저장과 400KB 용량 점검
- 작업 자동 저장 및 백업 파일 내보내기·불러오기

### Kakao Maker

- 카카오 비즈보드 배지 플래그형·중앙 오브젝트형 제작
- 상품 이미지 2개 겹침 배치와 개별·동시 조정
- 메인·서브 카피 크기와 정렬 조정
- 가이드 영역 자동 잘림과 PNG 300KB 점검
- 제작 유형별 마지막 작업 자동 저장

각 메이커는 서로 다른 브라우저 저장소를 사용하므로 작업 내용과 등록 이미지가 서로 덮어쓰이지 않습니다.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

배포용 빌드는 `npm run build`로 확인합니다.

## 문의

문의사항 및 추가 요청 사항은 [somin.jo@playd.com](mailto:somin.jo@playd.com)으로 연락바랍니다.
