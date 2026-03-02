/**
 * ================================================
 * supabase-data-config.js
 * 데이터 소스 전환 설정 (Supabase ↔ Google Sheets)
 * ================================================
 * 
 * USE_SUPABASE = true  → Supabase에서 데이터 로드 (기본값)
 * USE_SUPABASE = false → 기존 Google Sheets에서 데이터 로드 (폴백)
 * 
 * Supabase 로드 실패 시 자동으로 Google Sheets로 폴백됩니다.
 * 수동으로 끄려면 USE_SUPABASE = false 로 변경하세요.
 */

const USE_SUPABASE = true;

/**
 * Supabase에서 데이터를 가져오는 공통 헬퍼
 * 실패 시 null 반환 → 호출측에서 Google Sheets 폴백
 * 
 * @param {string} table - 테이블명 (예: 'tr_reading_daily1')
 * @param {string} query - Supabase REST 쿼리 (예: 'select=*&order=id.asc')
 * @param {string} label - 로그용 라벨 (예: '[Daily1]')
 * @returns {Promise<Array|null>} 데이터 배열 또는 null
 */
async function fetchFromSupabase(table, query, label) {
    if (!USE_SUPABASE) {
        console.log(`📋 ${label} Supabase 비활성화 → Google Sheets 사용`);
        return null;
    }
    
    if (typeof supabaseSelect !== 'function') {
        console.warn(`⚠️ ${label} supabaseSelect 함수 없음 → Google Sheets 폴백`);
        return null;
    }
    
    try {
        const rows = await supabaseSelect(table, query);
        
        if (!rows || rows.length === 0) {
            console.warn(`⚠️ ${label} Supabase 데이터 없음 → Google Sheets 폴백`);
            return null;
        }
        
        console.log(`✅ ${label} Supabase에서 ${rows.length}건 로드 성공`);
        return rows;
        
    } catch (error) {
        console.error(`❌ ${label} Supabase 로드 실패 → Google Sheets 폴백:`, error.message);
        return null;
    }
}

console.log(`✅ supabase-data-config.js 로드 완료 (USE_SUPABASE: ${USE_SUPABASE})`);
