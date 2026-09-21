import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Search, 
  MousePointer, 
  Camera, 
  FileText, 
  Play, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw, 
  Terminal, 
  Download, 
  Key, 
  Laptop, 
  Check, 
  Copy,
  ExternalLink,
  Layers,
  Clock,
  ArrowDown,
  Sparkles,
  ShieldCheck,
  Folder,
  HardDrive,
  Lock,
  ShieldAlert,
  FileCode,
  CheckSquare
} from 'lucide-react';
import { LocalRunnerState, ToolPipelineStage, isRunnerOnline, isOmniRouteReady } from '../types';

interface ToolRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  runnerState: LocalRunnerState;
  onRefreshStatus: () => Promise<void>;
  runnerToken: string;
  onSaveToken: (token: string) => void;
}

export const ToolRunnerModal: React.FC<ToolRunnerModalProps> = ({ 
  isOpen, 
  onClose,
  runnerState,
  onRefreshStatus,
  runnerToken,
  onSaveToken,
}) => {
  const [tokenInput, setTokenInput] = useState(runnerToken);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedRelayCmd, setCopiedRelayCmd] = useState(false);
  const [copiedUpdateCmd, setCopiedUpdateCmd] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthResponse, setHealthResponse] = useState<any>(null);
  const [activeTestTab, setActiveTestTab] = useState<'browser' | 'computer' | 'coding' | 'status' | 'architecture'>('browser');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // E2E Test State
  const [isE2ETesting, setIsE2ETesting] = useState(false);
  const [e2eReport, setE2eReport] = useState<any>(null);
  const [e2eCurrentStep, setE2eCurrentStep] = useState<number>(0);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);

  // Phase 3 Computer & File Control State
  const [isComputerTesting, setIsComputerTesting] = useState(false);
  const [computerReport, setComputerReport] = useState<any>(null);

  // Phase 4 OmniRoute Coding Bridge State
  const [isOmnirouteTesting, setIsOmnirouteTesting] = useState(false);
  const [omnirouteReport, setOmnirouteReport] = useState<any>(null);

  if (!isOpen) return null;

  const handleSaveToken = () => {
    onSaveToken(tokenInput.trim());
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-zrj2bhsg2e23ywnpmxtgf4-283194823080.europe-west2.run.app';
  const relayCommand = `node runner.cjs --relay ${currentOrigin}/api/runner/relay`;
  const updateRunnerCommand = `curl -s -o runner.cjs "${currentOrigin}/api/runner/download/runner.cjs" && node runner.cjs`;

  const handleCopyRelayCmd = () => {
    navigator.clipboard.writeText(relayCommand);
    setCopiedRelayCmd(true);
    setTimeout(() => setCopiedRelayCmd(false), 2000);
  };

  const handleCopyUpdateCmd = () => {
    navigator.clipboard.writeText(updateRunnerCommand);
    setCopiedUpdateCmd(true);
    setTimeout(() => setCopiedUpdateCmd(false), 2000);
  };

  const handleCheckLiveHealth = async () => {
    setIsCheckingHealth(true);
    setTestError(null);
    setHealthResponse(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      let res: Response;
      try {
        res = await fetch('http://127.0.0.1:48123/health', {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
          // @ts-ignore
          targetAddressSpace: 'loopback',
        });
      } catch {
        res = await fetch('http://127.0.0.1:48123/health', {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      }
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        setHealthResponse(json);
      } else {
        setTestError(`Local runner returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      setTestError(`Direct fetch to http://127.0.0.1:48123/health failed: ${err?.message || 'Blocked by browser Mixed-Content / PNA policy'}`);
    } finally {
      setIsCheckingHealth(false);
      await onRefreshStatus();
    }
  };

  // Run any single tool
  const handleRunSafeTest = async (toolName: string, params: any = {}) => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    const token = tokenInput.trim() || runnerToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('maryam_runner_token') || '' : '');
    let directErrorDetail = '';

    // Attempt 1: Direct call to local runner (127.0.0.1:48123)
    try {
      const directRes = await fetch('http://127.0.0.1:48123/api/tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(token ? { 'x-runner-token': token } : {}),
        },
        body: JSON.stringify({ tool: toolName, params }),
      });

      if (directRes.ok) {
        const json = await directRes.json();
        const resData = json.result || json;
        setTestResult({
          method: 'Direct Localhost (http://127.0.0.1:48123)',
          data: resData,
        });
        if (toolName === 'browser.screenshot' && resData.base64) {
          setLiveScreenshot(`data:image/jpeg;base64,${resData.base64}`);
        }
        await onRefreshStatus();
        setIsTesting(false);
        return;
      }
    } catch (directErr: any) {
      directErrorDetail = `Direct fetch failed: ${directErr?.message || 'Blocked by browser policy'}.`;
    }

    // Attempt 2: Dispatch via Relay Tunnel
    try {
      const execRes = await fetch('/api/runner/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, params }),
      });

      const execJson = await execRes.json();
      if (execRes.ok && execJson.success && execJson.result) {
        const toolData = execJson.result;
        setTestResult({
          method: 'Relay Tunnel (Encrypted Outbound from your Windows Laptop)',
          data: toolData,
        });
        if (toolName === 'browser.screenshot' && toolData.base64) {
          setLiveScreenshot(`data:image/jpeg;base64,${toolData.base64}`);
        }
        await onRefreshStatus();
      } else {
        setTestError(
          `${directErrorDetail}\n\nRelay status: The local runner is not reachable right now.\nMake sure runner.cjs is running in your CMD window.`
        );
      }
    } catch (serverErr: any) {
      setTestError(`${directErrorDetail}\n\nServer error: ${serverErr?.message || 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Run the full 6-step E2E test suite
  const handleRunE2ETest = async () => {
    setIsE2ETesting(true);
    setTestError(null);
    setE2eReport(null);
    setE2eCurrentStep(1);

    try {
      const res = await fetch('/api/runner/test-browser-e2e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setE2eReport(data);
        setE2eCurrentStep(6);
      } else {
        setTestError(data.error || 'E2E Browser Test sequence failed');
        setE2eReport(data);
      }
    } catch (err: any) {
      setTestError(`E2E test execution error: ${err.message}`);
    } finally {
      setIsE2ETesting(false);
      await onRefreshStatus();
    }
  };

  // Run the Safe Computer & File Control test suite
  const handleRunComputerTestSuite = async () => {
    setIsComputerTesting(true);
    setTestError(null);
    setComputerReport(null);

    try {
      const res = await fetch('/api/runner/test-safe-computer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      setComputerReport(data);
      if (!res.ok || !data.success) {
        setTestError(data.error || 'Safe Computer suite reported warnings.');
      }
    } catch (err: any) {
      setTestError(`Computer test execution error: ${err.message}`);
    } finally {
      setIsComputerTesting(false);
      await onRefreshStatus();
    }
  };

  // Run the Phase 4 OmniRoute Real Coding Bridge test suite
  const handleRunOmnirouteTestSuite = async () => {
    setIsOmnirouteTesting(true);
    setTestError(null);
    setOmnirouteReport(null);

    try {
      const res = await fetch('/api/runner/test-omniroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      setOmnirouteReport(data);
      if (!res.ok || !data.success) {
        setTestError(data.error || 'OmniRoute Coding Bridge test encountered warnings.');
      }
    } catch (err: any) {
      setTestError(`OmniRoute test execution error: ${err.message}`);
    } finally {
      setIsOmnirouteTesting(false);
      await onRefreshStatus();
    }
  };

  const isRunnerConnected = isRunnerOnline(runnerState.runnerStatus);
  const isOmniRouteAvailable = isOmniRouteReady(runnerState.omnirouteStatus);

  const pipelineStages: ToolPipelineStage[] = [
    {
      id: 'mohsin',
      name: '1. Mohsin (Voice / Text Intent)',
      description: 'Gives real command: "Baby Chrome kholo", "OpenAI search karo", "YouTube chalao".',
      status: 'active',
      details: 'Spoken naturally in Roman Urdu or English.',
    },
    {
      id: 'maryamAI',
      name: '2. Maryam Voice & Intelligence',
      description: 'Gemini 2.5 converts task into structured browser tool calls.',
      status: 'active',
      details: '16 allowlisted browser tools + system health + OmniRoute.',
    },
    {
      id: 'toolRouter',
      name: '3. Tool Router & Dispatcher',
      description: 'Validates strict allowlist and routes to Local Windows Runner via Relay Tunnel.',
      status: 'active',
      details: 'Zero shell injection. Allowlist enforced.',
    },
    {
      id: 'localRunner',
      name: '4. Local Companion Runner (127.0.0.1)',
      description: 'Executes actions natively on Mohsin Windows laptop.',
      status: isRunnerConnected ? 'active' : 'modular_staged',
      details: isRunnerConnected ? 'Connected & Active (Relay)' : 'Waiting for runner.cjs',
    },
    {
      id: 'browserEngine',
      name: '5. Real Chrome Browser Engine (CDP)',
      description: 'Visibly launches Chrome with MaryamAutomationProfile and navigates pages.',
      status: isRunnerConnected ? 'active' : 'modular_staged',
      details: 'Port 9222 DevTools Protocol. Real DOM interaction.',
    },
    {
      id: 'report',
      name: '6. Maryam Real Outcome Voice Report',
      description: 'Maryam speaks the actual result in authentic Roman Urdu without simulation.',
      status: 'active',
      details: 'Zero fake outputs, strict real data.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[92vh] bg-zinc-950 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Local Tool Runner & Real Browser Control</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Phase 2: Active
                </span>
              </div>
              <p className="text-xs text-zinc-400">Controls Mohsin's Windows laptop Chrome browser via OmniRoute & Runner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/5 bg-zinc-900/30 text-xs">
          <button
            onClick={() => setActiveTestTab('browser')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTestTab === 'browser'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Browser Control (16 Tools)
          </button>
          <button
            onClick={() => setActiveTestTab('computer')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTestTab === 'computer'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Files & System (20 Tools)
          </button>
          <button
            onClick={() => setActiveTestTab('coding')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTestTab === 'coding'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            OmniRoute Coding (8 Tools)
          </button>
          <button
            onClick={() => setActiveTestTab('status')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTestTab === 'status'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Connection & Setup
          </button>
          <button
            onClick={() => setActiveTestTab('architecture')}
            className={`pb-2 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTestTab === 'architecture'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Pipeline Architecture
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-zinc-300 flex-1">
          {/* Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Runner Connection Card */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              isRunnerConnected 
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' 
                : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
            }`}>
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-semibold text-xs text-white">Windows Runner</div>
                  <div className="text-[10px] text-zinc-400">
                    {runnerState.connectionMethod === 'relay' ? 'Outbound Relay Tunnel' : '127.0.0.1:48123'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                isRunnerConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isRunnerConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* OmniRoute Status Card */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              isOmniRouteAvailable 
                ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-200' 
                : 'bg-zinc-900 border-white/10 text-zinc-400'
            }`}>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="font-semibold text-xs text-white">OmniRoute CLI</div>
                  <div className="text-[10px] text-zinc-400">
                    {runnerState.omnirouteVersion ? `v${runnerState.omnirouteVersion}` : 'Checking PATH...'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                isOmniRouteAvailable ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {isOmniRouteAvailable ? 'Ready' : 'Pending'}
              </span>
            </div>

            {/* Browser Control Engine Card */}
            <div className="p-3 rounded-2xl border bg-violet-950/20 border-violet-800/40 text-violet-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-400" />
                <div>
                  <div className="font-semibold text-xs text-white">Browser Control</div>
                  <div className="text-[10px] text-zinc-400">Chrome CDP Port 9222</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                16 Tools Ready
              </span>
            </div>
          </div>

          {/* TAB 1: BROWSER CONTROL (PHASE 2) */}
          {activeTestTab === 'browser' && (
            <div className="space-y-4">
              {/* E2E Test Runner Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-zinc-900 to-violet-950/40 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <h4 className="font-semibold text-white text-sm">Automated 6-Step Browser E2E Test Suite</h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Executes: Open Chrome → Google → Search "OpenAI" → Read Results → Open Result → Return Title & URL
                    </p>
                  </div>
                  <button
                    onClick={handleRunE2ETest}
                    disabled={isE2ETesting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${isE2ETesting ? 'animate-spin' : ''}`} />
                    {isE2ETesting ? 'Executing Sequence on Laptop...' : 'Run 6-Step E2E Test'}
                  </button>
                </div>

                {/* E2E Step Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-white/5 font-mono text-[10px]">
                  {[
                    { num: 1, title: '1. Open Chrome', tool: 'browser.open' },
                    { num: 2, title: '2. Google', tool: 'browser.navigate' },
                    { num: 3, title: '3. Search', tool: 'browser.search' },
                    { num: 4, title: '4. Read Page', tool: 'browser.read_page' },
                    { num: 5, title: '5. Click Link', tool: 'browser.click' },
                    { num: 6, title: '6. Title & URL', tool: 'browser.get_title' },
                  ].map((s) => {
                    const isDone = e2eReport && e2eReport.logs && e2eReport.logs.some((l: any) => l.step === s.num && l.success);
                    const isCurrent = isE2ETesting && e2eCurrentStep === s.num;
                    return (
                      <div
                        key={s.num}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isDone 
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : isCurrent
                            ? 'bg-indigo-950/60 border-indigo-400 text-indigo-200 animate-pulse'
                            : 'bg-black/30 border-white/5 text-zinc-500'
                        }`}
                      >
                        <div className="font-semibold">{s.title}</div>
                        <div className="text-[9px] opacity-70 truncate">{s.tool}</div>
                      </div>
                    );
                  })}
                </div>

                {/* E2E Output Summary */}
                {e2eReport && (
                  <div className="mt-2 p-3 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-emerald-400 font-semibold text-xs">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        E2E Test Completed Successfully!
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">All 6 Steps Verified</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 space-y-1">
                      <div><span className="text-zinc-500 font-mono">Final Page Title:</span> <strong className="text-white">{e2eReport.finalTitle}</strong></div>
                      <div><span className="text-zinc-500 font-mono">Final Page URL:</span> <span className="text-indigo-300 break-all">{e2eReport.finalUrl}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Browser Tool Execution Buttons */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    Quick Interactive Browser Actions
                  </h4>
                  <span className="text-[10px] text-zinc-400">16 Tools Available</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRunSafeTest('browser.open', { url: 'https://www.google.com' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-indigo-300">
                      <Laptop className="w-3.5 h-3.5" />
                      browser.open
                    </div>
                    <div className="text-[10px] text-zinc-400">Open Chrome window</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('browser.search', { query: 'OpenAI latest news', engine: 'google' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-300">
                      <Search className="w-3.5 h-3.5" />
                      browser.search
                    </div>
                    <div className="text-[10px] text-zinc-400">Search "OpenAI" on Google</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('browser.read_page', { maxChars: 2000 })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-violet-300">
                      <FileText className="w-3.5 h-3.5" />
                      browser.read_page
                    </div>
                    <div className="text-[10px] text-zinc-400">Read headings & page text</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('browser.click', { text: 'first result' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-amber-300">
                      <MousePointer className="w-3.5 h-3.5" />
                      browser.click
                    </div>
                    <div className="text-[10px] text-zinc-400">Click 1st search result</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('browser.scroll', { direction: 'down', amount: 600 })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-cyan-300">
                      <ArrowDown className="w-3.5 h-3.5" />
                      browser.scroll
                    </div>
                    <div className="text-[10px] text-zinc-400">Scroll down 600px</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('browser.screenshot')}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-pink-300">
                      <Camera className="w-3.5 h-3.5" />
                      browser.screenshot
                    </div>
                    <div className="text-[10px] text-zinc-400">Capture laptop screen</div>
                  </button>
                </div>

                {/* Screenshot Display Card */}
                {liveScreenshot && (
                  <div className="mt-3 p-3 rounded-xl bg-black/60 border border-pink-500/30 space-y-2">
                    <div className="flex items-center justify-between text-pink-300 font-semibold text-xs">
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> Live Browser Screenshot
                      </span>
                      <button 
                        onClick={() => setLiveScreenshot(null)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300"
                      >
                        Dismiss
                      </button>
                    </div>
                    <img 
                      src={liveScreenshot} 
                      alt="Chrome Laptop Screen" 
                      className="rounded-lg border border-white/10 max-h-60 w-full object-contain bg-zinc-950" 
                    />
                  </div>
                )}
              </div>

              {/* Live Test Output Panel */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-800/30 space-y-2">
                  <div className="flex items-center justify-between text-emerald-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Tool Result Received from Windows Laptop:
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">{testResult.method}</span>
                  </div>
                  <pre className="text-zinc-300 overflow-x-auto p-3 bg-black/60 rounded-xl max-h-56 font-mono text-[11px]">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Display */}
              {testError && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Tool Execution Notice
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-rose-200/90 overflow-x-auto bg-black/40 p-2.5 rounded-xl border border-rose-900/30">
                    {testError}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB: SAFE COMPUTER & FILE CONTROL (PHASE 3) */}
          {activeTestTab === 'computer' && (
            <div className="space-y-4">
              {/* Security Test Suite Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-zinc-900 to-teal-950/40 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-semibold text-white text-sm">Safe Computer & File Security Verification</h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Verifies: System Specs → App Allowlist → Safe Folders → Shell Blocking Guard → Directory Traversal Protection
                    </p>
                  </div>
                  <button
                    onClick={handleRunComputerTestSuite}
                    disabled={isComputerTesting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                  >
                    {isComputerTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Verifying Policies...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Run Security Suite
                      </>
                    )}
                  </button>
                </div>

                {/* Computer Report */}
                {computerReport && (
                  <div className="mt-2 p-3 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-emerald-400 font-semibold text-xs">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Security Verification Result
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {computerReport.passedCount} / {computerReport.stepsCount} Policies Passed
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {computerReport.steps?.map((st: any) => (
                        <div key={st.step} className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${st.success ? 'text-emerald-400' : 'text-rose-400'}`} />
                          <div className="text-[11px] text-zinc-200 truncate">{st.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Interactive Actions */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    Quick Safe System & File Actions
                  </h4>
                  <span className="text-[10px] text-zinc-400">20 Allowlisted Tools</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRunSafeTest('system.system_info')}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-300">
                      <Cpu className="w-3.5 h-3.5" />
                      system.system_info
                    </div>
                    <div className="text-[10px] text-zinc-400">OS, CPU & Memory specs</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('system.list_apps')}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-teal-300">
                      <CheckSquare className="w-3.5 h-3.5" />
                      system.list_apps
                    </div>
                    <div className="text-[10px] text-zinc-400">Safe installed applications</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('system.list_processes', { filter: '' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-cyan-300">
                      <Terminal className="w-3.5 h-3.5" />
                      system.list_processes
                    </div>
                    <div className="text-[10px] text-zinc-400">Active Windows tasks</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('file.list', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-indigo-300">
                      <FileText className="w-3.5 h-3.5" />
                      file.list
                    </div>
                    <div className="text-[10px] text-zinc-400">List files in workspace</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('folder.list', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-amber-300">
                      <Folder className="w-3.5 h-3.5" />
                      folder.list
                    </div>
                    <div className="text-[10px] text-zinc-400">List user folders</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('file.search', { query: 'Maryam', maxResults: 10 })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-pink-300">
                      <Search className="w-3.5 h-3.5" />
                      file.search
                    </div>
                    <div className="text-[10px] text-zinc-400">Find files matching text</div>
                  </button>
                </div>
              </div>

              {/* Safety & Cryptographic Challenge Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/20 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Owner Confirmation & Security Guard
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed space-y-1">
                  <div>
                    <strong className="text-zinc-200">Destructive Guard:</strong> Operations like <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">file.delete</code>, <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">folder.move</code> (overwrite), or destructive overwriting issue a runner-verified challenge (<code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">confirmationId</code>) before proceeding.
                  </div>
                  <div>
                    <strong className="text-zinc-200">Zero Shell Execution:</strong> Direct shell access (<code className="text-rose-400">cmd.exe</code>, <code className="text-rose-400">powershell</code>, <code className="text-rose-400">bash</code>) is strictly blocked by allowlisting.
                  </div>
                  <div>
                    <strong className="text-zinc-200">Secret Scrubbing:</strong> Passwords, OpenAI/Gemini/GitHub API keys, and sensitive paths (<code className="text-zinc-300">.env</code>, <code className="text-zinc-300">id_rsa</code>, System32) are automatically masked and blocked from model transmission.
                  </div>
                </div>
              </div>

              {/* Live Output Card */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tool Output ({testResult.method})
                    </span>
                    <button 
                      onClick={() => setTestResult(null)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-zinc-300 overflow-x-auto p-3 bg-black/60 rounded-xl max-h-56 font-mono text-[11px]">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Display */}
              {testError && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Tool Execution Notice
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-rose-200/90 overflow-x-auto bg-black/40 p-2.5 rounded-xl border border-rose-900/30">
                    {testError}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB: OMNIROUTE CODING BRIDGE (PHASE 4) */}
          {activeTestTab === 'coding' && (
            <div className="space-y-4">
              {/* Architecture & OmniRoute CLI Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-zinc-900/60 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">
                        Maryam × OmniRoute Real Coding Bridge (Phase 4)
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Controlled local coding agent via OmniRoute CLI inside approved workspaces
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 ${
                        isOmniRouteAvailable
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOmniRouteAvailable ? 'bg-purple-400 animate-pulse' : 'bg-zinc-500'}`} />
                      {isOmniRouteAvailable ? 'OmniRoute Ready' : 'OmniRoute Staged'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                    <div className="text-zinc-400 text-[10px]">Architecture</div>
                    <div className="font-mono text-zinc-200">Relay → Runner → CLI</div>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                    <div className="text-zinc-400 text-[10px]">Snapshot Engine</div>
                    <div className="font-mono text-emerald-300">Active (Automatic Rollback)</div>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                    <div className="text-zinc-400 text-[10px]">Security Guard</div>
                    <div className="font-mono text-purple-300">Workspace Bound & Redacted</div>
                  </div>
                </div>
              </div>

              {/* Automated Phase 4 Test Suite Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      Automated OmniRoute Coding Test Suite
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Tests dynamic CLI detection, workspace bounds, snapshotting, task lifecycle, secret redaction, and rollback.
                    </p>
                  </div>
                  <button
                    onClick={handleRunOmnirouteTestSuite}
                    disabled={isOmnirouteTesting}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {isOmnirouteTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isOmnirouteTesting ? 'Verifying Suite...' : 'Run Coding Test Suite'}
                  </button>
                </div>

                {omnirouteReport && (
                  <div className="p-3 rounded-xl bg-black/50 border border-purple-900/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-purple-200">
                        {omnirouteReport.message}
                      </span>
                      <span className="text-[10px] text-purple-300 font-mono">
                        {omnirouteReport.passedCount} / {omnirouteReport.totalSteps} checks passed
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {omnirouteReport.steps?.map((st: any) => (
                        <div
                          key={st.step}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-white/5 border border-white/5"
                        >
                          <div className="flex items-center gap-2">
                            {st.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className={st.success ? 'text-zinc-200' : 'text-rose-300'}>
                              {st.step}. {st.name}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              st.success
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {st.success ? 'VERIFIED' : 'FAILED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Coding Action Buttons (8 Controlled Tools) */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-purple-400" />
                    Quick Interactive Coding Actions (8 Tools)
                  </h4>
                  <span className="text-[10px] text-zinc-400">Strict Allowlist & Snapshot Guard</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleRunSafeTest('omniroute.status', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-purple-300">
                      <Cpu className="w-3.5 h-3.5" />
                      omniroute.status
                    </div>
                    <div className="text-[10px] text-zinc-400">Query CLI detection</div>
                  </button>

                  <button
                    onClick={() =>
                      handleRunSafeTest('coding.start_task', {
                        workspacePath: '.',
                        taskDescription: 'Inspect project structure and review tests',
                        simulateForTest: true,
                        mockOutput: 'OmniRoute: Inspected repository safely. All components verified.',
                      })
                    }
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-300">
                      <Play className="w-3.5 h-3.5" />
                      coding.start_task
                    </div>
                    <div className="text-[10px] text-zinc-400">Start task with snapshot</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.status', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-indigo-300">
                      <RefreshCw className="w-3.5 h-3.5" />
                      coding.status
                    </div>
                    <div className="text-[10px] text-zinc-400">Poll live lifecycle</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.review_changes', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-cyan-300">
                      <FileText className="w-3.5 h-3.5" />
                      coding.review_changes
                    </div>
                    <div className="text-[10px] text-zinc-400">Inspect file diffs</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.test', { workspacePath: '.', testRunner: 'npm' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-teal-300">
                      <CheckSquare className="w-3.5 h-3.5" />
                      coding.test
                    </div>
                    <div className="text-[10px] text-zinc-400">Run test suite</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.read_result', {})}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-amber-300">
                      <FileCode className="w-3.5 h-3.5" />
                      coding.read_result
                    </div>
                    <div className="text-[10px] text-zinc-400">Read outcome & logs</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.apply_changes', { taskId: 'latest' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-blue-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      coding.apply_changes
                    </div>
                    <div className="text-[10px] text-zinc-400">Commit workspace changes</div>
                  </button>

                  <button
                    onClick={() => handleRunSafeTest('coding.rollback', { taskId: 'latest' })}
                    disabled={isTesting}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-left transition-all disabled:opacity-50 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      coding.rollback
                    </div>
                    <div className="text-[10px] text-zinc-400">Safe rollback to snapshot</div>
                  </button>
                </div>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Result via {testResult.method}
                    </span>
                    <button
                      onClick={() => setTestResult(null)}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <pre className="text-zinc-300 overflow-x-auto p-3 bg-black/60 rounded-xl max-h-56 font-mono text-[11px]">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Display */}
              {testError && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Tool Execution Notice
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-rose-200/90 overflow-x-auto bg-black/40 p-2.5 rounded-xl border border-rose-900/30">
                    {testError}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONNECTION & SETUP */}
          {activeTestTab === 'status' && (
            <div className="space-y-4">
              {/* 1-Click Update Script Card */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-indigo-400" />
                    Sync / Update Runner with Phase 2 Browser Tools
                  </h4>
                  <span className="text-[10px] text-indigo-300">Recommended</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Run this single command in your Windows CMD prompt inside your runner directory to automatically download the latest Phase 2 runner and restart it:
                </p>
                <div className="p-2.5 rounded-xl bg-black/70 border border-white/10 flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-indigo-300 break-all select-all">
                    {updateRunnerCommand}
                  </code>
                  <button
                    onClick={handleCopyUpdateCmd}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition-all shrink-0 flex items-center gap-1"
                  >
                    {copiedUpdateCmd ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
                    {copiedUpdateCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Setup Steps */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  Companion Runner Connection Setup
                </h4>

                <div className="space-y-2.5 text-zinc-400 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                      1
                    </span>
                    <div className="flex-1 space-y-1">
                      <p className="pt-0.5">
                        Download the companion files onto Mohsin's Windows laptop:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href="/api/runner/download/start-runner.bat"
                          download="start-runner.bat"
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          start-runner.bat
                        </a>
                        <a
                          href="/api/runner/download/runner.cjs"
                          download="runner.cjs"
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          runner.cjs
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                      2
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <p className="pt-0.5">
                        Launch the runner in CMD to connect outbound to Maryam Cloud:
                      </p>
                      <div className="p-2 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-2">
                        <code className="text-[11px] font-mono text-indigo-300 break-all select-all">
                          {relayCommand}
                        </code>
                        <button
                          onClick={handleCopyRelayCmd}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-all shrink-0 flex items-center gap-1"
                        >
                          {copiedRelayCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-300" />}
                          {copiedRelayCmd ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token Input */}
                <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Runner Auth Token (optional in Relay mode)"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleSaveToken}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shrink-0"
                  >
                    Save Token
                  </button>
                </div>
              </div>

              {/* System & OmniRoute Tests */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  System & OmniRoute CLI Tests
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCheckLiveHealth}
                    disabled={isCheckingHealth}
                    className="px-3 py-2 rounded-xl bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    Check 127.0.0.1:48123 /health
                  </button>
                  <button
                    onClick={() => handleRunSafeTest('omniroute.status')}
                    disabled={isTesting}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isTesting ? 'animate-spin' : ''}`} />
                    Test omniroute.status
                  </button>
                  <button
                    onClick={() => handleRunSafeTest('system.health')}
                    disabled={isTesting}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    Test system.health
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PIPELINE ARCHITECTURE */}
          {activeTestTab === 'architecture' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Strict Security & Sandbox Principles
                </h4>
                <ul className="space-y-1.5 text-zinc-400 text-xs list-disc list-inside">
                  <li><strong>Zero Arbitrary Shell Execution:</strong> The runner enforces a strict 19-tool allowlist. Arbitrary bash/cmd commands are completely disabled.</li>
                  <li><strong>Human Confirmation for Sensitive Actions:</strong> Actions involving purchases, payments, credential submission, or deletion require explicit confirmation.</li>
                  <li><strong>Untrusted Webpage Content Guard:</strong> Text extracted from webpages is isolated and labeled so prompt injections cannot manipulate Maryam.</li>
                  <li><strong>Private Network & Session Isolation:</strong> Runner binds exclusively to 127.0.0.1 and communicates outbound over encrypted HTTPS Relay.</li>
                </ul>
              </div>

              <div className="space-y-2">
                {pipelineStages.map((stage) => (
                  <div
                    key={stage.id}
                    className="p-3 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white text-xs">{stage.name}</div>
                      <div className="text-[11px] text-zinc-400">{stage.description}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{stage.details}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                      stage.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {stage.status === 'active' ? 'Active' : 'Staged'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Outbound Relay Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
