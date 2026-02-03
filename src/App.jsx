import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot,
  enableIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { 
  Music, 
  Check, 
  Loader2, 
  WifiOff,
  Trophy,
  Zap,
  ArrowRight,
  RotateCcw,
  Users
} from 'lucide-react';

// --- НАСТРОЙКИ FIREBASE ---
// Вставьте ваши ключи сюда:
const firebaseConfig = {
  apiKey: "AIzaSyD5Dhe2WQ1du8H6a1ayhzsCdg5eVEzlehM",
  authDomain: "soundpool-online.firebaseapp.com",
  projectId: "soundpool-online",
  storageBucket: "soundpool-online.firebasestorage.app",
  messagingSenderId: "192512233766",
  appId: "1:192512233766:web:3205c8107be967244f71e7"
};

// --- ИНИЦИАЛИЗАЦИЯ ---
let auth, db;
try {
  if (firebaseConfig.apiKey !== "ВСТАВЬТЕ_СЮДА_ВАШ_API_KEY") {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = initializeFirestore(app, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
    enableIndexedDbPersistence(db).catch(() => {});
  }
} catch (e) {
  console.error("Init error", e);
}

const appId = 'soundpool-online-session-1';

const TRACKS = [
  { id: 101, title: 'Aldevaran (master)' },
  { id: 102, title: 'Anima (master)' },
  { id: 103, title: 'Benedicari (master)' },
  { id: 104, title: 'Gaiat Alhakim (master)' },
  { id: 105, title: 'Heiligenschein (master)' },
  { id: 106, title: 'Hex Color (master)' },
  { id: 107, title: 'Lobsang (master)' },
  { id: 108, title: 'Manifestar (master)' },
  { id: 109, title: 'Martinism (master)' },
  { id: 110, title: 'Paralelos infinitos (master)' },
  { id: 111, title: 'Perfect Nature (master)' },
  { id: 112, title: 'Quetalco (master)' },
  { id: 113, title: 'Sacro (master)' },
  { id: 114, title: 'Samsara wheel (master)' },
  { id: 115, title: 'Shelter (master)' },
  { id: 116, title: 'Sudarshan (master)' },
  { id: 117, title: 'Tallulah (master)' }
];

const PERSONAS = [
  { name: 'Артур Крылов', initials: 'АК', color: 'bg-blue-500' },
  { name: 'Артур Евсеенко', initials: 'АЕ', color: 'bg-purple-500' },
  { name: 'Егор Кучепатов', initials: 'ЕК', color: 'bg-green-500' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [view, setView] = useState('voting'); // 'voting' или 'results'
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState(null);
  
  const [cloudData, setCloudData] = useState({
    votes: { "Артур Крылов": [], "Артур Евсеенко": [], "Егор Кучепатов": [] }
  });

  // Авторизация
  useEffect(() => {
    if (!auth || firebaseConfig.apiKey.includes("ВСТАВЬТЕ")) {
      setError("Ключи не вставлены!"); return;
    }
    signInAnonymously(auth).catch(e => setError("Ошибка входа"));
    return onAuthStateChanged(auth, (u) => { setUser(u); setIsAuthReady(true); });
  }, []);

  // Синхронизация данных
  useEffect(() => {
    if (!user || !db) return;
    const docRef = doc(db, 'projects', 'soundpool', 'sessions', appId);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCloudData(prev => ({ ...prev, ...data, votes: { ...prev.votes, ...(data.votes || {}) } }));
      }
    });
  }, [user]);

  // Логика голоса
  const handleToggleVote = async (trackId) => {
    if (!selectedPersona) return;
    const myName = selectedPersona.name;
    const currentVotes = cloudData.votes[myName] || [];
    const newVotes = currentVotes.includes(trackId) 
      ? currentVotes.filter(id => id !== trackId)
      : [...currentVotes, trackId];

    // Оптимистичное обновление
    setCloudData(prev => ({
      ...prev,
      votes: { ...prev.votes, [myName]: newVotes }
    }));

    // Отправка
    await setDoc(doc(db, 'projects', 'soundpool', 'sessions', appId), {
      votes: { [myName]: newVotes }
    }, { merge: true });
  };

  // Подсчет итогов
  const results = useMemo(() => {
    const counts = {};
    TRACKS.forEach(t => counts[t.id] = 0);
    Object.values(cloudData.votes).forEach(votes => {
      if (Array.isArray(votes)) votes.forEach(id => { if (counts[id] !== undefined) counts[id]++ });
    });
    return TRACKS.map(t => ({ ...t, count: counts[t.id] })).sort((a, b) => b.count - a.count);
  }, [cloudData]);

  // --- UI КОМПОНЕНТЫ ---

  if (error) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500">{error}</div>;
  if (!isAuthReady) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500"><Loader2 className="animate-spin" /></div>;

  // Экран 1: Выбор персоны
  if (!selectedPersona) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col justify-center max-w-md mx-auto">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Music size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">SoundPool</h1>
          <p className="text-zinc-500">Кто вы?</p>
        </div>
        <div className="space-y-3">
          {PERSONAS.map(p => (
            <button key={p.name} onClick={() => setSelectedPersona(p)} className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-orange-500 transition-colors flex items-center justify-between group">
              <span className="font-bold">{p.name}</span>
              <span className={`text-xs ${p.color} text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity`}>{p.initials}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Экран 2: Результаты
  if (view === 'results') {
    return (
      <div className="min-h-screen bg-black text-white p-4 pb-24 font-sans max-w-md mx-auto">
        <div className="text-center py-6">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-3xl font-bold">Итоги</h2>
          <p className="text-zinc-500">Рейтинг треков</p>
        </div>

        <div className="space-y-4">
          {results.slice(0, 10).map((track, idx) => (
            track.count > 0 && (
              <div key={track.id} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-zinc-600'}`}>
                      #{idx + 1}
                    </span>
                    <span className="font-medium">{track.title}</span>
                  </div>
                  <span className="text-xl font-bold">{track.count}</span>
                </div>
                
                {/* Кто проголосовал */}
                <div className="flex gap-2 mt-2">
                  {PERSONAS.map(p => {
                    if (cloudData.votes[p.name]?.includes(track.id)) {
                      return (
                        <div key={p.name} className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${p.color}`}>
                          {p.name.split(' ')[0]}
                        </div>
                      )
                    }
                    return null;
                  })}
                </div>
              </div>
            )
          ))}
          {results[0].count === 0 && <p className="text-center text-zinc-600">Голосов пока нет</p>}
        </div>

        <button 
          onClick={() => setView('voting')}
          className="fixed bottom-6 left-4 right-4 bg-zinc-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 transition-colors max-w-md mx-auto"
        >
          <RotateCcw size={20} />
          Вернуться к выбору
        </button>
      </div>
    );
  }

  // Экран 3: Голосование (Основной)
  const myVotes = cloudData.votes[selectedPersona.name] || [];
  const votesCount = myVotes.length;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col max-w-md mx-auto">
      {/* Шапка */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-zinc-900 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${selectedPersona.color} flex items-center justify-center font-bold text-xs`}>
            {selectedPersona.initials}
          </div>
          <div>
            <div className="font-bold text-sm">{selectedPersona.name}</div>
            <div className="text-[10px] text-green-500 flex items-center gap-1"><Zap size={10} /> Online</div>
          </div>
        </div>
        <div className="text-xs text-zinc-500">Выбрано: <span className="text-white font-bold">{votesCount}</span></div>
      </div>

      {/* Список */}
      <div className="flex-1 p-4 pb-32 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-zinc-500 text-xs uppercase tracking-wider">
           <Users size={12} />
           <span>Выбор участников</span>
        </div>

        <div className="space-y-2">
          {TRACKS.map(track => {
            const isSelected = myVotes.includes(track.id);
            
            // Кто ЕЩЕ выбрал этот трек (кроме меня)
            const othersWhoVoted = PERSONAS.filter(p => 
              p.name !== selectedPersona.name && 
              cloudData.votes[p.name]?.includes(track.id)
            );

            return (
              <div 
                key={track.id}
                onClick={() => handleToggleVote(track.id)}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-orange-600/10 border-orange-500' 
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className={`font-medium text-sm mb-2 ${isSelected ? 'text-orange-400' : 'text-zinc-300'}`}>
                      {track.title}
                    </div>
                    
                    {/* Визуализация чужих голосов */}
                    {othersWhoVoted.length > 0 && (
                      <div className="flex gap-1">
                        {othersWhoVoted.map(p => (
                          <div key={p.name} className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center text-[8px] font-bold border border-black`}>
                            {p.initials}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Мой выбор (Галочка) */}
                  <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                    isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-zinc-700'
                  }`}>
                    {isSelected && <Check size={14} strokeWidth={4} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Кнопка завершения */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent max-w-md mx-auto">
        <button 
          onClick={() => setView('results')}
          className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10 flex items-center justify-center gap-2"
        >
          Завершить и смотреть итоги
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}


