import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot
} from 'firebase/firestore';
import { 
  Music, 
  Check, 
  Loader2, 
  WifiOff,
  Trophy
} from 'lucide-react';

// --- НАСТРОЙКИ FIREBASE ДЛЯ "SoundPool Online" ---
// 1. Скопируйте ключи из консоли Firebase (Project Settings -> Your apps)
// 2. Вставьте их ВМЕСТО объекта ниже:

const firebaseConfig = {
  apiKey: "AIzaSyD5Dhe2WQ1du8H6a1ayhzsCdg5eVEzlehM",
  authDomain: "soundpool-online.firebaseapp.com",
  projectId: "soundpool-online",
  storageBucket: "soundpool-online.firebasestorage.app",
  messagingSenderId: "192512233766",
  appId: "1:192512233766:web:3205c8107be967244f71e7"
};

// --- ИНИЦИАЛИЗАЦИЯ ---
// Если ключи не вставлены, приложение не запустится
let auth, db;
try {
  // Проверяем, не забыли ли вы заменить заглушку
  if (firebaseConfig.apiKey !== "ВСТАВЬТЕ_СЮДА_ВАШ_API_KEY") {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Ошибка инициализации Firebase:", e);
}

// Уникальный ID сессии голосования
const appId = 'soundpool-online-session-1';

// --- СПИСОК ТРЕКОВ ---
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

const PERSONAS = ['Артур Крылов', 'Артур Евсеенко', 'Егор Кучепатов'];

// --- ГЛАВНЫЙ КОМПОНЕНТ ---
export default function App() {
  const [user, setUser] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Данные из облака
  const [cloudData, setCloudData] = useState({
    votes: {
      "Артур Крылов": [],
      "Артур Евсеенко": [],
      "Егор Кучепатов": []
    }
  });

  // 1. АВТОРИЗАЦИЯ
  useEffect(() => {
    // Проверка, вставил ли пользователь ключи
    if (!auth || firebaseConfig.apiKey === "ВСТАВЬТЕ_СЮДА_ВАШ_API_KEY") {
      setError("Ошибка: Вы не вставили ключи Firebase в файл App.jsx (строки 23-30)");
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setError("Ошибка входа в систему Firebase. Проверьте ключи.");
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. СИНХРОНИЗАЦИЯ С БАЗОЙ
  useEffect(() => {
    if (!user || !db) return;

    // Путь к документу в базе данных
    const docRef = doc(db, 'projects', 'soundpool', 'sessions', appId);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      setIsLoading(false);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCloudData(prev => ({
          ...prev,
          ...data,
          votes: { ...prev.votes, ...(data.votes || {}) }
        }));
      }
    }, (err) => {
      console.error("Snapshot error:", err);
      // Если ошибка прав доступа, пробуем создать документ или сообщаем пользователю
      if (err.code === 'permission-denied') {
         setError("Нет прав доступа. Проверьте Firestore Rules (должно быть allow read, write: if true;)");
      } else {
         setError("Ошибка получения данных.");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. ЛОГИКА ГОЛОСОВАНИЯ
  const handleToggleVote = async (trackId) => {
    if (!user || !selectedPersona) return;

    const currentVotes = cloudData.votes[selectedPersona] || [];
    const isSelected = currentVotes.includes(trackId);
    
    let newVotes;
    if (isSelected) {
      newVotes = currentVotes.filter(id => id !== trackId);
    } else {
      newVotes = [...currentVotes, trackId];
    }

    const docRef = doc(db, 'projects', 'soundpool', 'sessions', appId);
    
    try {
      // merge: true создаст документ и структуру папок, если их нет
      await setDoc(docRef, {
        votes: {
          [selectedPersona]: newVotes
        }
      }, { merge: true });
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка сохранения. Проверьте интернет.");
    }
  };

  // 4. ПОДСЧЕТ ИТОГОВ
  const results = useMemo(() => {
    const counts = {};
    TRACKS.forEach(t => counts[t.id] = 0);

    Object.values(cloudData.votes).forEach(userVotes => {
      if (Array.isArray(userVotes)) {
        userVotes.forEach(id => {
          if (counts[id] !== undefined) {
            counts[id]++;
          }
        });
      }
    });

    return TRACKS
      .map(t => ({ ...t, count: counts[t.id] }))
      .sort((a, b) => b.count - a.count);
  }, [cloudData]);

  // --- РЕНДЕР ---

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-red-500 font-sans text-center">
        <WifiOff size={48} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">Настройка не завершена</h2>
        <p className="text-sm opacity-80 mb-4">{error}</p>
        <div className="bg-zinc-900 p-4 rounded text-left text-xs font-mono text-zinc-400 overflow-auto max-w-full">
            const firebaseConfig = &#123;<br/>
            &nbsp;&nbsp;apiKey: "..."<br/>
            &#125;
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-orange-500">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  // ЭКРАН 1: ВЫБОР ПЕРСОНЫ
  if (!selectedPersona) {
    return (
      <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col justify-center max-w-md mx-auto">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-600 to-red-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-orange-900/50">
            <Music size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">SoundPool Online</h1>
          <p className="text-zinc-500">Выберите себя, чтобы начать</p>
        </div>

        <div className="space-y-3">
          {PERSONAS.map(name => {
            const votesCount = (cloudData.votes[name] || []).length;
            return (
              <button
                key={name}
                onClick={() => setSelectedPersona(name)}
                className="w-full p-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/50 rounded-2xl text-left transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-center relative z-10">
                  <span className="font-bold text-lg group-hover:text-orange-400 transition-colors">{name}</span>
                  {votesCount > 0 && (
                    <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                      {votesCount} выбрано
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ЭКРАН 2: ГОЛОСОВАНИЕ
  const myVotes = cloudData.votes[selectedPersona] || [];
  const totalVotes = Object.values(cloudData.votes).flat().length;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-orange-900/50">
            {selectedPersona.split(' ')[0][0]}
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm">{selectedPersona}</div>
            <div className="text-[10px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> Online
            </div>
          </div>
        </div>
        <button 
          onClick={() => setSelectedPersona(null)}
          className="bg-zinc-900 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Выйти
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full pb-24">
        
        {/* ИНФОБЛОК */}
        <div className="grid grid-cols-3 gap-2 mb-6">
           {PERSONAS.map(p => {
             const count = (cloudData.votes[p] || []).length;
             const isMe = p === selectedPersona;
             return (
               <div key={p} className={`bg-zinc-900/50 rounded-xl p-3 border text-center transition-all ${isMe ? 'border-orange-500/30 bg-orange-500/5' : 'border-zinc-800'}`}>
                 <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 truncate">{p.split(' ')[0]}</div>
                 <div className={`text-xl font-bold ${count > 0 ? 'text-white' : 'text-zinc-700'}`}>{count}</div>
               </div>
             )
           })}
        </div>

        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-orange-500">#</span> Треклист
        </h2>

        {/* СПИСОК */}
        <div className="space-y-2 mb-8">
          {TRACKS.map(track => {
            const isSelected = myVotes.includes(track.id);
            return (
              <button
                key={track.id}
                onClick={() => handleToggleVote(track.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 group ${
                  isSelected 
                    ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/40' 
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all ${
                  isSelected 
                    ? 'border-white bg-white text-orange-600' 
                    : 'border-zinc-700 group-hover:border-zinc-500 bg-transparent'
                }`}>
                  {isSelected && <Check size={16} strokeWidth={4} />}
                </div>
                <span className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                  {track.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* ЖИВЫЕ РЕЗУЛЬТАТЫ */}
        {totalVotes > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
              <Trophy className="text-yellow-500" size={20} />
              Лидеры
            </h3>
            <div className="space-y-4">
              {results.slice(0, 5).map((track, i) => (
                track.count > 0 && (
                  <div key={track.id} className="relative">
                    <div className="flex justify-between text-sm mb-1.5 z-10 relative">
                      <span className={`font-medium ${i === 0 ? 'text-yellow-400' : 'text-zinc-300'}`}>
                        {i + 1}. {track.title}
                      </span>
                      <span className="font-bold">{track.count}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-yellow-500' : 'bg-orange-600'}`}
                        style={{ width: `${(track.count / 3) * 100}%` }}
                      />
                    </div>
                    {/* Аватарки тех, кто проголосовал */}
                    <div className="flex gap-1 mt-1.5">
                      {PERSONAS.map((p, idx) => {
                        if (cloudData.votes[p]?.includes(track.id)) {
                           return (
                             <div key={idx} title={p} className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700">
                               {p.split(' ')[0]}
                             </div>
                           )
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


