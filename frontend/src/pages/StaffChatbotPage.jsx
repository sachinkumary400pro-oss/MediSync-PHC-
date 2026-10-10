import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  MessageSquare, 
  Send, 
  BrainCircuit, 
  Sparkles, 
  MapPin, 
  Clock, 
  Calendar, 
  Share2, 
  Bot, 
  User,
  HelpCircle
} from 'lucide-react';

export default function StaffChatbotPage() {
  const { currentUser, t } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    {
      id: 'init_1',
      sender: 'bot',
      text: `வணக்கம்! I am your **MediSync PHC AI Clinical Inventory Assistant**.\n\nYou can ask me natural language queries about medicine stock, days-of-stock left, nearby surplus centres, or batch expiries at ${currentUser.phc_name || 'your PHC'}.`,
      action: null
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const samplePrompts = [
    'Who nearby has Paracetamol syrup and how far is it?',
    'How many days of Amoxicillin do we have?',
    'Which medicines are expiring within 90 days?',
    'Show me active critical shortages at my PHC',
    'Who nearby has ORS sachets?',
    'எந்த ஆரம்ப சுகாதார நிலையத்தில் பாராசிட்டமால் உள்ளது?'
  ];

  const handleSend = async (textToSend) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: query
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.postChatbotQuery(query, currentUser);
      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: res.reply,
        action: res.action,
        data: res.data
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: 'bot',
          text: 'I encountered an issue querying the database: ' + e.message
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff AI Inventory Assistant</h1>
            <p className="text-xs text-slate-500">
              Live queries on Tamil Nadu MSC formulary & nearby PHC surplus • English & தமிழ்
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> Quick queries:
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200 text-[11px] transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Window */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs h-[520px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-xl rounded-2xl p-4 text-xs space-y-2 ${
                  m.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{m.text}</p>

                {/* Interactive Action Shortcuts within Chat */}
                {m.action === 'TRANSFER_OPTION' && m.data?.nearest_donor && (
                  <div className="pt-2 mt-2 border-t border-slate-200/60 flex gap-2">
                    <button
                      onClick={() => navigate(`/nearby?medicine_id=${m.data.medicine.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      View on Rebalancing Map &rarr;
                    </button>
                  </div>
                )}

                {m.action === 'EMERGENCY_INDENT_SUGGESTION' && (
                  <div className="pt-2 mt-2 border-t border-slate-200/60 flex gap-2">
                    <button
                      onClick={() => navigate('/transfers?tab=indents')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Open Emergency Indent Creator &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <Bot className="w-4 h-4 text-emerald-500 animate-spin" />
              MediSync Assistant is querying stock telemetry...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything (e.g. 'Who nearby has ORS?', 'How many days of amoxicillin?')..."
            className="flex-1 py-2.5 px-4 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
