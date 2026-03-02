/**
 * Reading Module 2차 결과화면 JavaScript
 * v003 - 2025-02-13
 * - 유형별 세부 결과 기능 추가
 * - 빈칸채우기 세부 결과 화면 구현
 */

// ✅ 즉시 전역 변수 선언 (다른 스크립트의 덮어쓰기 방지)
console.log('🔵 [reading-retake-result.js] 로드 시작...');

/**
 * 2차 결과화면 표시
 * @param {Object} resultData - 1차, 2차 결과 데이터
 */
function showReadingRetakeResult(resultData) {
    console.log('📊 [최종 해설] 화면 표시 시작', resultData);
    console.log('  - secondAttemptAnswers:', resultData.secondAttemptAnswers);
    console.log('  - secondAttemptAnswers 키 개수:', Object.keys(resultData.secondAttemptAnswers || {}).length);
    
    // ✅ secondAttemptAnswers와 resultData를 전역으로 저장
    window.currentSecondAttemptAnswers = resultData.secondAttemptAnswers || {};
    window.currentResultData = resultData;  // ✅ 전체 resultData 저장
    
    // 화면 전환
    document.querySelectorAll('.screen, .result-screen, .test-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById('readingRetakeResultScreen').style.display = 'block';
    
    // 데이터 렌더링
    renderQuestionComparison(resultData);
    renderStatsComparison(resultData);
    renderMotivationMessage(resultData);
}

// ✅ 즉시 전역으로 노출 (함수 정의 직후)
window.showReadingRetakeResult = showReadingRetakeResult;
console.log('✅ showReadingRetakeResult 전역 노출:', typeof window.showReadingRetakeResult);

/**
 * 35문제 O/X 비교표 렌더링
 */
function renderQuestionComparison(resultData) {
    const totalQuestions = 35;
    const firstResults = resultData.firstAttempt.results; // [true, false, ...]
    const secondResults = resultData.secondAttempt.results; // [true, true, ...]
    
    // 문제번호 생성
    const questionNumbersEl = document.getElementById('questionNumbers');
    questionNumbersEl.innerHTML = '';
    for (let i = 1; i <= totalQuestions; i++) {
        const numEl = document.createElement('div');
        numEl.className = 'question-number';
        numEl.textContent = i;
        questionNumbersEl.appendChild(numEl);
    }
    
    // 1차 결과
    const firstResultsEl = document.getElementById('firstAttemptResults');
    firstResultsEl.innerHTML = '';
    firstResults.forEach((isCorrect) => {
        const resultEl = document.createElement('div');
        resultEl.className = `question-result ${isCorrect ? 'correct' : 'incorrect'}`;
        resultEl.textContent = isCorrect ? '✓' : '✗';
        firstResultsEl.appendChild(resultEl);
    });
    
    // 2차 결과 (상태 표시 포함)
    const secondResultsEl = document.getElementById('secondAttemptResults');
    secondResultsEl.innerHTML = '';
    secondResults.forEach((isCorrect, index) => {
        const resultEl = document.createElement('div');
        const firstCorrect = firstResults[index];
        const secondCorrect = secondResults[index];
        
        // 상태 결정
        let statusClass = '';
        if (!firstCorrect && secondCorrect) {
            statusClass = 'improved'; // ✗ → ✓
        } else if (!firstCorrect && !secondCorrect) {
            statusClass = 'still-wrong'; // ✗ → ✗
        } else if (firstCorrect && !secondCorrect) {
            statusClass = 'worsened'; // ✓ → ✗
        }
        
        resultEl.className = `question-result ${secondCorrect ? 'correct' : 'incorrect'} ${statusClass}`;
        resultEl.textContent = secondCorrect ? '✓' : '✗';
        secondResultsEl.appendChild(resultEl);
    });
}

/**
 * 점수/정답률/레벨 비교표 렌더링
 */
function renderStatsComparison(resultData) {
    const first = resultData.firstAttempt;
    const second = resultData.secondAttempt;
    const improvement = resultData.improvement;
    
    // 1차 (레벨은 항상 소수점 1자리)
    document.getElementById('firstScore').textContent = `${first.score}/35`;
    document.getElementById('firstPercent').textContent = `${first.percentage}%`;
    document.getElementById('firstLevel').textContent = first.level.toFixed(1);
    
    // 2차 (레벨은 항상 소수점 1자리)
    document.getElementById('secondScore').textContent = `${second.score}/35`;
    document.getElementById('secondPercent').textContent = `${second.percentage}%`;
    document.getElementById('secondLevel').textContent = second.level.toFixed(1);
    
    // 개선
    const scoreDiffEl = document.getElementById('scoreDiff');
    const percentDiffEl = document.getElementById('percentDiff');
    const levelDiffEl = document.getElementById('levelDiff');
    
    if (improvement.scoreDiff > 0) {
        scoreDiffEl.textContent = `+${improvement.scoreDiff} 문제`;
        percentDiffEl.textContent = `+${improvement.percentDiff}%`;
        levelDiffEl.textContent = `+${Math.abs(improvement.levelDiff).toFixed(1)}`;
    } else if (improvement.scoreDiff === 0) {
        scoreDiffEl.textContent = '변화 없음';
        percentDiffEl.textContent = '0%';
        levelDiffEl.textContent = '0.0';
    } else {
        scoreDiffEl.textContent = `${improvement.scoreDiff} 문제`;
        percentDiffEl.textContent = `${improvement.percentDiff}%`;
        levelDiffEl.textContent = `${Math.abs(improvement.levelDiff).toFixed(1)}`;
    }
}

/**
 * 축하/격려 메시지 렌더링
 */
function renderMotivationMessage(resultData) {
    const improvement = resultData.improvement;
    const second = resultData.secondAttempt;
    const messageEl = document.getElementById('motivationMessage');
    
    let message = '';
    let messageClass = '';
    
    if (second.score === 35) {
        // 100% 달성
        message = `
            <p>🏆 완벽해요!</p>
            <p>모든 문제를 정복했습니다!</p>
            <p>당신의 노력이 빛을 발했어요! ⭐</p>
        `;
        messageClass = 'perfect';
    } else if (improvement.scoreDiff > 0) {
        // 개선 있음
        message = `
            <p>🎉 축하합니다!</p>
            <p>조금 더 생각하는 것만으로 ${improvement.scoreDiff}문제를 더 맞혔어요!</p>
            <p>정답률이 ${improvement.percentDiff}% 상승했고, ${improvement.levelDiff} 레벨이 올랐어요!</p>
        `;
        messageClass = '';
    } else if (improvement.scoreDiff === 0) {
        // 개선 없음
        message = `
            <p>💪 이번에는 개선이 없었지만 괜찮아요.</p>
            <p>한 번 더 차분히 도전해보세요!</p>
            <p>포기하지 마세요! 😊</p>
        `;
        messageClass = 'no-improvement';
    } else {
        // 퇴보 (드물지만)
        message = `
            <p>😅 이번에는 점수가 조금 낮아졌네요.</p>
            <p>괜찮아요! 집중력이 흐트러졌을 수 있어요.</p>
            <p>다시 한 번 도전해봐요!</p>
        `;
        messageClass = 'worsened';
    }
    
    messageEl.innerHTML = message;
    messageEl.className = `motivation-message ${messageClass}`;
}

/**
 * 테스트용 더미 데이터 생성
 */
function generateTestRetakeData() {
    // 1차: 25/35 (71%)
    const firstResults = [];
    for (let i = 0; i < 35; i++) {
        // 랜덤하게 25개 정답
        firstResults.push(Math.random() > 0.29); // 약 71% 정답
    }
    
    // 2차: 1차 기준으로 일부 개선
    const secondResults = firstResults.map((result, index) => {
        if (!result && Math.random() > 0.5) {
            return true; // 틀린 문제 중 일부 개선
        }
        return result;
    });
    
    const firstScore = firstResults.filter(r => r).length;
    const secondScore = secondResults.filter(r => r).length;
    
    const firstPercent = Math.round((firstScore / 35) * 100);
    const secondPercent = Math.round((secondScore / 35) * 100);
    
    const firstLevel = (firstScore / 7).toFixed(1);
    const secondLevel = (secondScore / 7).toFixed(1);
    
    return {
        moduleId: "reading_module_1",
        moduleName: "Reading Module 1",
        summary: {
            totalQuestions: 35,
            firstAttempt: {
                score: firstScore,
                percentage: firstPercent,
                level: parseFloat(firstLevel),
                results: firstResults
            },
            secondAttempt: {
                score: secondScore,
                percentage: secondPercent,
                level: parseFloat(secondLevel),
                results: secondResults
            },
            improvement: {
                scoreDiff: secondScore - firstScore,
                percentDiff: secondPercent - firstPercent,
                levelDiff: (parseFloat(secondLevel) - parseFloat(firstLevel)).toFixed(1)
            }
        }
    };
}

// ✅ 즉시 전역으로 노출
window.generateTestRetakeData = generateTestRetakeData;
console.log('✅ generateTestRetakeData 전역 노출:', typeof window.generateTestRetakeData);

/**
 * 유형별 세부 결과 페이지 표시
 * @param {number} pageIndex - 페이지 번호 (1: 빈칸채우기, 2: 일상리딩1, 3: 일상리딩2, 4: 아카데믹)
 */
function showRetakeDetailPage(pageIndex) {
    console.log(`📄 [세부 결과] 페이지 ${pageIndex} 표시`);
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen, .result-screen, .test-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    switch(pageIndex) {
        case 1:
            showFillBlanksDetail();
            break;
        case 2:
            showDaily1Detail();
            break;
        case 3:
            showDaily2Detail();
            break;
        case 4:
            showAcademicDetail();
            break;
        default:
            console.error('잘못된 페이지 인덱스:', pageIndex);
    }
}

// ✅ 즉시 전역으로 노출
window.showRetakeDetailPage = showRetakeDetailPage;
console.log('✅ showRetakeDetailPage 전역 노출:', typeof window.showRetakeDetailPage);

/**
 * 빈칸채우기 세부 결과 표시
 */
function showFillBlanksDetail() {
    console.log('📝 [빈칸채우기] 세부 결과 표시');
    
    // 화면 표시
    const screen = document.getElementById('readingRetakeDetailFillBlanksScreen');
    if (!screen) {
        console.error('❌ 빈칸채우기 세부 결과 화면을 찾을 수 없습니다');
        return;
    }
    
    // ✅ 상단 제목 업데이트 (Week/요일/모듈 정보)
    const firstAttemptData = JSON.parse(sessionStorage.getItem('reading_firstAttempt') || '{}');
    const titleElement = document.getElementById('fillBlanksDetailTitle');
    if (titleElement && firstAttemptData.weekInfo) {
        const weekName = firstAttemptData.weekInfo.weekName || 'Week 1';
        const dayName = firstAttemptData.weekInfo.dayName || '일요일';
        const moduleName = 'Reading Module 1';  // 현재는 Reading Module 1 고정
        titleElement.textContent = `📖 ${weekName} - ${dayName} : ${moduleName} 최종 해설`;
    }
    
    // ✅ resultData에서 1차/2차 정오답 배열 가져오기 (35문제 전체)
    const resultData = window.currentResultData;
    if (!resultData) {
        console.error('❌ resultData가 없습니다');
        alert('결과 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
    }
    
    const firstResults = resultData.firstAttempt.results;   // [true, false, ...]
    const secondResults = resultData.secondAttempt.results; // [true, true, ...]
    
    console.log('  - firstResults (35문제):', firstResults);
    console.log('  - secondResults (35문제):', secondResults);
    
    // 1차 결과 데이터 로드 (상세 정보용) - 이미 위에서 선언됨
    // const firstAttemptData는 이미 Line 285에서 선언되었으므로 재사용
    const secondAttemptData = window.currentSecondAttemptAnswers || {};  
    
    console.log('📦 [데이터 로드]');
    console.log('  - firstAttemptData:', firstAttemptData);
    console.log('  - secondAttemptData:', secondAttemptData);
    console.log('  - secondAttemptData 키 개수:', Object.keys(secondAttemptData).length);
    
    if (!firstAttemptData.componentResults) {
        console.error('❌ 1차 결과 데이터가 없습니다');
        alert('결과 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
    }
    
    // 빈칸채우기 컴포넌트 필터링
    const fillBlanksComponents = firstAttemptData.componentResults.filter(
        comp => comp.componentType === 'fillblanks'
    );
    
    console.log(`  ✅ 빈칸채우기 세트 ${fillBlanksComponents.length}개 발견`);
    
    // 요약 정보 계산
    let firstTotal = 0, firstCorrect = 0;
    let secondTotal = 0, secondCorrect = 0;
    let globalQuestionIndex = 0;
    
    firstAttemptData.componentResults.forEach((comp, compIndex) => {
        const answers = comp.answers || comp.results || [];
        answers.forEach((answer, localIndex) => {
            if (comp.componentType === 'fillblanks') {
                firstTotal++;
                if (answer.isCorrect) firstCorrect++;
                
                // 2차 답안 확인
                const secondAnswerKey = `q${globalQuestionIndex}`;
                const secondAnswer = secondAttemptData[secondAnswerKey];
                
                secondTotal++;
                if (secondAnswer) {
                    // 2차에 다시 풀었음
                    if (secondAnswer.isCorrect) secondCorrect++;
                } else {
                    // 1차에 맞아서 2차에 안 풀었음 -> 1차 결과 유지
                    if (answer.isCorrect) secondCorrect++;
                }
            }
            globalQuestionIndex++;
        });
    });
    
    const firstPercent = Math.round((firstCorrect / firstTotal) * 100);
    const secondPercent = Math.round((secondCorrect / secondTotal) * 100);
    const improvement = secondCorrect - firstCorrect;
    const improvementPercent = secondPercent - firstPercent;
    
    // 요약 정보 표시
    document.getElementById('fillBlanksTotal').textContent = firstTotal;
    document.getElementById('fillBlanksFirst').textContent = `${firstCorrect}/${firstTotal} (${firstPercent}%)`;
    document.getElementById('fillBlanksSecond').textContent = `${secondCorrect}/${secondTotal} (${secondPercent}%)`;
    document.getElementById('fillBlanksImprovement').textContent = 
        `${improvement > 0 ? '+' : ''}${improvement}문제 (${improvementPercent > 0 ? '+' : ''}${improvementPercent}%)`;
    
    // 세트별 결과 렌더링
    renderFillBlanksSetResults(fillBlanksComponents, secondAttemptData, firstAttemptData, firstResults, secondResults);
    
    // 화면 표시
    screen.style.display = 'block';
}

/**
 * 빈칸채우기 세트별 결과 렌더링
 */
function renderFillBlanksSetResults(fillBlanksComponents, secondAttemptData, firstAttemptData, firstResults, secondResults) {
    const container = document.getElementById('fillBlanksDetailSets');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 전체 컴포넌트에서 빈칸채우기의 시작 인덱스 찾기
    let globalQuestionIndex = 0;
    let fillBlanksStartIndex = -1;
    
    for (const comp of firstAttemptData.componentResults) {
        if (comp.componentType === 'fillblanks') {
            fillBlanksStartIndex = globalQuestionIndex;
            break;
        }
        globalQuestionIndex += (comp.answers || comp.results || []).length;
    }
    
    // 각 세트 렌더링 (기존 채점 화면 형식 사용)
    fillBlanksComponents.forEach((comp, setIndex) => {
        const setBlock = document.createElement('div');
        setBlock.className = 'result-section';
        
        const answers = comp.answers || comp.results || [];
        const firstCorrect = answers.filter(a => a.isCorrect).length;
        
        // 2차 정답 개수 계산
        let secondCorrect = 0;
        answers.forEach((answer, localIndex) => {
            const questionIndex = fillBlanksStartIndex + setIndex * 10 + localIndex;
            const secondAnswerKey = `q${questionIndex}`;
            const secondAnswer = secondAttemptData[secondAnswerKey];
            
            if (secondAnswer) {
                // 2차에 다시 풀었음
                if (secondAnswer.isCorrect) secondCorrect++;
            } else {
                // 1차에 맞아서 2차에 안 풀었음 -> 1차 결과 유지
                if (answer.isCorrect) secondCorrect++;
            }
        });
        
        // 세트 제목 (간략하게)
        setBlock.innerHTML = `
            <div class="result-section-title" style="white-space: nowrap; overflow: visible;">
                <i class="fas fa-pen"></i> Fill in the Blanks - Set ${setIndex + 1}
                <span style="margin-left: auto; font-size: 14px; color: #6c757d; white-space: nowrap;">
                    1차: ${firstCorrect}/${answers.length} → 2차: ${secondCorrect}/${answers.length}
                </span>
            </div>
        `;
        
        // 1차 답안 맵 생성
        const firstAttemptMap = {};
        answers.forEach((answer, localIndex) => {
            const globalQuestionIndex = fillBlanksStartIndex + setIndex * 10 + localIndex;
            
            // ✅ resultData의 firstResults 배열 사용
            const wasCorrectInFirst = firstResults[globalQuestionIndex];
            
            firstAttemptMap[answer.blankId] = {
                ...answer,
                isCorrect: wasCorrectInFirst
            };
        });
        
        // 2차 답안 맵 생성
        const secondAnswerMap = {};
        answers.forEach((answer, localIndex) => {
            const globalQuestionIndex = fillBlanksStartIndex + setIndex * 10 + localIndex;
            const secondAnswerKey = `q${globalQuestionIndex}`;
            const secondAnswer = secondAttemptData[secondAnswerKey];
            
            // ✅ resultData의 secondResults 배열 사용
            const isCorrectInSecond = secondResults[globalQuestionIndex];
            
            // 2차 답안이 있으면 사용, 없으면 1차 답안 사용
            if (secondAnswer) {
                secondAnswerMap[answer.blankId] = {
                    blankId: answer.blankId,
                    prefix: answer.prefix,
                    userAnswer: secondAnswer.userAnswer,
                    correctAnswer: answer.correctAnswer,
                    isCorrect: isCorrectInSecond,  // ✅ resultData에서 가져온 값
                    wasCorrectInFirst: firstResults[globalQuestionIndex],  // ✅ 1차 정답 여부 추가
                    explanation: answer.explanation,
                    commonMistakes: answer.commonMistakes || '',
                    mistakesExplanation: answer.mistakesExplanation || ''
                };
            } else {
                // 1차에 맞아서 2차에 안 풀었음
                secondAnswerMap[answer.blankId] = {
                    ...answer,
                    isCorrect: firstResults[globalQuestionIndex],  // ✅ 1차 결과 사용
                    wasCorrectInFirst: firstResults[globalQuestionIndex]  // ✅ 1차 정답 여부 추가
                };
            }
        });
        
        // comp 데이터 확인 (디버깅용)
        console.log('🔍 [디버깅] comp 데이터:', comp);
        console.log('  - comp.passage 존재?', !!comp.passage);
        console.log('  - comp.setId:', comp.setId);
        console.log('  - comp.blanks 존재?', !!comp.blanks);
        console.log('  - window.renderPassageWithAnswers 존재?', typeof window.renderPassageWithAnswers);
        console.log('  - window.renderBlankExplanations 존재?', typeof window.renderBlankExplanations);
        
        // comp에 blanks가 없으면 window.readingFillBlanksData에서 가져오기
        if (!comp.blanks) {
            console.warn('⚠️ comp.blanks가 없음! readingFillBlanksData에서 가져오는 중...');
            const fillBlanksData = window.readingFillBlanksData;
            
            console.log('🔍 [디버깅] readingFillBlanksData:', fillBlanksData);
            console.log('🔍 [디버깅] fillBlanksData.sets:', fillBlanksData?.sets);
            console.log('🔍 [디버깅] 찾으려는 setId:', comp.setId);
            
            if (!fillBlanksData) {
                console.error('❌ readingFillBlanksData를 찾을 수 없습니다!');
                setBlock.innerHTML += '<p>빈칸채우기 데이터를 불러올 수 없습니다.</p>';
                container.appendChild(setBlock);
                return;
            }
            
            if (!fillBlanksData.sets || fillBlanksData.sets.length === 0) {
                console.error('❌ fillBlanksData.sets가 비어 있습니다!');
                setBlock.innerHTML += '<p>빈칸채우기 세트 데이터가 없습니다.</p>';
                container.appendChild(setBlock);
                return;
            }
            
            // 모든 세트 ID 출력
            console.log('🔍 [디버깅] 사용 가능한 세트 ID들:', fillBlanksData.sets.map(s => s.id));
            
            const actualSet = fillBlanksData.sets.find(s => s.id === comp.setId);
            if (!actualSet) {
                console.error(`❌ setId ${comp.setId}에 해당하는 세트를 찾을 수 없습니다!`);
                console.error(`   사용 가능한 세트: ${fillBlanksData.sets.map(s => s.id).join(', ')}`);
                setBlock.innerHTML += `<p>세트 ${comp.setId}를 찾을 수 없습니다.</p>`;
                container.appendChild(setBlock);
                return;
            }
            
            console.log('✅ actualSet 발견:', actualSet.id, '- blanks 개수:', actualSet.blanks.length);
            
            // comp에 passage, blanks 추가
            comp.passage = actualSet.passage;
            comp.blanks = actualSet.blanks;
        }
        
        // 지문 렌더링 (기존 함수 사용, 1차 정보 전달)
        console.log('🔧 [renderPassageWithAnswers 호출 전]');
        console.log('  - comp:', comp);
        console.log('  - secondAnswerMap:', secondAnswerMap);
        console.log('  - secondAnswerMap 키들:', Object.keys(secondAnswerMap));
        console.log('  - secondAnswerMap 값 샘플:', Object.values(secondAnswerMap).slice(0, 3));
        console.log('  - firstAttemptMap:', firstAttemptMap);
        console.log('  - firstAttemptMap 키들:', Object.keys(firstAttemptMap));
        console.log('  - firstAttemptMap 값 샘플:', Object.values(firstAttemptMap).slice(0, 3));
        
        const passageHTML = window.renderPassageWithAnswers ? 
            window.renderPassageWithAnswers(comp, secondAnswerMap, firstAttemptMap) : 
            '<p>지문 렌더링 함수를 찾을 수 없습니다.</p>';
        
        console.log('🔧 [renderPassageWithAnswers 호출 후]');
        console.log('  - passageHTML 길이:', passageHTML.length);
        console.log('  - passageHTML 미리보기 (처음 200자):', passageHTML.substring(0, 200));
        
        // 해설 영역 렌더링 (기존 함수 사용)
        const explanationHTML = window.renderBlankExplanations ? 
            window.renderBlankExplanations(comp, secondAnswerMap) : 
            '';
        
        console.log('  - explanationHTML 길이:', explanationHTML.length);
        
        // 한 번에 모든 HTML 추가 (innerHTML += 를 두 번 쓰면 onclick 이벤트가 날아감!)
        setBlock.innerHTML += `
            <div class="result-passage">
                ${passageHTML}
            </div>
            ${explanationHTML}
        `;
        
        console.log('✅ [HTML 삽입 완료] setBlock에 추가됨');
        
        container.appendChild(setBlock);
    });
}

/**
 * 2차 결과 화면으로 돌아가기
 */
function backToRetakeResult() {
    console.log('🔙 [backToRetakeResult] 2차 결과 화면으로 돌아가기');
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen, .result-screen, .test-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // 2차 결과 화면 표시
    const retakeScreen = document.getElementById('readingRetakeResultScreen');
    if (retakeScreen) {
        retakeScreen.style.display = 'block';
        console.log('✅ 2차 결과 화면 표시 완료');
    } else {
        console.error('❌ readingRetakeResultScreen을 찾을 수 없습니다!');
        alert('2차 결과 화면을 찾을 수 없습니다. 학습 일정으로 돌아갑니다.');
        backToSchedule();
    }
}

// ✅ 즉시 전역으로 노출
window.backToRetakeResult = backToRetakeResult;
console.log('✅ backToRetakeResult 전역 노출:', typeof window.backToRetakeResult);

/**
 * 일상리딩1 세부 결과 표시
 */
function showDaily1Detail() {
    console.log('📝 [일상리딩1] 세부 결과 표시');
    
    // 화면 표시
    const screen = document.getElementById('readingRetakeDetailDaily1Screen');
    if (!screen) {
        console.error('❌ 일상리딩1 세부 결과 화면을 찾을 수 없습니다');
        return;
    }
    
    // ✅ 상단 제목 업데이트 (Week/요일/모듈 정보)
    const firstAttemptData = JSON.parse(sessionStorage.getItem('reading_firstAttempt') || '{}');
    const titleElement = document.getElementById('daily1DetailTitle');
    if (titleElement && firstAttemptData.weekInfo) {
        const weekName = firstAttemptData.weekInfo.weekName || 'Week 1';
        const dayName = firstAttemptData.weekInfo.dayName || '일요일';
        const moduleName = 'Reading Module 1';
        titleElement.textContent = `📖 ${weekName} - ${dayName} : ${moduleName} 최종 해설`;
    }
    
    // ✅ resultData에서 1차/2차 정오답 배열 가져오기
    const resultData = window.currentResultData;
    if (!resultData) {
        console.error('❌ resultData가 없습니다');
        alert('결과 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
    }
    
    const firstResults = resultData.firstAttempt.results;
    const secondResults = resultData.secondAttempt.results;
    const secondAttemptData = window.currentSecondAttemptAnswers || {};
    
    if (!firstAttemptData.componentResults) {
        console.error('❌ 1차 결과 데이터가 없습니다');
        alert('결과 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
    }
    
    // 일상리딩1 컴포넌트 필터링
    const daily1Components = firstAttemptData.componentResults.filter(
        comp => comp.componentType === 'daily1'
    );
    
    console.log(`  ✅ 일상리딩1 세트 ${daily1Components.length}개 발견`);
    
    // 요약 정보 계산
    let firstTotal = 0, firstCorrect = 0;
    let secondTotal = 0, secondCorrect = 0;
    let globalQuestionIndex = 0;
    
    firstAttemptData.componentResults.forEach((comp) => {
        const answers = comp.answers || comp.results || [];
        answers.forEach((answer) => {
            if (comp.componentType === 'daily1') {
                firstTotal++;
                if (answer.isCorrect) firstCorrect++;
                
                const secondAnswerKey = `q${globalQuestionIndex}`;
                const secondAnswer = secondAttemptData[secondAnswerKey];
                
                secondTotal++;
                if (secondAnswer) {
                    if (secondAnswer.isCorrect) secondCorrect++;
                } else {
                    if (answer.isCorrect) secondCorrect++;
                }
            }
            globalQuestionIndex++;
        });
    });
    
    const firstPercent = Math.round((firstCorrect / firstTotal) * 100);
    const secondPercent = Math.round((secondCorrect / secondTotal) * 100);
    const improvement = secondCorrect - firstCorrect;
    const improvementPercent = secondPercent - firstPercent;
    
    // 요약 정보 표시
    document.getElementById('daily1Total').textContent = firstTotal;
    document.getElementById('daily1First').textContent = `${firstCorrect}/${firstTotal} (${firstPercent}%)`;
    document.getElementById('daily1Second').textContent = `${secondCorrect}/${secondTotal} (${secondPercent}%)`;
    document.getElementById('daily1Improvement').textContent = 
        `${improvement > 0 ? '+' : ''}${improvement}문제 (${improvementPercent > 0 ? '+' : ''}${improvementPercent}%)`;
    
    // 세트별 결과 렌더링
    renderDaily1SetResults(daily1Components, secondAttemptData, firstAttemptData, firstResults, secondResults);
    
    // 툴팁 이벤트 바인딩 (인터랙티브 단어용)
    if (typeof window.bindDaily1ToggleEvents === 'function') {
        setTimeout(() => {
            window.bindDaily1ToggleEvents();
            console.log('✅ Daily1 툴팁 이벤트 바인딩 완료');
        }, 100);
    }
    
    // 화면 표시
    screen.style.display = 'block';
}

// ✅ 즉시 전역으로 노출
window.showDaily1Detail = showDaily1Detail;
console.log('✅ showDaily1Detail 전역 노출:', typeof window.showDaily1Detail);

/**
 * 일상리딩1 세트별 결과 렌더링
 */
function renderDaily1SetResults(daily1Components, secondAttemptData, firstAttemptData, firstResults, secondResults) {
    const container = document.getElementById('daily1DetailSets');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 전체 컴포넌트에서 일상리딩1의 시작 인덱스 찾기
    let globalQuestionIndex = 0;
    let daily1StartIndex = -1;
    
    for (const comp of firstAttemptData.componentResults) {
        if (comp.componentType === 'daily1') {
            daily1StartIndex = globalQuestionIndex;
            break;
        }
        globalQuestionIndex += (comp.answers || comp.results || []).length;
    }
    
    // 각 세트 렌더링
    daily1Components.forEach((comp, setIndex) => {
        const setBlock = document.createElement('div');
        setBlock.className = 'result-section';
        
        const answers = comp.answers || comp.results || [];
        const firstCorrect = answers.filter(a => a.isCorrect).length;
        
        // 2차 정답 개수 계산
        let secondCorrect = 0;
        answers.forEach((answer, localIndex) => {
            const questionIndex = daily1StartIndex + setIndex * answers.length + localIndex;
            const secondAnswerKey = `q${questionIndex}`;
            const secondAnswer = secondAttemptData[secondAnswerKey];
            
            if (secondAnswer) {
                if (secondAnswer.isCorrect) secondCorrect++;
            } else {
                if (answer.isCorrect) secondCorrect++;
            }
        });
        
        // 세트 제목
        setBlock.innerHTML = `
            <div class="result-section-title" style="white-space: nowrap; overflow: visible;">
                <i class="fas fa-book-reader"></i> Daily Reading 1 - Set ${setIndex + 1}
                <span style="margin-left: auto; font-size: 14px; color: #6c757d; white-space: nowrap;">
                    1차: ${firstCorrect}/${answers.length} → 2차: ${secondCorrect}/${answers.length}
                </span>
            </div>
        `;
        
        // 기존 readingDaily1ResultScreen의 내용을 재사용
        // window.renderDaily1SetResult() 함수가 있다면 호출
        if (typeof window.renderDaily1SetResult === 'function') {
            const setResultHTML = window.renderDaily1SetResult(comp, secondAttemptData, firstResults, secondResults, daily1StartIndex + setIndex * answers.length);
            setBlock.innerHTML += setResultHTML;
        } else {
            setBlock.innerHTML += '<p>일상리딩1 렌더링 함수를 찾을 수 없습니다. reading-daily1-logic.js를 확인하세요.</p>';
        }
        
        container.appendChild(setBlock);
    });
}

/**
 * 일상리딩2 세부 결과 화면 표시
 */
function showDaily2Detail() {
    console.log('🔍 [일상리딩2] 세부 결과 표시 시작');
    
    const screen = document.getElementById('readingRetakeDetailDaily2Screen');
    if (!screen) {
        console.error('❌ readingRetakeDetailDaily2Screen을 찾을 수 없습니다!');
        return;
    }
    
    // 제목 업데이트
    const titleElement = document.getElementById('daily2DetailTitle');
    const firstAttemptData = JSON.parse(sessionStorage.getItem('reading_firstAttempt') || '{}');
    const weekInfo = firstAttemptData.weekInfo || {};
    const weekName = weekInfo.weekName || 'Week 1';
    const dayName = weekInfo.dayName ? weekInfo.dayName + '요일' : '일요일';
    
    if (titleElement) {
        titleElement.textContent = `📖 ${weekName} - ${dayName} : Reading Module 1 최종 해설`;
    }
    
    // 2차 결과 데이터 가져오기
    const resultData = window.currentResultData;
    if (!resultData) {
        console.error('❌ currentResultData를 찾을 수 없습니다!');
        alert('결과 데이터를 찾을 수 없습니다.');
        return;
    }
    
    const secondAttemptData = window.currentSecondAttemptAnswers || {};
    const firstResults = resultData.firstAttempt.results || [];
    const secondResults = resultData.secondAttempt.results || [];
    
    console.log('📊 일상리딩2 데이터:', {
        secondAttemptData,
        firstResultsLength: firstResults.length,
        secondResultsLength: secondResults.length
    });
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen, .result-screen, .test-screen').forEach(s => s.style.display = 'none');
    
    // 일상리딩2 컴포넌트 필터링
    const daily2Components = firstAttemptData.componentResults.filter(comp => comp.componentType === 'daily2');
    console.log(`✅ 일상리딩2 세트 ${daily2Components.length}개 발견`);
    
    // 통계 계산
    let firstTotal = 0, firstCorrect = 0;
    let secondTotal = 0, secondCorrect = 0;
    let globalQuestionIndex = 0;
    
    firstAttemptData.componentResults.forEach(comp => {
        const answers = comp.answers || comp.results || [];
        answers.forEach((answer) => {
            if (comp.componentType === 'daily2') {
                firstTotal++;
                if (answer.isCorrect) firstCorrect++;
                
                const secondAnswerKey = `q${globalQuestionIndex}`;
                const secondAnswer = secondAttemptData[secondAnswerKey];
                
                secondTotal++;
                if (secondAnswer) {
                    if (secondAnswer.isCorrect) secondCorrect++;
                } else {
                    if (answer.isCorrect) secondCorrect++;
                }
            }
            globalQuestionIndex++;
        });
    });
    
    const firstPercent = Math.round((firstCorrect / firstTotal) * 100);
    const secondPercent = Math.round((secondCorrect / secondTotal) * 100);
    const improvement = secondCorrect - firstCorrect;
    const improvementPercent = secondPercent - firstPercent;
    
    // 요약 정보 표시
    document.getElementById('daily2Total').textContent = firstTotal;
    document.getElementById('daily2First').textContent = `${firstCorrect}/${firstTotal} (${firstPercent}%)`;
    document.getElementById('daily2Second').textContent = `${secondCorrect}/${secondTotal} (${secondPercent}%)`;
    document.getElementById('daily2Improvement').textContent = 
        `${improvement > 0 ? '+' : ''}${improvement}문제 (${improvementPercent > 0 ? '+' : ''}${improvementPercent}%)`;
    
    // 세트별 결과 렌더링
    renderDaily2SetResults(daily2Components, secondAttemptData, firstAttemptData, firstResults, secondResults);
    
    // 툴팁 이벤트 바인딩 (인터랙티브 단어용)
    if (typeof window.bindDaily2ToggleEvents === 'function') {
        setTimeout(() => {
            window.bindDaily2ToggleEvents();
            console.log('✅ Daily2 툴팁 이벤트 바인딩 완료');
        }, 100);
    }
    
    // 화면 표시
    screen.style.display = 'block';
}

// ✅ 즉시 전역으로 노출
window.showDaily2Detail = showDaily2Detail;
console.log('✅ showDaily2Detail 전역 노출:', typeof window.showDaily2Detail);

/**
 * 일상리딩2 세트별 결과 렌더링
 */
function renderDaily2SetResults(daily2Components, secondAttemptData, firstAttemptData, firstResults, secondResults) {
    const container = document.getElementById('daily2DetailSets');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 전체 컴포넌트에서 일상리딩2의 시작 인덱스 찾기
    let globalQuestionIndex = 0;
    let daily2StartIndex = -1;
    
    for (const comp of firstAttemptData.componentResults) {
        if (comp.componentType === 'daily2') {
            daily2StartIndex = globalQuestionIndex;
            break;
        }
        globalQuestionIndex += (comp.answers || comp.results || []).length;
    }
    
    // 각 세트 렌더링
    daily2Components.forEach((comp, setIndex) => {
        const setBlock = document.createElement('div');
        setBlock.className = 'result-section';
        
        const answers = comp.answers || comp.results || [];
        const firstCorrect = answers.filter(a => a.isCorrect).length;
        
        // 2차 정답 개수 계산
        let secondCorrect = 0;
        answers.forEach((answer, localIndex) => {
            const questionIndex = daily2StartIndex + setIndex * answers.length + localIndex;
            const secondAnswerKey = `q${questionIndex}`;
            const secondAnswer = secondAttemptData[secondAnswerKey];
            
            if (secondAnswer) {
                if (secondAnswer.isCorrect) secondCorrect++;
            } else {
                if (answer.isCorrect) secondCorrect++;
            }
        });
        
        // 세트 제목
        setBlock.innerHTML = `
            <div class="result-section-title" style="white-space: nowrap; overflow: visible;">
                <i class="fas fa-book-reader"></i> Daily Reading 2 - Set ${setIndex + 1}
                <span style="margin-left: auto; font-size: 14px; color: #6c757d; white-space: nowrap;">
                    1차: ${firstCorrect}/${answers.length} → 2차: ${secondCorrect}/${answers.length}
                </span>
            </div>
        `;
        
        // 기존 readingDaily2ResultScreen의 내용을 재사용
        // window.renderDaily2SetResult() 함수가 있다면 호출
        if (typeof window.renderDaily2SetResult === 'function') {
            const setResultHTML = window.renderDaily2SetResult(comp, secondAttemptData, firstResults, secondResults, daily2StartIndex + setIndex * answers.length);
            setBlock.innerHTML += setResultHTML;
        } else {
            setBlock.innerHTML += '<p>일상리딩2 렌더링 함수를 찾을 수 없습니다. reading-daily2-logic.js를 확인하세요.</p>';
        }
        
        container.appendChild(setBlock);
    });
}

/**
 * 아카데믹 리딩 세부 결과 화면 표시
 */
function showAcademicDetail() {
    console.log('🔍 [아카데믹 리딩] 세부 결과 표시 시작');
    
    const screen = document.getElementById('readingRetakeDetailAcademicScreen');
    if (!screen) {
        console.error('❌ readingRetakeDetailAcademicScreen을 찾을 수 없습니다!');
        return;
    }
    
    // 제목 업데이트
    const titleElement = document.getElementById('academicDetailTitle');
    const firstAttemptData = JSON.parse(sessionStorage.getItem('reading_firstAttempt') || '{}');
    const weekInfo = firstAttemptData.weekInfo || {};
    const weekName = weekInfo.weekName || 'Week 1';
    const dayName = weekInfo.dayName ? weekInfo.dayName + '요일' : '일요일';
    
    if (titleElement) {
        titleElement.textContent = `📖 ${weekName} - ${dayName} : Reading Module 1 최종 해설`;
    }
    
    // 2차 결과 데이터 가져오기
    const resultData = window.currentResultData;
    if (!resultData) {
        console.error('❌ currentResultData를 찾을 수 없습니다!');
        alert('결과 데이터를 찾을 수 없습니다.');
        return;
    }
    
    const secondAttemptData = window.currentSecondAttemptAnswers || {};
    const firstResults = resultData.firstAttempt.results || [];
    const secondResults = resultData.secondAttempt.results || [];
    
    console.log('📊 아카데믹 리딩 데이터:', {
        secondAttemptData,
        firstResultsLength: firstResults.length,
        secondResultsLength: secondResults.length
    });
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen, .result-screen, .test-screen').forEach(s => s.style.display = 'none');
    
    // 아카데믹 리딩 컴포넌트 필터링
    const academicComponents = firstAttemptData.componentResults.filter(comp => comp.componentType === 'academic');
    console.log(`✅ 아카데믹 리딩 세트 ${academicComponents.length}개 발견`);
    
    // 통계 계산
    let firstTotal = 0, firstCorrect = 0;
    let secondTotal = 0, secondCorrect = 0;
    let globalQuestionIndex = 0;
    
    firstAttemptData.componentResults.forEach(comp => {
        const answers = comp.answers || comp.results || [];
        answers.forEach((answer) => {
            if (comp.componentType === 'academic') {
                firstTotal++;
                if (answer.isCorrect) firstCorrect++;
                
                const secondAnswerKey = `q${globalQuestionIndex}`;
                const secondAnswer = secondAttemptData[secondAnswerKey];
                
                secondTotal++;
                if (secondAnswer) {
                    if (secondAnswer.isCorrect) secondCorrect++;
                } else {
                    if (answer.isCorrect) secondCorrect++;
                }
            }
            globalQuestionIndex++;
        });
    });
    
    const firstPercent = Math.round((firstCorrect / firstTotal) * 100);
    const secondPercent = Math.round((secondCorrect / secondTotal) * 100);
    const improvement = secondCorrect - firstCorrect;
    const improvementPercent = secondPercent - firstPercent;
    
    // 요약 정보 표시
    document.getElementById('academicTotal').textContent = firstTotal;
    document.getElementById('academicFirst').textContent = `${firstCorrect}/${firstTotal} (${firstPercent}%)`;
    document.getElementById('academicSecond').textContent = `${secondCorrect}/${secondTotal} (${secondPercent}%)`;
    document.getElementById('academicImprovement').textContent = 
        `${improvement > 0 ? '+' : ''}${improvement}문제 (${improvementPercent > 0 ? '+' : ''}${improvementPercent}%)`;
    
    // 세트별 결과 렌더링
    renderAcademicSetResults(academicComponents, secondAttemptData, firstAttemptData, firstResults, secondResults);
    
    // 툴팁 이벤트 바인딩 (인터랙티브 단어용)
    if (typeof window.bindAcademicToggleEvents === 'function') {
        setTimeout(() => {
            window.bindAcademicToggleEvents();
            console.log('✅ Academic 툴팁 이벤트 바인딩 완료');
        }, 100);
    }
    
    // 화면 표시
    screen.style.display = 'block';
}

// ✅ 즉시 전역으로 노출
window.showAcademicDetail = showAcademicDetail;
console.log('✅ showAcademicDetail 전역 노출:', typeof window.showAcademicDetail);

/**
 * 아카데믹 리딩 세트별 결과 렌더링
 */
function renderAcademicSetResults(academicComponents, secondAttemptData, firstAttemptData, firstResults, secondResults) {
    const container = document.getElementById('academicDetailSets');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 전체 컴포넌트에서 아카데믹 리딩의 시작 인덱스 찾기
    let globalQuestionIndex = 0;
    let academicStartIndex = -1;
    
    for (const comp of firstAttemptData.componentResults) {
        if (comp.componentType === 'academic') {
            academicStartIndex = globalQuestionIndex;
            break;
        }
        globalQuestionIndex += (comp.answers || comp.results || []).length;
    }
    
    // 각 세트 렌더링
    academicComponents.forEach((comp, setIndex) => {
        const setBlock = document.createElement('div');
        setBlock.className = 'result-section';
        
        const answers = comp.answers || comp.results || [];
        const firstCorrect = answers.filter(a => a.isCorrect).length;
        
        // 2차 정답 개수 계산
        let secondCorrect = 0;
        answers.forEach((answer, localIndex) => {
            const questionIndex = academicStartIndex + setIndex * answers.length + localIndex;
            const secondAnswerKey = `q${questionIndex}`;
            const secondAnswer = secondAttemptData[secondAnswerKey];
            
            if (secondAnswer) {
                if (secondAnswer.isCorrect) secondCorrect++;
            } else {
                if (answer.isCorrect) secondCorrect++;
            }
        });
        
        // 세트 제목
        setBlock.innerHTML = `
            <div class="result-section-title" style="white-space: nowrap; overflow: visible;">
                <i class="fas fa-graduation-cap"></i> Academic Reading - Set ${setIndex + 1}
                <span style="margin-left: auto; font-size: 14px; color: #6c757d; white-space: nowrap;">
                    1차: ${firstCorrect}/${answers.length} → 2차: ${secondCorrect}/${answers.length}
                </span>
            </div>
        `;
        
        // 기존 readingAcademicResultScreen의 내용을 재사용
        // window.renderAcademicSetResult() 함수가 있다면 호출
        if (typeof window.renderAcademicSetResult === 'function') {
            const setResultHTML = window.renderAcademicSetResult(comp, secondAttemptData, firstResults, secondResults, academicStartIndex + setIndex * answers.length);
            setBlock.innerHTML += setResultHTML;
        } else {
            setBlock.innerHTML += '<p>아카데믹 리딩 렌더링 함수를 찾을 수 없습니다. reading-academic-logic.js를 확인하세요.</p>';
        }
        
        container.appendChild(setBlock);
    });
}

// 마지막 로드 완료 로그
console.log('✅ [2차 결과] reading-retake-result.js 로드 완료');
console.log('📋 전역 함수 확인:', {
    showReadingRetakeResult: typeof window.showReadingRetakeResult,
    generateTestRetakeData: typeof window.generateTestRetakeData,
    showRetakeDetailPage: typeof window.showRetakeDetailPage,
    backToRetakeResult: typeof window.backToRetakeResult
});
