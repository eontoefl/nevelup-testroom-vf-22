/**
 * ResponseComponent.js v=006_cleanup_fix
 * 
 * Listening - 응답고르기 컴포넌트
 * 
 * v005 - 2025-02-13
 * - renderQuestionRetakeMode() 이미지 렌더링 수정: displaySpeakerImage() → renderPersonImage()
 * 
 * v004 - 2025-02-13
 * - renderQuestionRetakeMode() 버그 수정: playAudio(question) → playAudio(question.audioUrl)
 * - TypeError: audioUrl.includes is not a function 해결
 * 
 * - 세트당 12문제
 * - 오디오 재생 ([듣기 시작] 버튼 → 재생 → 블러 해제)
 * - 선택지 4개
 * - 답안 채점 및 sessionStorage 저장
 * - 타이머, 버튼 제어, 진행바는 Module Controller에서 관리
 * 
 * v007 - 수동재생 전환
 * - 2초 대기 삭제 → [듣기 시작] 버튼 추가
 * - 0.5초 대기 삭제 → 오디오 끝나면 바로 보기 표시
 * - 블러: 버튼 클릭 시 흐리게 → 오디오 끝나면 선명하게
 */

// ✅ 캐시 시스템 추가 (정렬된 데이터 재사용)
let cachedResponseData = null;

// 캐시 초기화 함수 (디버깅용)
window.clearResponseCache = function() {
  console.log('🔄 [ResponseComponent] 캐시 초기화');
  cachedResponseData = null;
};

/**
 * Response Selection Component
 * @param {number} setNumber - 세트 번호
 * @param {Object} config - 설정 객체
 * @param {Function} config.onComplete - 완료 콜백
 * @param {Function} config.onError - 에러 콜백
 * @param {Function} config.onTimerStart - 타이머 시작 콜백
 */

class ResponseComponent {
  constructor(setNumber, config = {}) {
    console.log(`[ResponseComponent] 생성 - setNumber: ${setNumber}`);
    
    this.setNumber = setNumber;           // 현재 세트 번호
    this.currentQuestion = 0;             // 현재 문제 인덱스 (0-based)
    this.answers = {};                    // 답안 저장 { "set_id_q1": 2, ... }
    
    this.setData = null;                  // 현재 세트 데이터
    this.audioPlayer = null;              // 오디오 플레이어
    this.isAudioPlaying = false;          // 오디오 재생 중 플래그
    this.isSubmitting = false;            // 중복 제출 방지
    // this._audioDelayTimer 삭제됨 (v007: 2초 대기 제거)
    this._destroyed = false;               // cleanup 호출 여부 플래그
    this._questionTimedOut = false;        // v007: 타임아웃 상태 플래그
    this._lastFemaleImage = null;          // 직전 여성 이미지 (연속 방지)
    this._lastMaleImage = null;            // 직전 남성 이미지 (연속 방지)
    
    // 콜백 설정
    this.onComplete = config.onComplete || null;
    this.onError = config.onError || null;
    this.onTimerStart = config.onTimerStart || null;
    
    // 상수
    this.RESPONSE_TIME_LIMIT = 20;        // 문제당 20초 (실제 타이머는 Module이 관리)
    
    // 여성 화자 이미지 (5개)
    this.FEMALE_IMAGES = [
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageF1.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageF2.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageF3.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageF4.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageF5.jpg'
    ];
    
    // 남성 화자 이미지 (5개)
    this.MALE_IMAGES = [
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageM1.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageM2.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageM3.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageM4.jpg',
      'https://eontoefl.github.io/toefl-audio/listening/response/image/response_imageM5.jpg'
    ];
    
    // Google Sheets 설정
    this.SHEET_CONFIG = {
      spreadsheetId: '1srFVmFnRa8A73isTO_Vk3yfU1bQWVroHUui8XvYf9e0',
      sheetGid: '0'
    };
  }

  /**
   * 초기화 - 데이터 로드 및 첫 문제 시작
   */
  async init() {
    console.log(`[ResponseComponent] 초기화 시작 - setNumber: ${this.setNumber}`);
    
    // 화면 전환
    showScreen('listeningResponseScreen');
    
    // 데이터 로드
    const allData = await this.loadData();
    
    if (!allData || !allData.sets || allData.sets.length === 0) {
      console.error('[ResponseComponent] 데이터 로드 실패');
      alert('응답고르기 데이터를 불러올 수 없습니다.');
      return false;
    }
    
    // 세트 찾기
    const setIndex = this.findSetIndex(allData.sets);
    if (setIndex === -1) {
      console.error(`[ResponseComponent] 세트를 찾을 수 없습니다 - setNumber: ${this.setNumber}`);
      return false;
    }
    
    this.setData = allData.sets[setIndex];
    console.log(`[ResponseComponent] 세트 데이터 로드 완료:`, this.setData);
    
    // 첫 문제 로드
    this.loadQuestion(0);
    
    return true;
  }

