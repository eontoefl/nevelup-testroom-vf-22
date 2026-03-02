/**
 * Supabase 데이터 로더
 * Google Sheets 대신 Supabase에서 데이터 로드
 */

// Supabase 설정
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // 예: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Supabase 클라이언트 초기화
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 빈칸채우기 데이터 로드
 */
async function loadFillBlanksFromSupabase() {
    try {
        // 1. 세트 로드
        const { data: sets, error: setsError } = await supabase
            .from('reading_fillblank_sets')
            .select('*')
            .order('id');
        
        if (setsError) throw setsError;
        
        // ✅ ID 기준으로 명확하게 정렬
        const sortedSets = sets.sort((a, b) => {
            const numA = parseInt(a.id.match(/\d+/)[0]);
            const numB = parseInt(b.id.match(/\d+/)[0]);
            return numA - numB;
        });
        
        console.log('📊 [FillBlanks] 정렬된 세트 순서:', sortedSets.map(s => s.id));
        
        // 2. 각 세트의 빈칸 데이터 로드
        const setsWithBlanks = await Promise.all(sortedSets.map(async (set) => {
            const { data: blanks, error: blanksError } = await supabase
                .from('reading_fillblank_blanks')
                .select('*')
                .eq('set_id', set.id)
                .order('blank_order');
            
            if (blanksError) throw blanksError;
            
            return {
                id: set.id,
                title: set.title,
                passage: set.passage,
                blanks: blanks
            };
        }));
        
        return {
            type: 'fill_blanks',
            timeLimit: 180,
            sets: setsWithBlanks
        };
        
    } catch (error) {
        console.error('❌ Supabase 빈칸채우기 로드 실패:', error);
        return null;
    }
}

/**
 * 일상리딩1 데이터 로드
 */
async function loadDaily1FromSupabase() {
    try {
        // 1. 세트 로드
        const { data: sets, error: setsError } = await supabase
            .from('reading_daily1_sets')
            .select('*')
            .order('id');
        
        if (setsError) throw setsError;
        
        // ✅ ID 기준으로 명확하게 정렬 (daily1_set_0001, daily1_set_0002, ...)
        const sortedSets = sets.sort((a, b) => {
            const numA = parseInt(a.id.match(/\d+/)[0]);
            const numB = parseInt(b.id.match(/\d+/)[0]);
            return numA - numB;
        });
        
        console.log('📊 [Daily1] 정렬된 세트 순서:', sortedSets.map(s => s.id));
        
        // 2. 각 세트의 상세 데이터 로드
        const setsWithDetails = await Promise.all(sortedSets.map(async (set) => {
            // 번역 로드
            const { data: translations } = await supabase
                .from('reading_daily1_translations')
                .select('*')
                .eq('set_id', set.id)
                .order('sentence_order');
            
            // 인터랙티브 단어 로드
            const { data: interactiveWords } = await supabase
                .from('reading_daily1_interactive_words')
                .select('*')
                .eq('set_id', set.id)
                .order('word_order');
            
            // 문제 로드
            const { data: questions } = await supabase
                .from('reading_daily1_questions')
                .select(`
                    *,
                    reading_daily1_options (*)
                `)
                .eq('set_id', set.id)
                .order('question_order');
            
            // 문제별로 보기 정렬
            const questionsWithOptions = questions.map(q => ({
                questionNum: q.question_num,
                question: q.question_text,
                questionTranslation: q.question_translation,
                correctAnswer: q.correct_answer,
                options: q.reading_daily1_options.sort((a, b) => a.option_order - b.option_order)
            }));
            
            return {
                id: set.id,
                mainTitle: set.main_title,
                passage: {
                    title: set.passage_title,
                    content: set.passage_content,
                    translations: translations.map(t => t.translation),
                    interactiveWords: interactiveWords
                },
                questions: questionsWithOptions
            };
        }));
        
        return {
            type: 'daily_reading_1',
            timeLimit: 60,
            sets: setsWithDetails
        };
        
    } catch (error) {
        console.error('❌ Supabase 일상리딩1 로드 실패:', error);
        return null;
    }
}

/**
 * 일상리딩2 데이터 로드
 */
async function loadDaily2FromSupabase() {
    // 일상리딩1과 유사한 구조
    // ... (생략)
}

/**
 * 아카데믹리딩 데이터 로드
 */
async function loadAcademicFromSupabase() {
    // 일상리딩1과 유사한 구조
    // ... (생략)
}

/**
 * 캐싱 전략 (선택사항)
 */
const dataCache = {
    fillblanks: null,
    daily1: null,
    daily2: null,
    academic: null,
    timestamp: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5분
const CACHE_VERSION = 2; // ✅ 버전 추가 (정렬 로직 변경 시 증가)

async function loadWithCache(type, loaderFunc) {
    const now = Date.now();
    
    // ✅ 캐시 버전 체크 추가
    const currentVersion = parseInt(localStorage.getItem('cacheVersion') || '0');
    if (currentVersion < CACHE_VERSION) {
        console.log(`🔄 [캐시] 버전 업데이트 - 캐시 초기화 (v${currentVersion} → v${CACHE_VERSION})`);
        // 캐시 초기화
        dataCache.fillblanks = null;
        dataCache.daily1 = null;
        dataCache.daily2 = null;
        dataCache.academic = null;
        dataCache.timestamp = null;
        localStorage.setItem('cacheVersion', CACHE_VERSION.toString());
    }
    
    // 캐시가 유효하면 재사용
    if (dataCache[type] && dataCache.timestamp && (now - dataCache.timestamp < CACHE_DURATION)) {
        console.log(`♻️ [${type}] 캐시된 데이터 사용`);
        return dataCache[type];
    }
    
    // 새로 로드
    console.log(`📥 [${type}] Supabase에서 로드 중...`);
    const data = await loaderFunc();
    
    // 캐시 저장
    dataCache[type] = data;
    dataCache.timestamp = now;
    
    return data;
}

// 사용 예시
async function loadDaily1Data() {
    return await loadWithCache('daily1', loadDaily1FromSupabase);
}
