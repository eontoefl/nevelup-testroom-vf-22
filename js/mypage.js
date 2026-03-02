/**
 * ================================================
 * mypage.js – 마이페이지 Supabase 연동 로직
 * ================================================
 * 
 * sessionStorage의 currentUser 정보로 Supabase 데이터를 불러와
 * 학습 현황, 잔디, 최근 기록을 렌더링합니다.
 * 
 * 의존: supabase-client.js (supabaseSelect 등)
 */

// ================================================
// 전역 상태
// ================================================
let mpUser = null;           // sessionStorage에서 로드한 유저 정보
let mpStudyRecords = [];     // tr_study_records
let mpAuthRecords = [];      // tr_auth_records
let mpGradeRules = [];       // tr_grade_rules (등급/환급 기준표)
let mpDeadlineExtensions = []; // tr_deadline_extensions (데드라인 연장)

// ================================================
// 스케줄 데이터 (총 과제 수 / 총 일수 계산용)
// ================================================
// 총 일수/과제 수는 DOM에서 동적으로 계산
function getScheduleMeta(programType) {
    const gridId = programType === 'fast' ? 'grass-fast' : 'grass-standard';
    const cells = document.querySelectorAll(`#${gridId} .g`);
    const totalTasks = cells.length;

    // 고유 day 수 = 총 학습일
    const daySet = new Set();
    cells.forEach(c => daySet.add(c.dataset.day));
    const totalDays = daySet.size;

    return { totalDays, totalTasks };
}

// task_type을 요일 매핑하기 위한 한→영 변환
const DAY_MAP_KR_TO_NUM = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5 };

// ================================================
// 초기화
// ================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 [MyPage] 초기화 시작');

    // 1. 세션에서 유저 정보 로드
    const saved = sessionStorage.getItem('currentUser');
    if (!saved) {
        showNotLoggedIn();
        return;
    }

    mpUser = JSON.parse(saved);
    console.log('📊 [MyPage] 유저:', mpUser.name, mpUser.programType);

    // 2. UI 기본 세팅
    document.getElementById('userName').textContent = mpUser.name;
    document.getElementById('programBadge').textContent = mpUser.program || '내벨업챌린지';

    // 플랜 탭 - 유저의 프로그램에 맞춰 활성화
    setupPlanTabs();

    // 3. Supabase에서 데이터 로드
    try {
        await loadAllData();
        renderAll();
    } catch (err) {
        console.error('❌ [MyPage] 데이터 로드 실패:', err);
    }

    // 4. 화면 전환
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
});

// ================================================
// 데이터 로드
// ================================================
async function loadAllData() {
    const userId = mpUser.id;
    console.log('📊 [MyPage] 데이터 로드 시작 - userId:', userId);

    // 학습 기록 전체 로드 (result_json은 대용량이므로 제외 - 다시보기 클릭 시 별도 로드)
    mpStudyRecords = await supabaseSelect(
        'tr_study_records',
        `user_id=eq.${userId}&order=completed_at.desc&select=id,user_id,week,day,task_type,module_number,attempt,score,total,time_spent,detail,error_note_text,memo_text,completed_at`
    ) || [];

    // 인증 기록 전체 로드
    mpAuthRecords = await supabaseSelect(
        'tr_auth_records',
        `user_id=eq.${userId}&order=created_at.desc&select=*`
    ) || [];

    // 등급/환급 기준표 로드
    mpGradeRules = await supabaseSelect(
        'tr_grade_rules',
        'order=min_rate.desc'
    ) || [];

    // 데드라인 연장 기록 로드
    mpDeadlineExtensions = await supabaseSelect(
        'tr_deadline_extensions',
        `user_id=eq.${userId}&select=original_date,extra_days`
    ) || [];

    console.log(`📊 [MyPage] 로드 완료 - 학습기록: ${mpStudyRecords.length}건, 인증기록: ${mpAuthRecords.length}건, 등급규칙: ${mpGradeRules.length}건, 연장: ${mpDeadlineExtensions.length}건`);
}

