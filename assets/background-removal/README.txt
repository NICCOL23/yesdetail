YesDetail 브라우저 배경 제거
모델: U2Netp (U²-Net 경량 모델). Apache-2.0. 저자 Xuebin Qin 등.
원본 소스: https://github.com/xuebinqin/U-2-Net
모델 배포: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
모델 MD5: 8e83ca70e441ab06c318d82300c84806 (rembg 공식 참조값과 확인)
실행: ONNX Runtime Web 1.20.1, MIT. https://github.com/microsoft/onnxruntime
사전/사후 처리 참고: rembg U2netpSession/BaseSession (MIT), https://github.com/danielgatis/rembg
동봉: U2Net-LICENSE.txt, ONNXRuntime-LICENSE.txt, ONNXRuntime-ThirdPartyNotices.txt.
이 경량 모델이 모든 사진에서 정확한 누끼를 보장하지 않습니다. 투명 원본/복원과 비교 확인을 사용하세요.
앱은 모델과 WASM을 동일 사이트에서 내려받으며 사진은 Worker 메모리에서 처리합니다. 외부 추론 API, API 키, 이용 요금 없음.
최초 파일 합계 약 15.9MB(모델 약4.6MB, WASM 약11.2MB 외 JS). 브라우저 캐시 상태에 따라 재다운로드할 수 있음.
현대 Edge/Chrome 등 WebAssembly SIMD, Web Worker, OffscreenCanvas, createImageBitmap 지원 필요. GPU/교차 출처 격리 불필요. 저사양 기기는 느리거나 메모리 부족으로 실패할 수 있음.
결과 긴 변 최대2048px. 원본 RGB를 유지하고 추론 마스크로 투명도만 조절, 투명 바깥 여백만 잘라 배치. 원본은 별도 보존.
