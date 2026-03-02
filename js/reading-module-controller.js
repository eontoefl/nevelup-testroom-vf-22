/**
 * ================================================
 * Reading Module 시작 함수 (NEW ModuleController 사용)
 * ================================================
 * 
 * 옛날 ReadingModuleController는 삭제되고,
 * 새로운 범용 ModuleController (js/module-controller.js)를 사용합니다.
 */

// 전역 함수: Reading Module 시작
function startReadingModule(moduleNum) {
    console.log('='.repeat(80));
    console.log(`📖 Reading Module ${moduleNum} 시작 (NEW ModuleController)`);
    console.log('='.repeat(80));
    
    // 새 모듈 시스템 사용
    const moduleConfig = getModule('reading', moduleNum);
    const controller = new ModuleController(moduleConfig);
    
    controller.setOnComplete((result) => {
        console.log('✅ Reading Module 완료:', result);
        
        // 결과 화면 표시
        window.showModuleResult(result);
    });
    
    controller.startModule();
}