  /**
   * Google Sheets에서 데이터 로드
   */
  async loadData(forceReload = false) {
    console.log('[ResponseComponent] 데이터 로드 시작');
    
    // ✅ 캐시 확인
    if (!forceReload && cachedResponseData) {
      console.log('✅ [ResponseComponent] 캐시된 데이터 사용 (이미 정렬됨)');
      console.log('  캐시 데이터 세트 순서:', cachedResponseData.sets.map(s => s.id));
      return cachedResponseData;
    }
    
    // 1) Supabase 우선 시도
    const supabaseResult = await this._loadFromSupabase();
    if (supabaseResult) {
      cachedResponseData = supabaseResult;
      return supabaseResult;
    }
    
    // 2) Google Sheets 폴백
    console.log('🔄 [ResponseComponent] Google Sheets 폴백 시도...');
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${this.SHEET_CONFIG.sheetGid}`;
      console.log('[ResponseComponent] CSV URL:', csvUrl);
      
      const response = await fetch(csvUrl);
      console.log('[ResponseComponent] Response status:', response.status);
      
      if (!response.ok) {
        console.warn('[ResponseComponent] HTTP 에러, 데모 데이터 사용');
        return this.getDemoData();
      }
      
      const csvText = await response.text();
      const parsedData = this.parseCSV(csvText);
      
      if (!parsedData || !parsedData.sets || parsedData.sets.length === 0) {
        console.warn('[ResponseComponent] CSV 파싱 실패, 데모 데이터 사용');
        return this.getDemoData();
      }
      
      console.log('[ResponseComponent] Google Sheets 데이터 로드 성공:', parsedData.sets.length, '개 세트');
      cachedResponseData = parsedData;
      return parsedData;
    } catch (error) {
      console.error('[ResponseComponent] 데이터 로드 실패:', error);
      return this.getDemoData();
    }
  }

  // --- Supabase에서 로드 ---
  async _loadFromSupabase() {
    if (typeof USE_SUPABASE !== 'undefined' && !USE_SUPABASE) return null;
    if (typeof supabaseSelect !== 'function') return null;
    
    try {
      console.log('📥 [ResponseComponent] Supabase에서 데이터 로드...');
      const rows = await supabaseSelect('tr_listening_response', 'select=*&order=set_id.asc,question_num.asc');
      
      if (!rows || rows.length === 0) {
        console.warn('⚠️ [ResponseComponent] Supabase 데이터 없음');
        return null;
      }
      
      console.log(`✅ [ResponseComponent] Supabase에서 ${rows.length}개 행 로드 성공`);
      
      // 행 데이터를 세트별로 그룹화 (기존 parseCSV 출력과 동일 형태)
      const setsMap = {};
      rows.forEach(row => {
        const setId = row.set_id;
        if (!setsMap[setId]) {
          setsMap[setId] = { id: setId, questions: [] };
        }
        
        let scriptHighlights = [];
        if (row.script_highlights) {
          try { scriptHighlights = JSON.parse(row.script_highlights); } catch(e) {}
        }
        
        setsMap[setId].questions.push({
          questionNum: parseInt(row.question_num) || 1,
          audioUrl: row.audio_url || '',
          gender: row.gender || '',
          options: [row.option1 || '', row.option2 || '', row.option3 || '', row.option4 || ''],
          answer: parseInt(row.answer) || 1,
          script: row.script || '',
          scriptTrans: row.script_trans || '',
          scriptHighlights: scriptHighlights,
          optionTranslations: [row.option_trans1 || '', row.option_trans2 || '', row.option_trans3 || '', row.option_trans4 || ''],
          optionExplanations: [row.option_exp1 || '', row.option_exp2 || '', row.option_exp3 || '', row.option_exp4 || '']
        });
      });
      
      const sets = Object.values(setsMap);
      sets.forEach(set => set.questions.sort((a, b) => a.questionNum - b.questionNum));
      sets.sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''));
        const numB = parseInt(b.id.replace(/\D/g, ''));
        return numA - numB;
      });
      
      return { type: 'listening_response', timeLimit: this.RESPONSE_TIME_LIMIT, sets };
      
    } catch (error) {
      console.error('❌ [ResponseComponent] Supabase 로드 실패:', error);
      return null;
    }
  }

  /**
   * CSV 파싱
   */
  parseCSV(csvText) {
    console.log('[ResponseComponent] CSV 파싱 시작');
    
    const lines = csvText.trim().split('\n');
    const setsMap = {};
    let lastSetId = '';
    
    // 헤더 제외하고 데이터 파싱
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line);
      
      if (values.length < 9) {
        console.warn(`[ResponseComponent] Line ${i} 건너뜀: 열 부족 (${values.length}/9)`);
        continue;
      }
      
      let setId = values[0].trim();
      if (!setId && lastSetId) {
        setId = lastSetId;
      }
      if (setId) {
        lastSetId = setId;
        // ID 정규화: response_set_0001 형식 그대로 사용
        if (/^\d+$/.test(setId)) {
          // 순수 숫자: "1" → "response_set_0001"
          setId = `response_set_${String(setId).padStart(4, '0')}`;
        }
        // 다른 형식은 그대로 사용
      }
      
      const questionNum = parseInt(values[1]) || 1;
      const audioUrl = values[2].trim();
      const gender = values[3].trim();
      const option1 = values[4].trim();
      const option2 = values[5].trim();
      const option3 = values[6].trim();
      const option4 = values[7].trim();
      const answer = parseInt(values[8]) || 1;
      
      const script = values[9] ? values[9].trim() : '';
      const scriptTrans = values[10] ? values[10].trim() : '';
      const optionTrans1 = values[11] ? values[11].trim() : '';
      const optionTrans2 = values[12] ? values[12].trim() : '';
      const optionTrans3 = values[13] ? values[13].trim() : '';
      const optionTrans4 = values[14] ? values[14].trim() : '';
      const optionExp1 = values[15] ? values[15].trim() : '';
      const optionExp2 = values[16] ? values[16].trim() : '';
      const optionExp3 = values[17] ? values[17].trim() : '';
      const optionExp4 = values[18] ? values[18].trim() : '';
      
      let scriptHighlights = [];
      if (values[19]) {
        try {
          scriptHighlights = JSON.parse(values[19]);
        } catch (e) {
          scriptHighlights = [];
        }
      }
      
      // 최종 정규화된 ID 저장
      if (!setsMap[setId]) {
        setsMap[setId] = {
          id: setId,
          questions: []
        };
      }
      
      setsMap[setId].questions.push({
        questionNum: questionNum,
        audioUrl: audioUrl,
        gender: gender,
        options: [option1, option2, option3, option4],
        answer: answer,
        script: script,
        scriptTrans: scriptTrans,
        scriptHighlights: scriptHighlights,
        optionTranslations: [optionTrans1, optionTrans2, optionTrans3, optionTrans4],
        optionExplanations: [optionExp1, optionExp2, optionExp3, optionExp4]
      });
    }
    
    const sets = Object.values(setsMap);
    sets.forEach(set => {
      set.questions.sort((a, b) => a.questionNum - b.questionNum);
    });
    
    // ✅ Set ID 기준으로 정렬 (response_set_0001, response_set_0002, ...)
    console.log('🔄 [ResponseComponent] 정렬 전 순서:', sets.map(s => s.id));
    
    sets.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ''));
      const numB = parseInt(b.id.replace(/\D/g, ''));
      console.log(`  비교: ${a.id} (${numA}) vs ${b.id} (${numB}) → ${numA - numB}`);
      return numA - numB;
    });
    
    console.log('✅ [ResponseComponent] 정렬 후 순서:', sets.map(s => s.id));
    
    // 디버깅: 최종 데이터 검증
    sets.forEach((set, idx) => {
      console.log(`  [${idx}] ${set.id} - ${set.questions.length}문제`);
    });
    
    console.log(`[ResponseComponent] CSV 파싱 완료: ${sets.length}개 세트`);
    
    return {
      type: 'listening_response',
      timeLimit: this.RESPONSE_TIME_LIMIT,
      sets: sets
    };
  }

  /**
   * CSV 라인 파싱 (쉼표 + 따옴표 처리)
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && nextChar === '"' && inQuotes) {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  /**
   * 세트 인덱스 찾기
   */
  findSetIndex(sets) {
    // ✅ setNumber를 response_set_XXXX 형식으로 변환
    let setId;
    if (typeof this.setNumber === 'string' && this.setNumber.includes('_set_')) {
      // 이미 "response_set_0001" 형식이면 그대로 사용
      setId = this.setNumber;
      console.log(`🔍 [findSetIndex] setId 문자열 직접 사용: ${setId}`);
    } else {
      // 숫자면 "response_set_XXXX" 형식으로 변환
      setId = `response_set_${String(this.setNumber).padStart(4, '0')}`;
      console.log(`🔍 [findSetIndex] setNumber ${this.setNumber} → setId: ${setId}`);
    }
    
    console.log(`[ResponseComponent] 세트 검색 - ID: ${setId}`);
    
    const index = sets.findIndex(s => s.id === setId);
    console.log(`[ResponseComponent] 세트 인덱스: ${index}`);
    return index;
  }

  /**
   * 문제 로드
   */
  loadQuestion(questionIndex) {
    console.log(`[ResponseComponent] 문제 로드 - questionIndex: ${questionIndex}`);
    
    // 🔴 이전 오디오 완전 정리 (렉 방지)
    this.stopAudio();
    
    // v007: 타임아웃 상태 초기화
    this._questionTimedOut = false;
    const timeoutNotice = document.getElementById('responseTimeoutNotice');
    if (timeoutNotice) timeoutNotice.remove();
    
    const question = this.setData.questions[questionIndex];
    if (!question) {
      console.error('[ResponseComponent] 문제 데이터 없음');
      return;
    }
    
    this.currentQuestion = questionIndex;
    this._currentQuestion = question; // v007: 버튼 클릭 시 사용
    
    // ModuleController에게 진행률 업데이트 요청
    if (window.moduleController) {
      window.moduleController.updateCurrentQuestionInComponent(questionIndex);
    }
    
    // 타이머 정지 및 표시 초기화
    if (window.moduleController) {
      window.moduleController.stopQuestionTimer();
      window.moduleController.resetQuestionTimerDisplay();
    }
    
    // 사람 이미지 표시
    this.renderPersonImage(question.gender);
    
    // v007: 보기를 보여주되 흐리게 + [듣기 시작] 버튼 표시
    this.renderOptions(question, true);
    this._showPlayButton();
  }
  
  /**
   * v007: [듣기 시작] 버튼 표시
   */
  _showPlayButton() {
    const container = document.getElementById('responsePersonImage');
    if (!container) return;
    
    // 기존 버튼 제거
    const existingBtn = document.getElementById('responseListenBtn');
    if (existingBtn) existingBtn.remove();
    
    const btn = document.createElement('button');
    btn.id = 'responseListenBtn';
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;margin-right:10px;"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="white"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="white"/><path d="M19 12c0-3.17-1.82-5.9-4.5-7.22v2.16A5.98 5.98 0 0 1 18 12c0 2.48-1.35 4.64-3.5 5.06v2.16C17.18 17.9 19 15.17 19 12z" fill="white" opacity="0.7"/></svg>듣기 시작';
    btn.style.cssText = '';
    btn.onmouseover = null;
    btn.onmouseout = null;
    btn.onclick = () => this._onPlayButtonClick();
    container.appendChild(btn);
  }
  
  /**
   * v007: [듣기 시작] 버튼 클릭 시 실행
   */
  _onPlayButtonClick() {
    const question = this._currentQuestion;
    if (!question) return;
    
    console.log('[ResponseComponent] 🔊 [듣기 시작] 버튼 클릭');
    
    // 버튼 숨기기
    const btn = document.getElementById('responseListenBtn');
    if (btn) btn.remove();
    
    // 오디오가 유효한지 확인
    const hasValidAudio = question.audioUrl && 
                          question.audioUrl !== 'PLACEHOLDER' && 
                          !question.audioUrl.includes('1ABC123DEF456');
    
    if (hasValidAudio) {
      // 오디오 재생 (보기는 이미 흐린 상태)
      this.playAudio(question.audioUrl, () => {
        if (this._destroyed) return;
        // 오디오 끝 → 바로 보기 선명하게 + 타이머 시작
        this.renderOptions(question, false);
        if (this.onTimerStart) {
          this.onTimerStart();
        }
      });
    } else {
      // 오디오 없으면 즉시 보기 표시 + 타이머 시작
      this.renderOptions(question, false);
      if (this.onTimerStart) {
        this.onTimerStart();
      }
    }
  }

  /**
   * 직전 이미지를 제외하고 랜덤 선택
   */
  _pickRandomExcludingLast(imageArray, lastKey) {
    if (imageArray.length <= 1) return imageArray[0] || '';
    const last = this[lastKey];
    const candidates = last ? imageArray.filter(img => img !== last) : imageArray;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    this[lastKey] = picked;
    return picked;
  }

  /**
   * 사람 이미지 렌더링
   */
  renderPersonImage(gender, showPlayButton = false) {
    console.log('[ResponseComponent] 이미지 렌더링 - 성별:', gender, '재생버튼:', showPlayButton);
    
    const container = document.getElementById('responsePersonImage');
    if (!container) {
      console.error('[ResponseComponent] responsePersonImage 요소 없음');
      return;
    }
    
    let imageUrl;
    if (gender === 'F' || gender === 'female') {
      imageUrl = this._pickRandomExcludingLast(this.FEMALE_IMAGES, '_lastFemaleImage');
    } else {
      imageUrl = this._pickRandomExcludingLast(this.MALE_IMAGES, '_lastMaleImage');
    }
    
    // 재생/일시정지 버튼 HTML (2차 풀이 모드에서만)
    const playButtonHtml = showPlayButton ? `
      <button id="responseAudioToggleBtn" style="
        margin-top: 16px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #4a90e2;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
        transition: all 0.2s;
      " onmouseenter="this.style.background='#357abd'; this.style.transform='scale(1.05)';"
         onmouseleave="this.style.background='#4a90e2'; this.style.transform='scale(1)';">
        ▶
      </button>
    ` : '';
    
    container.innerHTML = `
      <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <img src="${imageUrl}" alt="${gender} speaker" 
             style="width: 100%; max-width: 400px; height: auto; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); object-fit: cover;"
             onerror="console.error('❌ 이미지 로드 실패:', this.src); this.style.display='none';"
             onload="console.log('✅ 이미지 로드 성공:', this.src);">
        ${playButtonHtml}
      </div>
    `;
    
    // 2차 풀이 모드에서만 버튼 이벤트 리스너 추가
    if (showPlayButton) {
      setTimeout(() => {
        const toggleBtn = document.getElementById('responseAudioToggleBtn');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => this.toggleAudioPlayback());
        }
      }, 0);
    }
  }
  
  /**
   * 오디오 재생/일시정지 토글 (2차 풀이 모드)
   */
  toggleAudioPlayback() {
    const toggleBtn = document.getElementById('responseAudioToggleBtn');
    
    if (!this.audioPlayer) {
      console.warn('[ResponseComponent] 오디오 플레이어가 없습니다');
      if (toggleBtn) toggleBtn.textContent = '⚠️';
      return;
    }
    
    if (this.audioPlayer.paused) {
      // 재생
      this.audioPlayer.play().then(() => {
        console.log('[ResponseComponent] 오디오 재생');
        if (toggleBtn) toggleBtn.textContent = '⏸';
        this.isAudioPlaying = true;
      }).catch(err => {
        console.error('[ResponseComponent] 재생 실패:', err);
      });
    } else {
      // 일시정지
      this.audioPlayer.pause();
      console.log('[ResponseComponent] 오디오 일시정지');
      if (toggleBtn) toggleBtn.textContent = '▶';
      this.isAudioPlaying = false;
    }
  }
  
  /**
   * 오디오 완전 정지 및 정리 (렉 방지)
   */
  stopAudio() {
    // 🔴 대기 중인 딜레이 타이머도 취소 (오디오 겹침 방지)
    if (this._audioDelayTimer) {
      clearTimeout(this._audioDelayTimer);
      this._audioDelayTimer = null;
      console.log('[ResponseComponent] 🛑 딜레이 타이머 취소');
    }
    
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        // ★ 이벤트 리스너 먼저 제거 (src='' 시 error 이벤트 트리거 방지)
        this.audioPlayer.onended = null;
        this.audioPlayer.onerror = null;
        this.audioPlayer.removeAttribute('src');
        this.audioPlayer.load(); // 리소스 해제
        this.audioPlayer = null;
        this.isAudioPlaying = false;
        console.log('[ResponseComponent] 🛑 오디오 완전 정리 완료');
      } catch (err) {
        console.warn('[ResponseComponent] 오디오 정리 중 오류:', err);
      }
    }
    
    // 버튼 상태도 초기화
    const toggleBtn = document.getElementById('responseAudioToggleBtn');
    if (toggleBtn) toggleBtn.textContent = '▶';
  }

  /**
   * 선택지 렌더링
   */
  renderOptions(question, isBlurred) {
    console.log('[ResponseComponent] 선택지 렌더링 - 블러:', isBlurred);
    
    const container = document.getElementById('responseOptions');
    if (!container) return;
    
    const questionKey = `${this.setData.id}_q${this.currentQuestion + 1}`;
    const savedAnswer = this.answers[questionKey];
    
    const optionsHtml = question.options.map((option, index) => {
      const selectedClass = savedAnswer === (index + 1) ? 'selected' : '';
      const blurClass = isBlurred ? 'blurred' : '';
      const disabledAttr = isBlurred ? 'style="pointer-events: none;"' : '';
      
      return `
        <div class="response-option ${selectedClass} ${blurClass}" 
             onclick="window.currentResponseComponent.selectOption(${index + 1})"
             ${disabledAttr}>
          ${option}
        </div>
      `;
    }).join('');
    
    container.innerHTML = optionsHtml;
  }

  /**
   * Google Drive URL 변환
   */
  convertGoogleDriveUrl(url) {
    if (!url || url === 'PLACEHOLDER') return url;
    if (url.trim() === '') return '';
    if (url.startsWith('http') && !url.includes('drive.google.com')) {
      return url;
    }
    
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=open&id=${match[1]}`;
    }
    
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=open&id=${idMatch[1]}`;
    }
    
    return url;
  }

  /**
   * 오디오 재생
   * v007: 실패 시 다시 재생/건너뛰기 UI 표시
   */
  playAudio(audioUrl, onEnded) {
    console.log('[ResponseComponent] 오디오 재생 시작');
    console.log('[ResponseComponent] 원본 audioUrl:', audioUrl);
    
    if (!audioUrl || audioUrl === 'PLACEHOLDER' || audioUrl.includes('1ABC123DEF456')) {
      console.warn('[ResponseComponent] 오디오 URL 없음, 즉시 진행');
      if (onEnded) onEnded();
      return;
    }
    
    const convertedUrl = this.convertGoogleDriveUrl(audioUrl);
    console.log('[ResponseComponent] 변환된 URL:', convertedUrl);
    
    // 기존 오디오 정리
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.removeAttribute('src');
      this.audioPlayer.load();
      this.audioPlayer = null;
    }
    
    // v007: 중복 콜백 방지 플래그
    let _callbackFired = false;
    const fireCallback = (source) => {
      if (_callbackFired) {
        console.log(`[ResponseComponent] 콜백 중복 차단 (${source})`);
        return;
      }
      _callbackFired = true;
      this.isAudioPlaying = false;
      const toggleBtn = document.getElementById('responseAudioToggleBtn');
      if (toggleBtn) toggleBtn.textContent = '▶';
    };
    
    this.audioPlayer = new Audio(convertedUrl);
    this.isAudioPlaying = true;
    
    this.audioPlayer.addEventListener('loadeddata', () => {
      console.log('[ResponseComponent] 오디오 로드 완료');
    });
    
    this.audioPlayer.addEventListener('ended', () => {
      if (this._destroyed) return;
      console.log('[ResponseComponent] 오디오 재생 완료');
      fireCallback('ended');
      if (onEnded) onEnded();
    });
    
    this.audioPlayer.addEventListener('error', (e) => {
      if (this._destroyed) return;
      if (!this.audioPlayer) return;
      console.error('[ResponseComponent] 오디오 재생 실패:', e);
      fireCallback('error');
      // v007: 실패 시 다시 재생/건너뛰기 UI 표시
      this._showAudioRetryUI(audioUrl, onEnded);
    });
    
    this.audioPlayer.play().catch(err => {
      if (this._destroyed) return;
      console.error('[ResponseComponent] 오디오 play() 실패:', err.name, err.message);
      fireCallback('catch');
      // v007: 실패 시 다시 재생/건너뛰기 UI 표시
      this._showAudioRetryUI(audioUrl, onEnded);
    });
    
    // 2차 풀이 모드: 버튼 상태 업데이트 (재생 중)
    setTimeout(() => {
      if (this._destroyed) return;
      const toggleBtn = document.getElementById('responseAudioToggleBtn');
      if (toggleBtn) toggleBtn.textContent = '⏸';
    }, 100);
  }
  
  /**
   * v007: 오디오 재생 실패 시 다시 재생 UI
   */
  _showAudioRetryUI(audioUrl, onEnded) {
    // 이미 표시 중이면 중복 생성 방지
    if (document.getElementById('responseAudioRetryUI')) return;
    
    const container = document.getElementById('responsePersonImage');
    if (!container) return;
    
    const retryDiv = document.createElement('div');
    retryDiv.id = 'responseAudioRetryUI';
    retryDiv.style.cssText = `
      text-align: center;
      padding: 16px;
      margin-top: 12px;
      background: #fee2e2;
      border: 1px solid #ef4444;
      border-radius: 8px;
    `;
    retryDiv.innerHTML = `
      <p style="color: #dc2626; font-weight: 600; margin: 0 0 12px;">
        오디오를 불러오지 못했습니다
      </p>
      <button id="responseRetryBtn" style="
        padding: 10px 20px;
        background: #4a90e2;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      ">🔄 다시 재생</button>
    `;
    container.appendChild(retryDiv);
    
    // 다시 재생 버튼
    document.getElementById('responseRetryBtn').onclick = () => {
      retryDiv.remove();
      console.log('[ResponseComponent] 🔄 오디오 다시 재생 시도');
      this.playAudio(audioUrl, onEnded);
    };
  }

  /**
   * v007: 타임아웃 시 보기 선택 막기
   */
  onQuestionTimeout() {
    console.log('[ResponseComponent] ⏰ 시간 초과 - 보기 선택 차단');
    this._questionTimedOut = true;
    
    // 보기 흐리게 + 클릭 불가
    document.querySelectorAll('.response-option').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.5';
    });
    
    // 시간 초과 안내 표시
    const container = document.getElementById('responseOptions');
    if (container) {
      const notice = document.createElement('div');
      notice.id = 'responseTimeoutNotice';
      notice.style.cssText = `
        text-align: center;
        padding: 12px;
        margin-top: 12px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        color: #856404;
        font-weight: 600;
      `;
      notice.textContent = '⏰ 시간이 초과되었습니다. Next 버튼을 눌러주세요.';
      container.appendChild(notice);
    }
  }
  
  /**
   * 선택지 선택
   */
  selectOption(optionIndex) {
    if (this._questionTimedOut) return; // v007: 타임아웃되면 선택 불가
    
    console.log(`[ResponseComponent] 선택 - Q${this.currentQuestion + 1}: ${optionIndex}`);
    
    const questionKey = `${this.setData.id}_q${this.currentQuestion + 1}`;
    this.answers[questionKey] = optionIndex;
    
    // UI 업데이트
    document.querySelectorAll('.response-option').forEach((el, idx) => {
      if (idx === optionIndex - 1) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  /**
   * 다음 문제로 이동
   */
  nextQuestion() {
    if (this.currentQuestion < this.setData.questions.length - 1) {
      this.loadQuestion(this.currentQuestion + 1);
      return true;
    }
    return false;
  }

  /**
   * 제출 & 채점
   */
  submit() {
    console.log('[ResponseComponent] ✅ 제출 시작');
    
    if (this.isSubmitting) {
      console.warn('[ResponseComponent] ⚠️ 중복 제출 방지');
      return null;
    }
    
    this.isSubmitting = true;
    
    // 타이머 정지
    if (window.moduleController) {
      window.moduleController.stopQuestionTimer();
      console.log('[ResponseComponent] ⏸️ 타이머 정지 요청 완료');
    }
    
    // 오디오 정지
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
    }
    this.isAudioPlaying = false;
    
    // 결과 데이터 준비
    const results = {
      setId: this.setData.id,
      answers: []
    };
    
    this.setData.questions.forEach((question, index) => {
      const questionKey = `${this.setData.id}_q${index + 1}`;
      const userAnswer = this.answers[questionKey] || null;
      const isCorrect = userAnswer === question.answer;
      
      results.answers.push({
        questionNum: question.questionNum,
        audioUrl: question.audioUrl,
        script: question.script || '',
        scriptTrans: question.scriptTrans || '',
        scriptHighlights: question.scriptHighlights || [],
        options: question.options,
        optionTranslations: question.optionTranslations || [],
        optionExplanations: question.optionExplanations || [],
        userAnswer: userAnswer,
        correctAnswer: question.answer,
        isCorrect: isCorrect
      });
    });
    
    console.log('[ResponseComponent] 채점 완료:', results);
    
    // sessionStorage 저장
    sessionStorage.setItem('responseResults', JSON.stringify([results]));
    
    // 완료 콜백
    if (this.onComplete) {
      console.log('[ResponseComponent] 🎉 onComplete 콜백 호출');
      this.onComplete(results);
    } else {
      console.warn('[ResponseComponent] ⚠️ onComplete 콜백이 설정되지 않음');
    }
    
    return results;
  }

  /**
   * 데모 데이터
   */
  getDemoData() {
    return {
      type: 'listening_response',
      timeLimit: 20,
      sets: [
        {
          id: 'listening_response_1',
          questions: [
            {
              questionNum: 1,
              audioUrl: '',
              gender: 'female',
              options: [
                'As a matter of fact, I was returning a book.',
                'Yes, you can find it in the reference section.',
                'I don\'t think I\'ll have enough time to do that.',
                'Actually, I think I can get there a little earlier.'
              ],
              answer: 1,
              script: 'Did you stop by the library yesterday?',
              scriptTrans: '어제 도서관에 들렀어?',
              scriptHighlights: [],
              optionTranslations: [
                '사실, 나는 책을 반납하고 있었어.',
                '네, 참고 자료 섹션에서 찾을 수 있어요.',
                '그럴 시간이 충분하지 않을 것 같아요.',
                '사실, 조금 더 일찍 도착할 수 있을 것 같아요.'
              ],
              optionExplanations: [
                '도서관에 들렀는지 묻는 질문에 "책을 반납하고 있었다"는 답변은 적절합니다.',
                '장소를 묻는 질문이 아니므로 부적절합니다.',
                '시간 여부를 묻는 질문이 아니므로 문맥에 맞지 않습니다.',
                '도착 시간에 대한 답변으로 질문과 관련이 없습니다.'
              ]
            }
          ]
        }
      ]
    };
  }

  
  /**
   * ================================================
   * 2차 풀이 (이중채점) 모드
   * ================================================
   */
  
  /**
   * 2차 풀이 모드로 단일 문제 표시
   * @param {number} questionIndex - 세트 내 문제 인덱스 (0-11)
   * @param {boolean} wasCorrect - 1차에 맞았는지 여부
   * @param {any} firstAttemptAnswer - 1차 답안
   */
  async initRetakeMode(questionIndex, wasCorrect, firstAttemptAnswer = null) {
    console.log(`🔄 [ResponseComponent] 2차 풀이 모드 - 문제 ${questionIndex}, 1차 결과: ${wasCorrect ? '✅' : '❌'}`);
    console.log(`  📥 firstAttemptAnswer:`, firstAttemptAnswer);
    
    try {
      // 1. 데이터 로드
      const allData = await this.loadData();
      
      if (!allData || !allData.sets || allData.sets.length === 0) {
        throw new Error('데이터를 불러올 수 없습니다');
      }
      
      // 2. 세트 찾기
      const setIndex = this.findSetIndex(allData.sets);
      if (setIndex === -1) {
        throw new Error(`세트를 찾을 수 없습니다: ${this.setNumber}`);
      }
      
      this.setData = allData.sets[setIndex];
      this.currentQuestion = questionIndex;
      
      console.log(`  📊 setData.id: ${this.setData.id}`);
      console.log(`  📊 선택된 question (index ${questionIndex}):`, this.setData.questions[questionIndex]?.audioUrl);
      
      // 3. 화면 표시
      showScreen('listeningResponseScreen');
      
      // 4. 타이머 숨기기
      this.hideTimer();
      
      // 5. 문제 렌더링 (2차 풀이 모드)
      await this.renderQuestionRetakeMode(questionIndex, wasCorrect, firstAttemptAnswer);
      
    } catch (error) {
      console.error('[ResponseComponent] 2차 풀이 초기화 실패:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }
  
  /**
   * 2차 풀이 모드로 문제 렌더링
   */
  async renderQuestionRetakeMode(questionIndex, wasCorrect, firstAttemptAnswer) {
    console.log(`🎨 [ResponseComponent] 2차 풀이 문제 렌더링 - Q${questionIndex + 1}`);
    
    // 🔴 이전 오디오 완전 정리 (렉 방지)
    this.stopAudio();
    
    const question = this.setData.questions[questionIndex];
    if (!question) {
      console.error(`❌ 문제를 찾을 수 없습니다: index ${questionIndex}`);
      return;
    }
    
    // ModuleController에게 진행률 업데이트 요청
    if (window.moduleController) {
      window.moduleController.updateCurrentQuestionInComponent(questionIndex);
    }
    
    // 오디오 파일 준비 (재생은 하지 않음, 학생이 버튼으로 수동 재생)
    if (question.audioUrl && question.audioUrl !== 'PLACEHOLDER') {
      const convertedUrl = this.convertGoogleDriveUrl(question.audioUrl);
      this.audioPlayer = new Audio(convertedUrl);
      this.audioPlayer.addEventListener('ended', () => {
        if (this._destroyed) return;
        this.isAudioPlaying = false;
        const toggleBtn = document.getElementById('responseAudioToggleBtn');
        if (toggleBtn) toggleBtn.textContent = '▶';
      });
    }
    
    // 화자 이미지 표시 (2차 풀이 모드: 재생 버튼 포함, 자동재생 없음)
    this.renderPersonImage(question.gender, true);
    
    // 선택지 렌더링 (2차 풀이 모드)
    const optionsContainer = document.getElementById('responseOptions');
    if (!optionsContainer) {
      console.error('❌ responseOptions 요소를 찾을 수 없습니다');
      return;
    }
    
    optionsContainer.innerHTML = '';
    
    // 각 선택지 렌더링
    question.options.forEach((option, index) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'response-option';
      
      const optionNumber = index + 1; // 1, 2, 3, 4
      
      // 2차 풀이: 1차에 맞았으면 정답 표시하고 클릭 불가
      if (wasCorrect && firstAttemptAnswer && firstAttemptAnswer.userAnswer === optionNumber) {
        optionDiv.classList.add('retake-option-correct');
        // 클릭 불가
      } else {
        // 틀렸거나 다른 보기: 클릭 가능
        optionDiv.onclick = () => this.selectOption(optionNumber);
      }
      
      // 선택지 텍스트 설정
      optionDiv.textContent = option;
      optionDiv.setAttribute('data-value', optionNumber);
      
      optionsContainer.appendChild(optionDiv);
    });
    
    // ✅ 이전에 선택한 답안 복원
    const questionKey = `${this.setData.id}_q${questionIndex + 1}`;
    const savedAnswer = this.answers[questionKey];
    if (savedAnswer) {
      const options = optionsContainer.querySelectorAll('.response-option');
      options.forEach((opt, idx) => {
        if (idx + 1 === savedAnswer) {
          opt.classList.add('selected');
        }
      });
      console.log(`✅ [ResponseComponent] 답안 복원: ${questionKey} = ${savedAnswer}`);
    }
    
    console.log(`✅ [ResponseComponent] 2차 풀이 렌더링 완료 - ${question.options.length}개 보기`);
  }
  
  /**
   * 타이머와 버튼 숨기기
   */
  hideTimer() {
    console.log('  ⏱️ [ResponseComponent] 타이머 및 버튼 숨김 시작');
    
    // ✅ Response 타이머 숨기기
    const timerEl = document.getElementById('responseTimer');
    if (timerEl && timerEl.parentElement) {
      timerEl.parentElement.style.display = 'none';
      console.log('  ✅ responseTimer 숨김');
    }
    
    // ✅ ModuleController 타이머 정지
    if (window.moduleController) {
      // 전체 타이머 정지
      if (window.moduleController.stopTimer) {
        window.moduleController.stopTimer();
      }
      
      // 문제당 타이머 정지
      if (window.moduleController.stopQuestionTimer) {
        window.moduleController.stopQuestionTimer();
      }
    }
    
    // ✅ 모든 가능한 Next/Submit 버튼 숨기기
    const buttonsToHide = [
      'button[onclick*="nextQuestion"]',
      'button[onclick*="submitComponent"]',
      'button[onclick*="nextModule"]',
      '.next-btn',
      '.submit-btn',
      '.timer-section button'
    ];
    
    buttonsToHide.forEach(selector => {
      document.querySelectorAll(selector).forEach(btn => {
        if (btn && btn.parentElement) {
          btn.parentElement.style.display = 'none';
        }
      });
    });
    
    console.log('  ✅ 타이머 및 버튼 숨김 완료');
  }
  
  /**
   * 2차 답안 가져오기 (RetakeController가 호출)
   */
  getRetakeAnswer() {
    if (!this.setData) {
      console.warn('[ResponseComponent] getRetakeAnswer: setData가 null입니다');
      return null;
    }
    const questionKey = `${this.setData.id}_q${this.currentQuestion + 1}`;
    return this.answers[questionKey] || null;
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    console.log('[ResponseComponent] Cleanup 시작');
    
    // v007: 2초 대기 타이머 삭제됨 (수동 버튼 방식)
    
    // 🔴 destroyed 플래그 설정 (에러 핸들러 콜백 차단)
    this._destroyed = true;
    
    // 오디오 완전 정리
    this.stopAudio();
    
    // 2차 풀이 AudioPlayer 정리
    if (this.retakeAudioPlayer && typeof this.retakeAudioPlayer.destroy === 'function') {
      this.retakeAudioPlayer.destroy();
      this.retakeAudioPlayer = null;
    }
    
    this.isAudioPlaying = false;
    this.isSubmitting = false;
    this.answers = {};
    
    console.log('[ResponseComponent] Cleanup 완료');
  }
}

// 전역으로 노출
window.ResponseComponent = ResponseComponent;
console.log('[ResponseComponent] 클래스 정의 완료');
