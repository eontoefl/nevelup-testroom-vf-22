/**
 * ================================================
 * Listening Module 시작 함수 (NEW ModuleController 사용)
 * ================================================
 * 
 * 범용 ModuleController (js/module-controller.js)를 사용합니다.
 */

// 전역 함수: Listening Module 시작
function startListeningModule(moduleNum) {
    console.log('='.repeat(80));
    console.log(`🎧 Listening Module ${moduleNum} 시작 (NEW ModuleController)`);
    console.log('='.repeat(80));
    
    // 새 모듈 시스템 사용
    const moduleConfig = getModule('listening', moduleNum);
    const controller = new ModuleController(moduleConfig);
    
    controller.setOnComplete((result) => {
        console.log('✅ Listening Module 완료:', result);
        
        // 결과 화면 표시
        window.showModuleResult(result);
    });
    
    controller.startModule();
}
