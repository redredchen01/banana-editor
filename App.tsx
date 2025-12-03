import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, ImageFile, GenerationResult } from './types';
import { generateWithGemini } from './services/geminiService';
import { UploadIcon, SparklesIcon, PhotoIcon, DownloadIcon, TrashIcon, SettingsIcon, XIcon, CheckCircleIcon, KeyIcon } from './components/Icons';

type TabMode = 'freeform' | 'chibi';

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [sourceImage, setSourceImage] = useState<ImageFile | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<TabMode>('chibi');

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [useProModel, setUseProModel] = useState(false);
  const [apiKeySelected, setApiKeySelected] = useState(false);

  // Freeform state
  const [prompt, setPrompt] = useState<string>('');

  // Chibi Builder state (Defaults localized for Taiwan)
  const [chibiIdentity, setChibiIdentity] = useState('');
  const [chibiFeatures, setChibiFeatures] = useState('');
  const [chibiExpression, setChibiExpression] = useState('嘴角微揚 / 溫柔自信的微笑');
  const [chibiAction, setChibiAction] = useState('站立，稍微面向觀眾，雙手自然垂在身側');
  const [chibiAppearance, setChibiAppearance] = useState('白皙皮膚，金色大眼，長長的銀色波浪捲髮，戴著草帽，上面有淺藍色緞帶和小藍花。');
  const [chibiOutfit, setChibiOutfit] = useState('白色V領細肩帶夏日洋裝，淺藍色扇形裙擺，搭配淺藍色護腕和鞋子。');
  const [chibiStyle, setChibiStyle] = useState('柔和可愛的氛圍，粉嫩色調，柔和均勻的光線，乾淨的白色背景，極簡陰影。');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and Restore Settings
  useEffect(() => {
    const restoreSettings = async () => {
      // 1. Check valid API Key existence in environment
      let hasKey = false;
      if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }

      // 2. Restore user preference from localStorage
      const savedProPref = localStorage.getItem('nanoBanana_usePro') === 'true';
      
      // Only auto-enable Pro if user wanted it AND we actually have a key ready
      if (savedProPref && hasKey) {
        setUseProModel(true);
      } else if (savedProPref && !hasKey) {
        // Preference was true but key is missing (maybe expired), reset preference to avoid confusion
        // or keep it off until they reconnect
        setUseProModel(false); 
      }
    };

    restoreSettings();
  }, []);

  const handleConnectKey = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      
      // Re-check status after dialog closes
      if ((window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
        
        // If successful connection, assume they want to use Pro mode
        if (hasKey) {
          setUseProModel(true);
          localStorage.setItem('nanoBanana_usePro', 'true');
        }
      }
    }
  };

  const toggleProModel = async () => {
    const newValue = !useProModel;
    setUseProModel(newValue);
    
    // Save preference to localStorage
    localStorage.setItem('nanoBanana_usePro', String(newValue));
    
    if (newValue) {
       // If turning ON, check if key is needed
       const hasKey = await (window as any).aistudio.hasSelectedApiKey();
       if (!hasKey) {
         await handleConnectKey();
       }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64Raw = dataUrl.split(',')[1];
      
      setSourceImage({
        file,
        previewUrl: dataUrl,
        base64Data: base64Raw,
        mimeType: file.type,
      });
      setResult(null);
      setErrorMessage(null);
      setStatus(AppStatus.IDLE);
    };
    reader.readAsDataURL(file);
  };

  const constructChibiPrompt = () => {
    // Framework construction with Chinese inputs injected
    return `
A chibi-style illustration of a young female character, 2–2.5 heads tall.
Pose: ${chibiAction}.
Expression: ${chibiExpression}.

Appearance: ${chibiAppearance}
Outfit: ${chibiOutfit}

${chibiIdentity ? `Character Identity: ${chibiIdentity}` : ''}
${chibiFeatures ? `Unique Features: ${chibiFeatures}` : ''}
${chibiStyle}
    `.trim();
  };

  const handleGenerate = async () => {
    const finalPrompt = mode === 'freeform' ? prompt : constructChibiPrompt();

    if (!finalPrompt.trim()) {
      setErrorMessage("請輸入描述或填寫角色參數。");
      return;
    }

    setStatus(AppStatus.LOADING);
    setErrorMessage(null);

    try {
      // If no image is provided, it will perform text-to-image generation
      // Pass useProModel flag to service
      const genResult = await generateWithGemini(finalPrompt, sourceImage, useProModel);
      setResult(genResult);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      
      // Handle missing API Key error specifically
      const errString = err.toString();
      if (errString.includes("Requested entity was not found") || errString.includes("404") || errString.includes("403")) {
         setErrorMessage("API Key 驗證失敗或無效。請在設定中重新連結您的 API Key。");
         setApiKeySelected(false); // Reset status to force user to re-select
         // Optionally open settings automatically
         setIsSettingsOpen(true);
      } else {
         setErrorMessage(err.message || "生成過程中發生錯誤。");
      }
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setResult(null);
    setStatus(AppStatus.IDLE);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = () => {
    if (result?.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `nano-banana-gen-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-gray-900 transition-colors ${useProModel ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-banana-400 to-orange-600'}`}>
              <SparklesIcon />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Nano Banana
              </h1>
              {useProModel && <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-none">Pro Enabled</span>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 hidden sm:block">
              {useProModel ? 'Gemini 3 Pro Image (High Quality)' : 'Gemini 2.5 Flash Image'}
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="設定"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 relative">
        <div className="grid lg:grid-cols-12 gap-8 h-full">
          
          {/* LEFT COLUMN: Controls & Input */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* 1. Image Upload Section (Optional) */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold">1</span>
                  參考底圖 <span className="text-gray-500 text-xs font-normal ml-2">(選填)</span>
                </h2>
                {sourceImage && (
                  <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                    <TrashIcon /> 移除圖片
                  </button>
                )}
              </div>

              {!sourceImage ? (
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-xl cursor-pointer bg-gray-700/30 hover:bg-gray-700/50 hover:border-blue-500 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                      <div className="group-hover:scale-110 transition-transform duration-200">
                        <UploadIcon />
                      </div>
                      <p className="text-sm text-gray-400 group-hover:text-blue-400"><span className="font-semibold">上傳圖片以進行編輯</span></p>
                      <p className="text-xs text-gray-500">或留空直接生成新角色</p>
                    </div>
                    <input 
                      id="dropzone-file" 
                      type="file" 
                      className="hidden" 
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                    />
                  </label>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-gray-600 bg-black/50 aspect-video flex items-center justify-center">
                  <img 
                    src={sourceImage.previewUrl} 
                    alt="Source" 
                    className="max-h-64 object-contain w-full h-full"
                  />
                </div>
              )}
            </div>

            {/* 2. Prompt Builder Section */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-1 shadow-xl backdrop-blur-sm flex-1 flex flex-col overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-700 bg-gray-900/50">
                <button
                  onClick={() => setMode('chibi')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === 'chibi' 
                      ? 'text-banana-400 border-b-2 border-banana-400 bg-gray-800/50' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                  }`}
                >
                  Q版角色生成器
                </button>
                <button
                  onClick={() => setMode('freeform')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mode === 'freeform' 
                      ? 'text-banana-400 border-b-2 border-banana-400 bg-gray-800/50' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                  }`}
                >
                  自由輸入模式
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 text-xs font-bold">2</span>
                  設定角色參數
                </h2>

                {mode === 'freeform' ? (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述您想要生成的內容，或是如何修改上傳的圖片..."
                    className="w-full h-full min-h-[200px] bg-gray-900/50 border border-gray-600 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-banana-500 focus:border-transparent transition-all resize-none"
                    disabled={status === AppStatus.LOADING}
                  />
                ) : (
                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    
                    {/* Identity & Features Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-400 uppercase">角色身分 (Identity)</label>
                        <input 
                          type="text" 
                          value={chibiIdentity}
                          onChange={(e) => setChibiIdentity(e.target.value)}
                          placeholder="例如：精靈、海盜"
                          className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-400 uppercase">特殊特徵 (Features)</label>
                        <input 
                          type="text" 
                          value={chibiFeatures}
                          onChange={(e) => setChibiFeatures(e.target.value)}
                          placeholder="例如：貓耳、異色瞳"
                          className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Expression & Action Row */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-400 uppercase">表情與態度 (Expression)</label>
                        <input 
                          type="text" 
                          value={chibiExpression}
                          onChange={(e) => setChibiExpression(e.target.value)}
                          className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-400 uppercase">姿勢與動作 (Pose)</label>
                        <input 
                          type="text" 
                          value={chibiAction}
                          onChange={(e) => setChibiAction(e.target.value)}
                          className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Appearance Textarea */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-400 uppercase">外貌細節 (Appearance)</label>
                      <textarea 
                        value={chibiAppearance}
                        onChange={(e) => setChibiAppearance(e.target.value)}
                        rows={3}
                        className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Outfit Textarea */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-400 uppercase">服裝穿搭 (Outfit)</label>
                      <textarea 
                        value={chibiOutfit}
                        onChange={(e) => setChibiOutfit(e.target.value)}
                        rows={3}
                        className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Style/Atmosphere */}
                    <div className="flex flex-col gap-1">
                       <label className="text-xs font-medium text-gray-400 uppercase">風格與氛圍 (Style)</label>
                       <input 
                          type="text" 
                          value={chibiStyle}
                          onChange={(e) => setChibiStyle(e.target.value)}
                          className="bg-gray-900/50 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-banana-400 focus:outline-none"
                        />
                    </div>
                  </div>
                )}
                
                {errorMessage && (
                  <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded-lg animate-pulse">
                    ⚠️ {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={status === AppStatus.LOADING}
                  className={`
                    w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 mt-2
                    ${status === AppStatus.LOADING
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : useProModel 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/20'
                        : 'bg-gradient-to-r from-banana-500 to-orange-600 hover:from-banana-400 hover:to-orange-500 shadow-orange-500/20'
                    }
                  `}
                >
                  {status === AppStatus.LOADING ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      製作中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon /> {sourceImage ? '開始轉換圖片' : '生成角色'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Output */}
          <div className="lg:col-span-7 bg-gray-900/50 border border-gray-800 rounded-3xl p-1 shadow-inner relative overflow-hidden min-h-[500px] flex flex-col">
            
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-gray-900/80 to-transparent z-10 pointer-events-none"></div>

            <div className="flex-1 flex items-center justify-center p-6 relative">
              {status === AppStatus.IDLE && !result && (
                <div className="text-center text-gray-600 flex flex-col items-center">
                  <PhotoIcon />
                  <p className="mt-4 text-sm">您的作品將顯示於此</p>
                </div>
              )}

              {status === AppStatus.LOADING && (
                <div className="flex flex-col items-center justify-center z-20">
                   <div className="relative w-24 h-24 mb-6">
                      <div className={`absolute inset-0 border-4 rounded-full animate-pulse ${useProModel ? 'border-purple-500/30' : 'border-banana-500/30'}`}></div>
                      <div className={`absolute inset-0 border-t-4 rounded-full animate-spin ${useProModel ? 'border-purple-400' : 'border-banana-400'}`}></div>
                   </div>
                   <p className={`${useProModel ? 'text-purple-200' : 'text-banana-200'} font-medium animate-pulse`}>
                     {useProModel ? 'Gemini 3 Pro 正在精心繪製...' : 'Gemini 正在繪製您的角色...'}
                   </p>
                </div>
              )}

              {result && status !== AppStatus.LOADING && (
                <div className="w-full h-full flex flex-col gap-4 animate-[fadeIn_0.5s_ease-out]">
                  {result.imageUrl ? (
                    <div className="relative flex-1 rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center group">
                      <img 
                        src={result.imageUrl} 
                        alt="Generated" 
                        className="w-full h-full object-contain max-h-[70vh]"
                      />
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={handleDownload}
                           className="bg-black/60 backdrop-blur text-white p-3 rounded-full hover:bg-black/80 transition-colors"
                           title="下載圖片"
                         >
                            <DownloadIcon />
                         </button>
                      </div>
                      {useProModel && (
                        <div className="absolute bottom-4 right-4 bg-purple-900/80 text-purple-100 text-[10px] px-2 py-1 rounded backdrop-blur border border-purple-500/30">
                          PRO QUALITY
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-2xl border border-gray-700 p-8 text-center text-gray-400 italic">
                      未生成圖片，但模型回傳了文字訊息。
                    </div>
                  )}

                  {result.textResponse && (
                    <div className="bg-gray-800/80 backdrop-blur border border-gray-700 p-4 rounded-xl text-sm text-gray-300">
                      <span className="text-banana-400 font-bold text-xs uppercase tracking-wider mb-1 block">Gemini 回應</span>
                      {result.textResponse}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-3xl animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <XIcon />
              </button>
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <SettingsIcon /> 設定
              </h2>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">Banana Pro 高畫質模式</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        使用 Gemini 3 Pro 進行更精細的繪圖。
                      </p>
                    </div>
                    <button 
                      onClick={toggleProModel}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useProModel ? 'bg-purple-600' : 'bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useProModel ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  {useProModel && (
                    <div className="bg-purple-900/20 border border-purple-800/50 rounded-xl p-4">
                       <h4 className="text-sm font-medium text-purple-300 mb-2 flex items-center gap-2">
                         <KeyIcon /> API Key 連結狀態
                       </h4>
                       <div className="flex items-center justify-between mt-3">
                         <div className="flex items-center gap-2">
                           {apiKeySelected ? (
                             <>
                               <span className="text-green-400"><CheckCircleIcon /></span>
                               <span className="text-sm text-gray-300">已連結付費 Key</span>
                             </>
                           ) : (
                             <span className="text-sm text-gray-400">尚未連結</span>
                           )}
                         </div>
                         <button 
                           onClick={handleConnectKey}
                           className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-lg transition-colors text-white"
                         >
                           {apiKeySelected ? '更換 Key' : '連結 Key'}
                         </button>
                       </div>
                       <p className="text-[10px] text-gray-500 mt-3">
                         您的 Key 會自動安全地儲存在此瀏覽器環境中。下次開啟時會自動恢復 Pro 模式。
                         <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline ml-1">
                           了解計費詳情
                         </a>
                       </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;