// ================================================
// 전체 렌더링
// ================================================
function renderAll() {
    renderSummaryCards();
    renderDeadlineExtensionBanner();
    renderGrass();
    renderRecentRecords();
}

// ================================================
// 데드라인 연장 알림 배너 렌더링
// ================================================
function renderDeadlineExtensionBanner() {
    const container = document.getElementById('deadlineExtensionBanner');
    if (!container) return;

    // 활성 연장 건 필터 (마감이 아직 안 지난 것만)
    if (!mpDeadlineExtensions || mpDeadlineExtensions.length === 0 || !mpUser.startDate) {
        container.innerHTML = '';
        return;
    }

    const now = new Date();
    const dayKrNames = ['일', '월', '화', '수', '목', '금', '토'];
    const activeExtensions = [];

    mpDeadlineExtensions.forEach(ext => {
        const origDate = new Date(ext.original_date + 'T00:00:00');
        if (isNaN(origDate.getTime())) return;

        // 연장된 마감 계산 (task-router.js와 동일)
        let extDeadline = new Date(origDate);
        extDeadline.setDate(extDeadline.getDate() + 1);
        extDeadline.setHours(4, 0, 0, 0);
        extDeadline.setDate(extDeadline.getDate() + (ext.extra_days || 1));

        if (now < extDeadline) {
            activeExtensions.push({
                originalDate: origDate,
                deadline: extDeadline,
                extraDays: ext.extra_days || 1
            });
        }
    });

    if (activeExtensions.length === 0) {
        container.innerHTML = '';
        return;
    }

    // 마감이 가까운 순으로 정렬
    activeExtensions.sort((a, b) => a.deadline - b.deadline);

    const items = activeExtensions.map(ext => {
        const origM = ext.originalDate.getMonth() + 1;
        const origD = ext.originalDate.getDate();
        const origDay = dayKrNames[ext.originalDate.getDay()];
        const dlM = ext.deadline.getMonth() + 1;
        const dlD = ext.deadline.getDate();
        const dlDay = dayKrNames[ext.deadline.getDay()];
        return `<div class="ext-banner-item">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span><strong>${origM}/${origD}(${origDay})</strong> 과제의 마감이 <strong>${dlM}/${dlD}(${dlDay}) 새벽 4시</strong>까지 연장되었습니다.</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="ext-banner">
            <div class="ext-banner-header">
                <i class="fa-solid fa-calendar-plus"></i> 데드라인 연장 안내
            </div>
            ${items}
        </div>
    `;

    console.log(`📊 [MyPage] 데드라인 연장 알림 ${activeExtensions.length}건 표시`);
}

// ================================================
// 시작 전 여부 판별
// ================================================
function isBeforeStart() {
    if (!mpUser.startDate) return false; // 시작일 정보 없으면 진행중으로 간주
    const start = new Date(mpUser.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    return now < start;
}

// 등급/환급 산정 전 여부: 시작일 다음날부터 산정 (시작일 당일 포함 = 산정 전)
function isGradeBeforeStart() {
    if (!mpUser.startDate) return false;
    const start = new Date(mpUser.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    return now <= start; // 당일 포함
}

function getDaysUntilStart() {
    if (!mpUser.startDate) return 0;
    const start = new Date(mpUser.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    if (now.getHours() < 4) now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    return Math.ceil((start - now) / (1000 * 60 * 60 * 24));
}

function formatStartDate(dateStr) {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

// ================================================
// ① 학습 현황 요약 카드 렌더링 (v2 — STUDENT_METRICS.md 기준)
// ================================================
function renderSummaryCards() {
    const programType = mpUser.programType || 'standard';
    const totalWeeks = programType === 'standard' ? 8 : 4;
    const totalCalendarDays = totalWeeks * 7; // 총 달력 일수

    // ── 경과일 / 잔여일 / 전체일 계산 ──
    const startDate = new Date(mpUser.startDate);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    if (today.getHours() < 4) today.setDate(today.getDate() - 1);
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalCalendarDays - 1);

    const beforeStart = isBeforeStart();

    // 1칸: 챌린지 현황
    if (beforeStart) {
        const daysLeft = getDaysUntilStart();
        const startStr = formatStartDate(mpUser.startDate);
        document.getElementById('challengeStatus').textContent = `D-${daysLeft}`;
        document.getElementById('challengeBar').style.width = '0%';
        document.getElementById('challengeSub').textContent = `${startStr} 시작 예정`;
    } else {
        const dplus = Math.min(Math.floor((today - startDate) / (1000 * 60 * 60 * 24)), totalCalendarDays);
        const remainingDays = Math.max(0, totalCalendarDays - dplus);
        const elapsedPct = Math.min(100, Math.round((dplus / totalCalendarDays) * 100));
        document.getElementById('challengeStatus').textContent = `D+${dplus} / ${totalCalendarDays}일`;
        document.getElementById('challengeBar').style.width = `${elapsedPct}%`;
        document.getElementById('challengeSub').textContent = `잔여 ${remainingDays}일`;
    }

    // ── 오늘까지 할당된 과제 수 계산 ──
    const taskStats = countTasksDueToday(programType, totalWeeks);
    const tasksDueToday = taskStats.due;
    const tasksSubmitted = taskStats.completed;

    // 시작 전인데 미리 제출한 경우: 분모 0이지만 분자가 있음
    let submitPct, submitSubText;
    if (tasksDueToday === 0 && mpStudyRecords.length > 0) {
        // 선제출: 퍼센트 대신 건수로 표시
        submitPct = 0; // 바는 0%
        submitSubText = `${mpStudyRecords.length}건 미리 완료 🎉`;
        document.getElementById('submitRate').textContent = mpStudyRecords.length;
        document.getElementById('submitRateUnit').textContent = '건';
    } else {
        submitPct = tasksDueToday > 0 ? Math.round((tasksSubmitted / tasksDueToday) * 100) : 0;
        submitSubText = `${tasksSubmitted}/${tasksDueToday}개 완료`;
        document.getElementById('submitRate').textContent = submitPct;
        document.getElementById('submitRateUnit').textContent = '%';
    }

    // 2칸: 제출률
    document.getElementById('submitBar').style.width = `${Math.min(submitPct, 100)}%`;
    document.getElementById('submitSub').textContent = submitSubText;

    // ── 인증률 계산 (auth_rate 합계 / 오늘까지 할당 과제 수 × 100) ──
    let authRateSum = 0;
    mpAuthRecords.forEach(r => { authRateSum += (r.auth_rate || 0); });

    // 분모 결정: 도래일이 0이면 제출 건수를 분모로 사용 (선제출 케이스)
    const authDenominator = tasksDueToday > 0 ? tasksDueToday : tasksSubmitted;

    let authRatePct, authSubText;
    if (authDenominator > 0) {
        authRatePct = Math.round(authRateSum / authDenominator);
        const authCompleted = Math.round(authRateSum / 100);
        if (tasksDueToday === 0) {
            authSubText = `인증 ${authCompleted} / ${tasksSubmitted}건 (시작 전)`;
        } else {
            authSubText = `인증 ${authCompleted} / ${tasksDueToday}건`;
        }
    } else {
        authRatePct = 0;
        authSubText = '데이터 없음';
    }

    // 3칸: 인증률
    document.getElementById('authRate').textContent = authRatePct;
    document.getElementById('authRateUnit').textContent = '%';
    document.getElementById('authBar').style.width = `${Math.min(authRatePct, 100)}%`;
    document.getElementById('authSub').textContent = authSubText;

    // ── 등급 & 환급 계산 (tr_grade_rules 테이블 연동) ──
    // 시작 전이면 무조건 등급 미산정
    if (isGradeBeforeStart()) {
        document.getElementById('currentGrade').textContent = '-';
        document.getElementById('gradeRefund').textContent = '시작 후 산정';
    } else {
        const grade = getGradeFromRules(authRatePct);
        const gradeEl = document.getElementById('currentGrade');
        gradeEl.textContent = grade.letter;

        // 등급 배경색 적용 (글자는 흰색 유지)
        gradeEl.style.background = grade.color;
        gradeEl.style.color = '#fff';

        const refundAmount = Math.round(grade.deposit * grade.refundRate);
        document.getElementById('gradeRefund').innerHTML = 
            `환급 ${Math.round(grade.refundRate * 100)}% (${refundAmount.toLocaleString()}원)`;
    }
}

/**
 * 오늘까지 할당된 과제 수 계산
 * 
 * 기준 (2/22 예시):
 * - 오늘의 마감: 2/23 새벽 4시
 * - 도래일: 마감(다음날 04:00)이 현재보다 과거인 과제
 * - 오늘: 과제 날짜가 오늘인 것 (마감 전이라도 분모에 포함)
 * - 미도래일: 과제 날짜가 내일 이후
 * - 분모 = 도래일 + 오늘
 * 
 * ※ 제출된 과제(분자)는 도래/미도래/오늘 상관없이 무조건 반영
 */
function countTasksDueToday(programType, totalWeeks) {
    if (!mpUser.startDate) return { due: 0, completed: 0 };
    if (typeof getDayTasks !== 'function') return { due: 0, completed: 0 };

    const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayEnToKr = { sunday: '일', monday: '월', tuesday: '화', wednesday: '수', thursday: '목', friday: '금' };
    const startDate = new Date(mpUser.startDate + 'T00:00:00');
    if (isNaN(startDate.getTime())) return { due: 0, completed: 0 };

    const now = new Date();

    // 새벽 4시 기준: 4시 이전이면 "오늘"은 어제
    const effectiveToday = new Date(now);
    if (now.getHours() < 4) {
        effectiveToday.setDate(effectiveToday.getDate() - 1);
    }
    effectiveToday.setHours(0, 0, 0, 0);

    let totalTasks = 0;
    let completedTasks = 0;

    for (let w = 1; w <= totalWeeks; w++) {
        for (let d = 0; d < dayOrder.length; d++) {
            const taskDate = new Date(startDate);
            taskDate.setDate(taskDate.getDate() + (w - 1) * 7 + d);
            taskDate.setHours(0, 0, 0, 0);

            // ★ 데드라인 연장 체크
            const taskDateStr = taskDate.getFullYear() + '-' +
                String(taskDate.getMonth() + 1).padStart(2, '0') + '-' +
                String(taskDate.getDate()).padStart(2, '0');
            const ext = (mpDeadlineExtensions || []).find(e => e.original_date === taskDateStr);
            
            // 연장된 과제: 연장된 마감이 아직 안 지났으면 분모에서 제외
            if (ext) {
                let extDeadline = new Date(taskDate);
                extDeadline.setDate(extDeadline.getDate() + 1);
                extDeadline.setHours(4, 0, 0, 0);
                extDeadline.setDate(extDeadline.getDate() + (ext.extra_days || 1));
                if (now < extDeadline) continue; // 연장 마감 전 → 분모 제외
            }

            // 과제 날짜가 오늘(effective) 이하면 분모에 포함
            if (taskDate <= effectiveToday) {
                const dayEn = dayOrder[d];
                const dayKr = dayEnToKr[dayEn];
                const tasks = getDayTasks(programType, w, dayEn);
                
                tasks.forEach(function(taskName) {
                    const parsed = (typeof parseTaskName === 'function') ? parseTaskName(taskName) : null;
                    if (!parsed || parsed.type === 'unknown') return;

                    totalTasks++;

                    // 완료 여부 확인 (progress-tracker와 동일 로직)
                    if (parsed.type === 'vocab' || parsed.type === 'intro-book') {
                        const found = mpStudyRecords.find(r => 
                            r.task_type === parsed.type && r.week === w && r.day === dayKr
                        );
                        if (found) completedTasks++;
                    } else {
                        const modNum = parsed.params && (parsed.params.module || parsed.params.number) 
                            ? (parsed.params.module || parsed.params.number) 
                            : parsed.moduleNumber;
                        const found = mpStudyRecords.find(r => 
                            r.task_type === parsed.type && r.module_number == modNum
                        );
                        if (found) completedTasks++;
                    }
                });
            }
        }
    }

    return { due: totalTasks, completed: completedTasks };
}

/**
 * tr_grade_rules 테이블에서 등급 판정
 * @param {number} authRatePct - 인증률 (0~100)
 * @returns {object} { letter, refundRate, deposit, color }
 */
function getGradeFromRules(authRatePct) {
    // tr_grade_rules에서 매칭 (min_rate DESC 정렬되어 있음)
    if (mpGradeRules && mpGradeRules.length > 0) {
        for (const rule of mpGradeRules) {
            if (authRatePct >= rule.min_rate) {
                return {
                    letter: rule.grade,
                    refundRate: rule.refund_rate,
                    deposit: rule.deposit || 100000,
                    color: getGradeColor(rule.grade)
                };
            }
        }
        // 어떤 규칙에도 안 걸리면 F
        const lastRule = mpGradeRules[mpGradeRules.length - 1];
        return {
            letter: lastRule.grade,
            refundRate: lastRule.refund_rate,
            deposit: lastRule.deposit || 100000,
            color: getGradeColor(lastRule.grade)
        };
    }

    // 폴백: tr_grade_rules 로드 실패 시 하드코딩
    console.warn('📊 [MyPage] tr_grade_rules 로드 실패, 폴백 사용');
    if (authRatePct >= 95) return { letter: 'A', refundRate: 1.0, deposit: 100000, color: '#22c55e' };
    if (authRatePct >= 90) return { letter: 'B', refundRate: 0.9, deposit: 100000, color: '#3b82f6' };
    if (authRatePct >= 80) return { letter: 'C', refundRate: 0.8, deposit: 100000, color: '#f59e0b' };
    if (authRatePct >= 70) return { letter: 'D', refundRate: 0.7, deposit: 100000, color: '#f97316' };
    return { letter: 'F', refundRate: 0, deposit: 100000, color: '#ef4444' };
}

/**
 * 등급별 색상
 */
function getGradeColor(grade) {
    const colors = { 'A': '#22c55e', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444' };
    return colors[grade] || '#6b7280';
}

// ================================================
// ② 잔디 렌더링
// ================================================
function renderGrass() {
    const programType = mpUser.programType || 'standard';
    const gridId = programType === 'fast' ? 'grass-fast' : 'grass-standard';

    // ★ 시작 전이어도 과제를 풀었으면 잔디에 표시
    const completedMap = buildCompletedMap();
    const currentDay = isBeforeStart() ? 0 : getCurrentScheduleDay(); // 시작 전이면 fail 처리 안 함

    // ★ 데드라인 연장된 dayNum 목록 계산
    const extendedDayNums = buildExtendedDayNums();

    document.querySelectorAll(`#${gridId} .g`).forEach(cell => {
        const dayNum = parseInt(cell.dataset.day);
        const order = parseInt(cell.dataset.order);

        // ★ 연장된 셀 테두리 표시
        if (extendedDayNums.has(dayNum)) {
            cell.classList.add('extended');
        }

        if (completedMap.has(`${dayNum}_${order}`)) {
            cell.classList.remove('empty', 'fail');
            cell.classList.add('success');
        } else if (dayNum < currentDay && !extendedDayNums.has(dayNum)) {
            // ★ 연장된 날짜는 빨간칸(fail) 처리 안 함
            cell.classList.remove('empty', 'success');
            cell.classList.add('fail');
        }
    });
}

/**
 * 데드라인 연장된 날짜 → dayNum 목록 (아직 마감 전인 것만)
 */
function buildExtendedDayNums() {
    const set = new Set();
    if (!mpUser.startDate || !mpDeadlineExtensions || mpDeadlineExtensions.length === 0) return set;

    const startDate = new Date(mpUser.startDate + 'T00:00:00');
    if (isNaN(startDate.getTime())) return set;

    const now = new Date();
    const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    mpDeadlineExtensions.forEach(ext => {
        const origDate = new Date(ext.original_date + 'T00:00:00');
        if (isNaN(origDate.getTime())) return;

        // 연장된 마감 계산 (task-router.js와 동일한 순서)
        let extDeadline = new Date(origDate);
        extDeadline.setDate(extDeadline.getDate() + 1);
        extDeadline.setHours(4, 0, 0, 0);
        extDeadline.setDate(extDeadline.getDate() + (ext.extra_days || 1));

        // 아직 마감 전이면 → dayNum 계산해서 추가
        if (now < extDeadline) {
            const diffMs = origDate - startDate;
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            // 토요일(6) 제외한 일차 계산: 7일 중 6일 사용
            const weekIndex = Math.floor(diffDays / 7);
            const dayIndex = diffDays % 7;
            if (dayIndex < dayOrder.length) {
                const dayNum = weekIndex * 6 + dayIndex + 1;
                set.add(dayNum);
            }
        }
    });

    return set;
}

/**
 * 완료된 과제 맵 생성
 * key: "dayNum_order" (잔디 HTML의 data-day + data-order)
 * 
 * tr_study_records의 (week, day, task_type, module_number)를
 * 잔디 그리드의 (dayNum, order)에 매핑
 */
function buildCompletedMap() {
    const map = new Map();
    const programType = mpUser.programType || 'standard';
    const gridId = programType === 'fast' ? 'grass-fast' : 'grass-standard';

    // task_type 매핑: Supabase → 잔디 data-type
    const typeMap = {
        'vocab': 'voca_test',
        'intro-book': 'intro_reading',
        'reading': 'reading_module',
        'listening': 'listening_module',
        'writing': 'writing',
        'speaking': 'speaking'
    };

    // 각 study_record → 해당 잔디 셀 매핑
    mpStudyRecords.forEach(record => {
        const week = record.week;
        const dayKr = record.day; // '일', '월', etc.
        const taskType = typeMap[record.task_type] || record.task_type;

        // week + 요일 → dayNum 계산
        const dayIndex = DAY_MAP_KR_TO_NUM[dayKr];
        if (dayIndex === undefined) return;
        const dayNum = (week - 1) * 6 + dayIndex + 1;

        // 해당 dayNum의 모든 잔디 셀에서 task_type이 매칭되는 것 찾기
        const cells = document.querySelectorAll(`#${gridId} .g[data-day="${dayNum}"]`);
        cells.forEach(cell => {
            if (cell.dataset.type === taskType) {
                map.set(`${dayNum}_${cell.dataset.order}`, true);
            }
        });
    });

    return map;
}

/**
 * 현재 스케줄 진행 일차 계산
 */
function getCurrentScheduleDay() {
    if (!mpUser.startDate) return 1;
    const start = new Date(mpUser.startDate);
    const now = new Date();

    // 시작일부터 오늘까지 경과 일수 (토요일 제외)
    let count = 0;
    const d = new Date(start);
    while (d <= now) {
        if (d.getDay() !== 6) count++; // 토요일 제외
        d.setDate(d.getDate() + 1);
    }
    return Math.max(1, count);
}

// ================================================
// ③ 최근 학습 기록 렌더링
// ================================================
function renderRecentRecords() {
    const tbody = document.getElementById('recordTableBody');
    
    // ★ 시작 전 or 데이터 없음
    if (mpStudyRecords.length === 0) {
        const beforeStart = isBeforeStart();
        const msg = beforeStart
            ? `<i class="fa-solid fa-calendar-day"></i>
               <p>챌린지가 아직 시작되지 않았어요.<br><strong>${formatStartDate(mpUser.startDate)}</strong>부터 학습 기록이 쌓입니다! 🚀</p>`
            : `<i class="fa-solid fa-inbox"></i>
               <p>아직 학습 기록이 없어요.<br>테스트룸에서 과제를 시작해보세요! 💪</p>`;
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">${msg}</div>
                </td>
            </tr>
        `;
        return;
    }

    // 최근 20개만 표시
    const recent = mpStudyRecords.slice(0, 20);
    
    tbody.innerHTML = recent.map(record => {
        const date = formatDate(record.completed_at);
        const taskLabel = getTaskLabel(record.task_type);
        const moduleText = getModuleText(record);
        const scoreHtml = renderScore(record);
        const noteHtml = renderNoteButton(record);
        const replayHtml = renderReplayButton(record);
        const retryHtml = renderRetryButton(record);

        return `
            <tr>
                <td><span class="date-badge">${date}</span></td>
                <td>
                    <div class="task-info">
                        <span class="task-module ${taskLabel.cls}">${taskLabel.name}</span>
                        ${moduleText}
                    </div>
                </td>
                <td>${scoreHtml}</td>
                <td>${noteHtml}</td>
                <td>
                    <div class="action-buttons">
                        ${replayHtml}
                        ${retryHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 날짜 포맷: "2/19 (목)"
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

/**
 * task_type → 한글 라벨 + CSS 클래스
 */
function getTaskLabel(taskType) {
    const labels = {
        'reading': { name: 'Reading', cls: '' },
        'listening': { name: 'Listening', cls: 'listening' },
        'writing': { name: 'Writing', cls: 'writing' },
        'speaking': { name: 'Speaking', cls: 'speaking' },
        'vocab': { name: 'Vocab', cls: 'vocab' },
        'intro-book': { name: '입문서', cls: 'intro-book' }
    };
    return labels[taskType] || { name: taskType, cls: '' };
}

/**
 * 모듈 텍스트 생성
 */
function getModuleText(record) {
    if (record.task_type === 'vocab') {
        return `Week ${record.week} ${record.day}`;
    }
    if (record.task_type === 'intro-book') {
        return `${record.day}요일`;
    }
    return `Module ${record.module_number || ''}`;
}

/**
 * 점수 렌더링
 */
function renderScore(record) {
    if (record.task_type === 'vocab') {
        const rate = record.vocab_accuracy_rate;
        if (rate !== undefined && rate !== null) {
            const pct = Math.round(rate * 100);
            return `
                <span class="score-badge">${pct}%</span>
                <div class="score-bar">
                    <div class="score-fill" style="width:${pct}%;"></div>
                </div>
            `;
        }
        return `<span class="score-badge">${record.score || 0} / ${record.total || 0}</span>`;
    }

    if (record.task_type === 'intro-book') {
        return '<span class="score-badge" style="color:var(--accent);">✓ 완료</span>';
    }

    const score = record.score || 0;
    const total = record.total || 1;
    const pct = Math.round((score / total) * 100);

    return `
        <span class="score-badge">${score} / ${total}</span>
        <div class="score-bar">
            <div class="score-fill" style="width:${pct}%;"></div>
        </div>
    `;
}

/**
 * 해설 다시보기 버튼 렌더링
 */
function renderReplayButton(record) {
    // reading, listening, speaking, writing 지원
    const supported = ['reading', 'listening', 'speaking', 'writing'];
    if (!supported.includes(record.task_type)) {
        return `<button class="btn-replay" disabled><i class="fa-solid fa-book-open"></i> -</button>`;
    }
    
    // 지원 타입이면 버튼 표시 (클릭 시 서버에서 result_json 확인)
    return `
        <button class="btn-replay" onclick="replayExplanation('${record.id}')">
            <i class="fa-solid fa-book-open"></i> 해설
        </button>
    `;
}

/**
 * 다시 풀기 버튼 렌더링
 * 마이페이지에서 이전 과제를 연습 모드로 다시 풀 수 있음
 * (인증률/점수에 영향 없음)
 */
function renderRetryButton(record) {
    // 다시 풀기 지원 타입
    const supported = ['reading', 'listening', 'writing', 'speaking', 'vocab'];
    if (!supported.includes(record.task_type)) {
        return '';
    }
    
    // task_type + module_number로 과제 식별
    const taskType = record.task_type;
    const moduleNum = record.module_number || 1;
    const week = record.week || 1;
    const day = record.day || '';
    
    return `
        <button class="btn-retry" onclick="retryTask('${taskType}', ${moduleNum}, ${week}, '${day}')">
            <i class="fa-solid fa-rotate-right"></i> 다시풀기
        </button>
    `;
}

/**
 * 다시 풀기 실행
 * index.html로 이동하여 해당 과제를 연습 모드로 실행
 */
function retryTask(taskType, moduleNumber, week, day) {
    if (!confirm('연습 모드로 다시 풀어봅니다.\n(기존 점수/인증률에 영향 없습니다)\n\n진행하시겠습니까?')) {
        return;
    }
    
    // 로딩 오버레이 표시
    showLoadingOverlay('과제를 준비하고 있습니다...');
    
    // sessionStorage에 retry 정보 저장
    const retryData = {
        taskType: taskType,
        moduleNumber: moduleNumber,
        week: week,
        day: day,
        isPracticeMode: true
    };
    sessionStorage.setItem('retryData', JSON.stringify(retryData));
    
    // index.html로 이동
    window.location.href = 'index.html?retry=true';
}

/**
 * 노트 버튼 렌더링
 */
function renderNoteButton(record) {
    if (record.error_note_text && record.error_note_text.trim()) {
        const escaped = record.error_note_text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
        const title = `${getTaskLabel(record.task_type).name} Module ${record.module_number || ''}`;
        return `
            <button class="btn-note" onclick="openNote('${title}', '${escaped}')">
                <i class="fa-regular fa-note-sticky"></i> 노트보기
            </button>
        `;
    }
    if (record.memo_text && record.memo_text.trim()) {
        const escaped = record.memo_text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
        return `
            <button class="btn-note" onclick="openNote('입문서 메모', '${escaped}')">
                <i class="fa-regular fa-note-sticky"></i> 메모보기
            </button>
        `;
    }
    return `<button class="btn-note" disabled><i class="fa-regular fa-note-sticky"></i> -</button>`;
}

// ================================================
// 플랜 탭 전환
// ================================================
function setupPlanTabs() {
    const programType = mpUser.programType || 'standard';

    // 해당 잔디 그리드만 표시 (탭 버튼 없음)
    document.getElementById('grass-fast').style.display = programType === 'fast' ? '' : 'none';
    document.getElementById('grass-standard').style.display = programType === 'standard' ? '' : 'none';

    console.log(`🌱 [MyPage] 출석 잔디: ${programType} 과정 표시`);
}

// ================================================
// 모달
// ================================================
function openNote(title, content) {
    document.getElementById('noteTitle').innerHTML = 
        `<i class="fa-regular fa-note-sticky"></i> ${title}`;
    document.getElementById('noteContent').textContent = content;
    document.getElementById('noteModal').classList.add('open');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
}

// 모달 바깥 클릭으로 닫기
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
});

// ================================================
// 네비게이션
// ================================================
function goBackToTestroom() {
    window.location.href = 'index.html';
}

function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// ================================================
// 유틸리티
// ================================================
function showNotLoggedIn() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('notLoggedScreen').style.display = 'flex';
}

console.log('✅ mypage.js 로드 완료');
