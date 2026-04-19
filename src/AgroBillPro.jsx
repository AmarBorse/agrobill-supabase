// src/AgroBillPro.jsx
// Full AgroBill Pro — React + Supabase Edition
// Auth, Products, Bills, Shop Settings — all persisted in Supabase

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────
const CATS  = ['Seeds','Fertilizers','Pesticides','Herbicides','Equipment','Tools','Organic','Animal Feed'];
const UNITS = ['kg','g','ltr','ml','packet','bag','piece','dozen','quintal','ton'];
const G  = '#3B6D11';
const GL = '#EAF3DE';

const DEMO_PRODUCTS = [
  {name:'Paddy Seeds (Basmati)',category:'Seeds',unit:'kg',price:85,hsn:'1006',stock:500,gst:0},
  {name:'DAP Fertilizer 50kg',category:'Fertilizers',unit:'bag',price:1350,hsn:'3105',stock:200,gst:5},
  {name:'Urea 45kg Bag',category:'Fertilizers',unit:'bag',price:266,hsn:'3102',stock:300,gst:5},
  {name:'Chlorpyrifos 500ml',category:'Pesticides',unit:'ltr',price:450,hsn:'3808',stock:100,gst:18},
  {name:'Glyphosate Herbicide',category:'Herbicides',unit:'ltr',price:380,hsn:'3808',stock:80,gst:18},
  {name:'Organic Compost',category:'Organic',unit:'kg',price:25,hsn:'3101',stock:1000,gst:0},
  {name:'Drip Irrigation Kit',category:'Equipment',unit:'piece',price:2500,hsn:'8424',stock:50,gst:12},
  {name:'Wheat Seeds (HD-2967)',category:'Seeds',unit:'kg',price:45,hsn:'1001',stock:800,gst:0},
  {name:'NPK 19-19-19',category:'Fertilizers',unit:'kg',price:55,hsn:'3105',stock:400,gst:5},
  {name:'Cattle Feed Premium',category:'Animal Feed',unit:'bag',price:900,hsn:'2309',stock:150,gst:0},
];

// ─── Helpers ──────────────────────────────────────────────────
const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Main Component ───────────────────────────────────────────
export default function AgroBillPro() {
  const [session, setSession]       = useState(null);
  const [loading, setLoading]       = useState(true);

  // App state
  const [screen, setScreen]         = useState('auth');   // auth | shopSetup | app
  const [tab, setTab]               = useState('overview');
  const [shop, setShop]             = useState(null);
  const [products, setProducts]     = useState([]);
  const [bills, setBills]           = useState([]);
  const [cart, setCart]             = useState([]);
  const [viewBill, setViewBill]     = useState(null);
  const [justGen, setJustGen]       = useState(null);

  // Form state
  const [isReg, setIsReg]           = useState(false);
  const [isForgot, setIsForgot]     = useState(false);
  const [authForm, setAF]           = useState({ name:'', email:'', phone:'', password:'', confirm:'', newPassword:'', newConfirm:'' });
  const [authErr, setAuthErr]       = useState('');
  const [authMsg, setAuthMsg]       = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [shopForm, setSF]           = useState({ name:'', address:'', gstin:'', phone:'' });
  const [billForm, setBF]           = useState({ customer:'', phone:'', discount:'0' });
  const [prodForm, setPF]           = useState({ name:'', category:'Seeds', unit:'kg', price:'', hsn:'', stock:'', gst:'5' });
  const [prodSrch, setProdSrch]     = useState('');
  const [prodFilt, setProdFilt]     = useState('All');
  const [billSrch, setBillSrch]     = useState('');
  const [showAddP, setShowAddP]     = useState(false);
  const [shopSettingsOpen, setShopSettingsOpen] = useState(false);
  const [editShopForm, setESF]      = useState({ name:'', address:'', gstin:'', phone:'' });
  const [dbError, setDbError]       = useState('');

  // ── Auth listener ──────────────────────────────────────────
  useEffect(() => {
    // Detect password reset link (has #access_token in URL)
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      setScreen('resetPassword');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
      else { setLoading(false); setScreen('auth'); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setScreen('resetPassword');
        setLoading(false);
        return;
      }
      setSession(session);
      if (!session) { setScreen('auth'); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load user data after login ─────────────────────────────
  const loadUserData = useCallback(async (userId) => {
    setLoading(true);
    try {
      const [shopRes, prodRes, billsRes] = await Promise.all([
        supabase.from('shops').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('products').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('bills').select('*, bill_items(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      const shopData = shopRes.data;
      const prodsData = prodRes.data || [];
      const billsData = (billsRes.data || []).map(b => ({
        ...b,
        items: b.bill_items || [],
        customer: { name: b.customer_name, phone: b.customer_phone },
        date: b.bill_date,
        time: b.bill_time,
        id: b.bill_number,
      }));

      setShop(shopData);
      setProducts(prodsData.length > 0 ? prodsData : []);
      setBills(billsData);
      setScreen(shopData ? 'app' : 'shopSetup');
    } catch (e) {
      setDbError('Failed to load data. Check your Supabase config.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Register ───────────────────────────────────────────────
  const register = async () => {
    setAuthErr('');
    const { name, email, phone, password, confirm } = authForm;
    if (!name || !email || !phone || !password) { setAuthErr('All fields are required.'); return; }
    if (password !== confirm) { setAuthErr('Passwords do not match.'); return; }
    if (password.length < 6) { setAuthErr('Password must be at least 6 characters.'); return; }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, phone } },
    });
    setAuthLoading(false);

    if (error) { setAuthErr(error.message); return; }
    if (data.session) {
      // Seed demo products for new user
      await supabase.from('products').insert(
        DEMO_PRODUCTS.map(p => ({ ...p, user_id: data.session.user.id }))
      );
      await loadUserData(data.session.user.id);
    } else {
      setAuthErr('Check your email to confirm your account, then log in.');
    }
  };

  // ── Login ──────────────────────────────────────────────────
  const login = async () => {
    setAuthErr('');
    const { email, password } = authForm;
    if (!email || !password) { setAuthErr('Enter email and password.'); return; }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) { setAuthErr(error.message); return; }
    await loadUserData(data.session.user.id);
  };

  // ── Forgot Password ────────────────────────────────────────
  const forgotPassword = async () => {
    setAuthErr(''); setAuthMsg('');
    if (!authForm.email) { setAuthErr('Enter your email address.'); return; }
    setAuthLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(authForm.email, {
      redirectTo: `${window.location.origin}`,
    });
    setAuthLoading(false);
    if (error) { setAuthErr(error.message); return; }
    setAuthMsg('✅ Password reset email sent! Check your inbox and click the link.');
  };

  // ── Reset Password (from email link) ───────────────────────
  const resetPassword = async () => {
    setAuthErr(''); setAuthMsg('');
    if (!authForm.newPassword) { setAuthErr('Enter a new password.'); return; }
    if (authForm.newPassword.length < 6) { setAuthErr('Password must be at least 6 characters.'); return; }
    if (authForm.newPassword !== authForm.newConfirm) { setAuthErr('Passwords do not match.'); return; }
    setAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password: authForm.newPassword });
    setAuthLoading(false);
    if (error) { setAuthErr(error.message); return; }
    setAuthMsg('✅ Password updated successfully!');
    window.location.hash = '';
    setTimeout(() => { setScreen('auth'); setAF({ name:'', email:'', phone:'', password:'', confirm:'', newPassword:'', newConfirm:'' }); }, 2000);
  };


  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null); setShop(null); setProducts([]); setBills([]);
    setCart([]); setTab('overview'); setViewBill(null); setJustGen(null);
    setAF({ name:'', email:'', phone:'', password:'', confirm:'' });
    setScreen('auth');
  };

  // ── Save Shop (first time) ─────────────────────────────────
  const saveShop = async () => {
    if (!shopForm.name.trim()) return;
    const { data, error } = await supabase.from('shops').insert({
      ...shopForm, user_id: session.user.id,
    }).select().single();
    if (!error) { setShop(data); setScreen('app'); }
  };

  // ── Update Shop Settings ───────────────────────────────────
  const updateShop = async () => {
    if (!editShopForm.name.trim()) return;
    const { data, error } = await supabase.from('shops')
      .update(editShopForm).eq('id', shop.id).select().single();
    if (!error) { setShop(data); setShopSettingsOpen(false); }
  };

  // ── Add Product ────────────────────────────────────────────
  const addProd = async () => {
    if (!prodForm.name || !prodForm.price) return;
    const { data, error } = await supabase.from('products').insert({
      ...prodForm,
      user_id: session.user.id,
      price: parseFloat(prodForm.price) || 0,
      stock: parseInt(prodForm.stock) || 0,
      gst: parseInt(prodForm.gst) || 0,
    }).select().single();
    if (!error) {
      setProducts(prev => [...prev, data]);
      setPF({ name:'', category:'Seeds', unit:'kg', price:'', hsn:'', stock:'', gst:'5' });
      setShowAddP(false);
    }
  };

  // ── Delete Product ─────────────────────────────────────────
  const delProd = async (id) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // ── Cart helpers ───────────────────────────────────────────
  const addToCart = (p) => {
    const ex = cart.find(c => c.p.id === p.id);
    if (ex) setCart(cart.map(c => c.p.id === p.id ? { ...c, qty: c.qty + 1 } : c));
    else setCart([...cart, { p, qty: 1 }]);
  };
  const updQty = (id, v) => {
    if (v <= 0) setCart(cart.filter(c => c.p.id !== id));
    else setCart(cart.map(c => c.p.id === id ? { ...c, qty: v } : c));
  };

  // ── Totals ─────────────────────────────────────────────────
  const calcTotals = () => {
    let sub = 0, tax = 0;
    cart.forEach(({ p, qty }) => { sub += p.price * qty; tax += p.price * qty * (p.gst / 100); });
    const d = parseFloat(billForm.discount) || 0;
    return { sub, tax, d, total: Math.max(0, sub + tax - d) };
  };

  // ── Generate Bill ──────────────────────────────────────────
  const genBill = async () => {
    if (!cart.length) return;
    const { sub, tax, d, total } = calcTotals();
    const now    = new Date();
    const billNo = `AGR-${String(bills.length + 1).padStart(3, '0')}`;

    const { data: billData, error: billError } = await supabase.from('bills').insert({
      user_id:       session.user.id,
      bill_number:   billNo,
      shop_name:     shop.name,
      shop_address:  shop.address,
      shop_gstin:    shop.gstin,
      shop_phone:    shop.phone,
      customer_name: billForm.customer || 'Walk-in Customer',
      customer_phone:billForm.phone,
      subtotal:      +sub.toFixed(2),
      tax_amount:    +tax.toFixed(2),
      discount:      +d.toFixed(2),
      total:         +total.toFixed(2),
      bill_date:     now.toLocaleDateString('en-IN'),
      bill_time:     now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }).select().single();

    if (billError) { setDbError('Failed to save bill.'); return; }

    const items = cart.map(({ p, qty }) => ({
      bill_id:    billData.id,
      name:       p.name,
      hsn:        p.hsn,
      qty,
      unit:       p.unit,
      price:      p.price,
      gst:        p.gst,
      tax_amount: +(p.price * qty * (p.gst / 100)).toFixed(2),
      total:      +(p.price * qty).toFixed(2),
    }));

    await supabase.from('bill_items').insert(items);

    const newBill = {
      ...billData,
      items,
      id:       billNo,
      customer: { name: billForm.customer || 'Walk-in Customer', phone: billForm.phone },
      date:     billData.bill_date,
      time:     billData.bill_time,
    };

    setBills(prev => [newBill, ...prev]);
    setJustGen(newBill);
    setCart([]);
    setBF({ customer:'', phone:'', discount:'0' });
  };

  // ── Derived values ─────────────────────────────────────────
  const todayStr   = new Date().toLocaleDateString('en-IN');
  const todayBills = bills.filter(b => b.date === todayStr);
  const todayRev   = todayBills.reduce((s, b) => s + b.total, 0);
  const totalRev   = bills.reduce((s, b) => s + b.total, 0);
  const filtProds  = products.filter(p =>
    (prodFilt === 'All' || p.category === prodFilt) &&
    p.name.toLowerCase().includes(prodSrch.toLowerCase())
  );
  const billingProds = products.filter(p =>
    p.name.toLowerCase().includes(billSrch.toLowerCase()) ||
    p.category.toLowerCase().includes(billSrch.toLowerCase())
  );
  const { sub, tax, d, total } = calcTotals();

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Loading
  // ═══════════════════════════════════════════════════════════
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f9f0' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'32px', marginBottom:'12px' }}>🌾</div>
        <div style={{ color:G, fontWeight:'500' }}>Loading AgroBill Pro…</div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Reset Password Screen (from email link)
  // ═══════════════════════════════════════════════════════════
  if (screen === 'resetPassword') return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f5f9f0,#e8f4dd)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'380px', boxShadow:'0 4px 24px rgba(59,109,17,0.12)' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'36px' }}>🔐</div>
          <div style={{ fontSize:'22px', fontWeight:'700', color:G }}>Set New Password</div>
          <div style={{ fontSize:'12px', color:'#888', marginTop:'4px' }}>Enter your new password below</div>
        </div>
        {authErr && <div style={{ padding:'10px', background:'#fde8e8', color:'#c0392b', borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{authErr}</div>}
        {authMsg && <div style={{ padding:'10px', background:'#EAF3DE', color:G, borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{authMsg}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <input placeholder="New Password *" type="password" value={authForm.newPassword}
            onChange={e => setAF({ ...authForm, newPassword: e.target.value })}
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          <input placeholder="Confirm New Password *" type="password" value={authForm.newConfirm}
            onChange={e => setAF({ ...authForm, newConfirm: e.target.value })}
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          <button onClick={resetPassword} disabled={authLoading}
            style={{ padding:'11px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'14px', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Updating…' : 'Update Password'}
          </button>
          <button onClick={() => { setScreen('auth'); window.location.hash=''; }}
            style={{ padding:'8px', background:'transparent', color:'#888', border:'none', cursor:'pointer', fontSize:'12px' }}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Auth Screen
  // ═══════════════════════════════════════════════════════════
  if (screen === 'auth') return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f5f9f0,#e8f4dd)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'380px', boxShadow:'0 4px 24px rgba(59,109,17,0.12)' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'36px' }}>🌾</div>
          <div style={{ fontSize:'22px', fontWeight:'700', color:G }}>AgroBill Pro</div>
          <div style={{ fontSize:'12px', color:'#888', marginTop:'4px' }}>GST Billing for Agro Shops</div>
        </div>

        {dbError && <div style={{ padding:'10px', background:'#fff3cd', color:'#856404', borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{dbError}</div>}
        {authErr && <div style={{ padding:'10px', background:'#fde8e8', color:'#c0392b', borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{authErr}</div>}

        <div style={{ display:'flex', marginBottom:'1.25rem', border:'1px solid #e0e0e0', borderRadius:'10px', overflow:'hidden' }}>
          {['Login','Register'].map(t => (
            <button key={t} onClick={() => { setIsReg(t==='Register'); setAuthErr(''); }}
              style={{ flex:1, padding:'10px', border:'none', cursor:'pointer', fontWeight:'500', fontSize:'13px',
                background: (isReg ? t==='Register' : t==='Login') ? G : '#fff',
                color:      (isReg ? t==='Register' : t==='Login') ? '#fff' : '#666' }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {isReg && (
            <>
              <input placeholder="Full Name *" value={authForm.name}
                onChange={e => setAF({ ...authForm, name: e.target.value })}
                style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
              <input placeholder="Phone Number *" value={authForm.phone}
                onChange={e => setAF({ ...authForm, phone: e.target.value })}
                style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
            </>
          )}
          <input placeholder="Email Address *" type="email" value={authForm.email}
            onChange={e => setAF({ ...authForm, email: e.target.value })}
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          <input placeholder="Password *" type="password" value={authForm.password}
            onChange={e => setAF({ ...authForm, password: e.target.value })}
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          {isReg && (
            <input placeholder="Confirm Password *" type="password" value={authForm.confirm}
              onChange={e => setAF({ ...authForm, confirm: e.target.value })}
              style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          )}
          <button onClick={isReg ? register : login} disabled={authLoading}
            style={{ padding:'11px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'14px', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Please wait…' : isReg ? 'Create Account' : 'Login'}
          </button>
          {!isReg && (
            <button onClick={() => { setIsForgot(true); setAuthErr(''); setAuthMsg(''); }}
              style={{ padding:'6px', background:'transparent', color:G, border:'none', cursor:'pointer', fontSize:'12px', textDecoration:'underline' }}>
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Forgot Password Screen ─────────────────────────────────
  if (screen === 'auth' && isForgot) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f5f9f0,#e8f4dd)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'380px', boxShadow:'0 4px 24px rgba(59,109,17,0.12)' }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'36px' }}>🔐</div>
          <div style={{ fontSize:'22px', fontWeight:'700', color:G }}>Forgot Password?</div>
          <div style={{ fontSize:'12px', color:'#888', marginTop:'4px' }}>We'll send a reset link to your email</div>
        </div>
        {authErr && <div style={{ padding:'10px', background:'#fde8e8', color:'#c0392b', borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{authErr}</div>}
        {authMsg && <div style={{ padding:'10px', background:'#EAF3DE', color:G, borderRadius:'8px', fontSize:'12px', marginBottom:'12px' }}>{authMsg}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <input placeholder="Your Email Address *" type="email" value={authForm.email}
            onChange={e => setAF({ ...authForm, email: e.target.value })}
            style={{ padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
          <button onClick={forgotPassword} disabled={authLoading}
            style={{ padding:'11px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'14px', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Sending…' : 'Send Reset Link 📧'}
          </button>
          <button onClick={() => { setIsForgot(false); setAuthErr(''); setAuthMsg(''); }}
            style={{ padding:'8px', background:'transparent', color:'#888', border:'none', cursor:'pointer', fontSize:'12px' }}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Shop Setup
  // ═══════════════════════════════════════════════════════════
  if (screen === 'shopSetup') return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f5f9f0,#e8f4dd)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'420px', boxShadow:'0 4px 24px rgba(59,109,17,0.12)' }}>
        <div style={{ fontSize:'20px', fontWeight:'700', color:G, marginBottom:'4px' }}>🏪 Setup Your Shop</div>
        <div style={{ fontSize:'12px', color:'#888', marginBottom:'1.5rem' }}>This appears on every bill you generate</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {[
            ['Shop Name *', 'text', shopForm.name, v => setSF({ ...shopForm, name: v }), 'e.g. Green Valley Agro Store'],
            ['Address', 'text', shopForm.address, v => setSF({ ...shopForm, address: v }), 'Shop address'],
            ['GSTIN', 'text', shopForm.gstin, v => setSF({ ...shopForm, gstin: v }), 'e.g. 27ABCDE1234F1Z5'],
            ['Phone', 'tel', shopForm.phone, v => setSF({ ...shopForm, phone: v }), 'Shop contact number'],
          ].map(([label, type, val, cb, ph]) => (
            <div key={label}>
              <label style={{ fontSize:'11px', color:'#666', display:'block', marginBottom:'4px' }}>{label}</label>
              <input type={type} placeholder={ph} value={val} onChange={e => cb(e.target.value)}
                style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
            </div>
          ))}
          <button onClick={saveShop} disabled={!shopForm.name.trim()}
            style={{ padding:'11px', background:shopForm.name.trim()?G:'#ccc', color:'#fff', border:'none', borderRadius:'8px', cursor:shopForm.name.trim()?'pointer':'default', fontWeight:'600', marginTop:'6px' }}>
            Save & Continue →
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Bill Receipt
  // ═══════════════════════════════════════════════════════════
  const BillReceipt = ({ bill, onBack }) => (
    <div style={{ minHeight:'60vh', background:'#f5f9f0', padding:'1rem 0' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1rem' }}>
        <button onClick={onBack} style={{ fontSize:'13px', color:'#888', background:'none', border:'none', cursor:'pointer' }}>← Back</button>
        {justGen && <span style={{ fontSize:'12px', fontWeight:'500', color:G, background:GL, padding:'3px 10px', borderRadius:'20px' }}>✓ Bill Generated!</span>}
      </div>
      <div style={{ background:'#fff', borderRadius:'12px', maxWidth:'500px', margin:'0 auto', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ background:G, color:'#fff', padding:'1.5rem', textAlign:'center' }}>
          <div style={{ fontSize:'10px', opacity:0.7, letterSpacing:'2px', textTransform:'uppercase', marginBottom:'4px' }}>Tax Invoice</div>
          <div style={{ fontSize:'20px', fontWeight:'700' }}>{bill.shopName || bill.shop_name}</div>
          {(bill.shopAddress || bill.shop_address) && <div style={{ fontSize:'11px', opacity:0.85, marginTop:'4px' }}>{bill.shopAddress || bill.shop_address}</div>}
          <div style={{ display:'flex', justifyContent:'center', gap:'16px', marginTop:'8px', fontSize:'11px', opacity:0.8 }}>
            {(bill.shopGstin || bill.shop_gstin) && <span>GSTIN: {bill.shopGstin || bill.shop_gstin}</span>}
            {(bill.shopPhone || bill.shop_phone) && <span>📞 {bill.shopPhone || bill.shop_phone}</span>}
          </div>
        </div>
        <div style={{ padding:'1.25rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'11px', color:'#888' }}>Bill No.</div>
              <div style={{ fontWeight:'600', color:G }}>{bill.id || bill.bill_number}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'11px', color:'#888' }}>Date & Time</div>
              <div style={{ fontSize:'12px', fontWeight:'500' }}>{bill.date || bill.bill_date} {bill.time || bill.bill_time}</div>
            </div>
          </div>
          <div style={{ background:GL, borderRadius:'8px', padding:'10px 12px', marginBottom:'1rem' }}>
            <div style={{ fontSize:'11px', color:'#888' }}>Bill To</div>
            <div style={{ fontWeight:'500', fontSize:'13px' }}>{bill.customer?.name || bill.customer_name}</div>
            {(bill.customer?.phone || bill.customer_phone) && <div style={{ fontSize:'11px', color:'#666' }}>{bill.customer?.phone || bill.customer_phone}</div>}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', marginBottom:'1rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #eee' }}>
                {['Item','HSN','Qty','Rate','GST','Amount'].map(h => (
                  <th key={h} style={{ padding:'6px 4px', textAlign: h==='Item'?'left':'right', color:'#888', fontWeight:'500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #f5f5f5' }}>
                  <td style={{ padding:'7px 4px', fontWeight:'500' }}>{item.name}</td>
                  <td style={{ padding:'7px 4px', textAlign:'right', color:'#888' }}>{item.hsn}</td>
                  <td style={{ padding:'7px 4px', textAlign:'right' }}>{item.qty} {item.unit}</td>
                  <td style={{ padding:'7px 4px', textAlign:'right' }}>{fmt(item.price)}</td>
                  <td style={{ padding:'7px 4px', textAlign:'right' }}>{item.gst}%</td>
                  <td style={{ padding:'7px 4px', textAlign:'right', fontWeight:'500' }}>{fmt(item.total + item.tax_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop:'1px solid #eee', paddingTop:'10px' }}>
            {[
              ['Subtotal', fmt(bill.subtotal)],
              ['GST', fmt(bill.taxAmount || bill.tax_amount)],
              ['Discount', `-${fmt(bill.discount)}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#666', marginBottom:'4px' }}>
                <span>{label}</span><span>{val}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'16px', fontWeight:'700', color:G, marginTop:'8px', paddingTop:'8px', borderTop:'1px solid #eee' }}>
              <span>Total</span><span>{fmt(bill.total)}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'1rem' }}>
            <button onClick={() => window.print()}
              style={{ flex:1, padding:'10px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>
              🖨️ Print / Save PDF
            </button>
            <div style={{ padding:'10px 14px', background:GL, color:G, borderRadius:'8px', fontSize:'11px', fontWeight:'600', display:'flex', alignItems:'center' }}>PAID ✓</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER — Main App
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:'100vh', background:'#f5f9f0' }}>
      {/* Header */}
      <div style={{ background:G, color:'#fff', padding:'0 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'20px' }}>🌾</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:'600', letterSpacing:'0.3px' }}>{shop?.name || 'AgroBill Pro'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={() => { setESF({ name:shop.name, address:shop.address, gstin:shop.gstin, phone:shop.phone }); setShopSettingsOpen(true); }}
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', fontSize:'12px' }}>
            ⚙️ Shop
          </button>
          <button onClick={logout} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', fontSize:'12px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Shop Settings Modal */}
      {shopSettingsOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'1.5rem', width:'100%', maxWidth:'400px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div style={{ fontSize:'16px', fontWeight:'600', color:G }}>Edit Shop Details</div>
              <button onClick={() => setShopSettingsOpen(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#888' }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                ['Shop Name *', 'text', editShopForm.name, v => setESF({ ...editShopForm, name: v }), 'Shop name'],
                ['Address', 'text', editShopForm.address, v => setESF({ ...editShopForm, address: v }), 'Address'],
                ['GSTIN', 'text', editShopForm.gstin, v => setESF({ ...editShopForm, gstin: v }), 'GSTIN'],
                ['Phone', 'tel', editShopForm.phone, v => setESF({ ...editShopForm, phone: v }), 'Phone'],
              ].map(([label, type, val, cb, ph]) => (
                <div key={label}>
                  <label style={{ fontSize:'11px', color:'#666', display:'block', marginBottom:'3px' }}>{label}</label>
                  <input type={type} placeholder={ph} value={val} onChange={e => cb(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
                </div>
              ))}
              <button onClick={updateShop}
                style={{ padding:'10px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'600', marginTop:'6px' }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav Tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8e8e8', display:'flex', overflowX:'auto', position:'sticky', top:'52px', zIndex:99 }}>
        {[
          { id:'overview', label:'📊 Overview' },
          { id:'billing',  label:`🧾 Billing${cart.length ? ` (${cart.length})` : ''}` },
          { id:'products', label:`🌱 Products (${products.length})` },
          { id:'history',  label:`📋 History (${bills.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setViewBill(null); setJustGen(null); }}
            style={{ padding:'12px 16px', border:'none', borderBottom: tab===t.id ? `2px solid ${G}` : '2px solid transparent',
              background:'none', color: tab===t.id ? G : '#888', cursor:'pointer', fontSize:'12px', fontWeight: tab===t.id ? '600' : '400',
              whiteSpace:'nowrap', flexShrink:0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ padding:'1rem', maxWidth:'900px', margin:'0 auto' }}>
        {dbError && (
          <div style={{ padding:'12px', background:'#fde8e8', color:'#c0392b', borderRadius:'8px', fontSize:'12px', marginBottom:'1rem' }}>
            ⚠️ {dbError}
          </div>
        )}

        {/* VIEW BILL */}
        {viewBill && (
          <BillReceipt bill={viewBill} onBack={() => { setViewBill(null); setJustGen(null); }} />
        )}

        {/* OVERVIEW TAB */}
        {!viewBill && tab === 'overview' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'1rem' }}>
              {[
                { label:"Today's Sales",    value: fmt(todayRev),  sub: `${todayBills.length} bill${todayBills.length !== 1?'s':''}`, icon:'📅' },
                { label:'Total Revenue',    value: fmt(totalRev),  sub: `${bills.length} bills total`,  icon:'💰' },
                { label:'Products',         value: products.length, sub: 'in inventory',                icon:'🌱' },
                { label:'Cart Items',       value: cart.length,    sub: 'ready to bill',               icon:'🛒', action: () => setTab('billing') },
              ].map(({ label, value, sub, icon, action }) => (
                <div key={label} onClick={action} style={{ background:'#fff', borderRadius:'10px', padding:'14px', border:'0.5px solid #e0e0e0', cursor: action ? 'pointer' : 'default' }}>
                  <div style={{ fontSize:'20px', marginBottom:'6px' }}>{icon}</div>
                  <div style={{ fontSize:'22px', fontWeight:'700', color:G }}>{value}</div>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'2px' }}>{label}</div>
                  <div style={{ fontSize:'10px', color:'#bbb' }}>{sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background:'#fff', borderRadius:'10px', padding:'1rem', border:'0.5px solid #e0e0e0', marginBottom:'1rem' }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#333', marginBottom:'10px' }}>Quick Actions</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { label:'+ New Bill', action: () => setTab('billing'), bg: G },
                  { label:'Add Product', action: () => { setTab('products'); setShowAddP(true); }, bg: '#2980b9' },
                  { label:'View History', action: () => setTab('history'), bg: '#7f8c8d' },
                ].map(({ label, action, bg }) => (
                  <button key={label} onClick={action}
                    style={{ padding:'8px 16px', background:bg, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:'500' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {bills.length > 0 && (
              <div style={{ background:'#fff', borderRadius:'10px', padding:'1rem', border:'0.5px solid #e0e0e0' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#333', marginBottom:'10px' }}>Recent Bills</div>
                {bills.slice(0, 5).map(b => (
                  <div key={b.id} onClick={() => { setViewBill(b); setTab('history'); }}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f5f5f5', cursor:'pointer' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'500' }}>{b.id || b.bill_number} · {b.customer?.name || b.customer_name}</div>
                      <div style={{ fontSize:'11px', color:'#888' }}>{b.date || b.bill_date} {b.time || b.bill_time}</div>
                    </div>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:G }}>{fmt(b.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BILLING TAB */}
        {!viewBill && tab === 'billing' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'10px' }}>
            {justGen && (
              <BillReceipt bill={justGen} onBack={() => setJustGen(null)} />
            )}
            {!justGen && (
              <>
                <div style={{ background:'#fff', borderRadius:'10px', padding:'1rem', border:'0.5px solid #e0e0e0' }}>
                  <div style={{ fontSize:'14px', fontWeight:'600', color:'#333', marginBottom:'10px' }}>Customer Info</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    <input placeholder="Customer Name" value={billForm.customer}
                      onChange={e => setBF({ ...billForm, customer: e.target.value })}
                      style={{ padding:'9px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
                    <input placeholder="Phone" value={billForm.phone}
                      onChange={e => setBF({ ...billForm, phone: e.target.value })}
                      style={{ padding:'9px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
                  </div>
                </div>

                <div style={{ background:'#fff', borderRadius:'10px', padding:'1rem', border:'0.5px solid #e0e0e0' }}>
                  <div style={{ fontSize:'14px', fontWeight:'600', color:'#333', marginBottom:'10px' }}>Add Products</div>
                  <input placeholder="Search products…" value={billSrch}
                    onChange={e => setBillSrch(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px', marginBottom:'10px' }} />
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'240px', overflowY:'auto' }}>
                    {billingProds.map(p => (
                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:'8px', background:'#f9f9f9', border:'0.5px solid #eee' }}>
                        <div>
                          <div style={{ fontSize:'12px', fontWeight:'500' }}>{p.name}</div>
                          <div style={{ fontSize:'10px', color:'#888' }}>{fmt(p.price)}/{p.unit} · GST {p.gst}%</div>
                        </div>
                        <button onClick={() => addToCart(p)}
                          style={{ padding:'5px 12px', background:G, color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {cart.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:'10px', padding:'1rem', border:`1px solid ${G}` }}>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:G, marginBottom:'10px' }}>Cart ({cart.length} items)</div>
                    {cart.map(({ p, qty }) => (
                      <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f5f5f5' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'12px', fontWeight:'500' }}>{p.name}</div>
                          <div style={{ fontSize:'10px', color:'#888' }}>{fmt(p.price)}/{p.unit} · GST {p.gst}%</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                            <button onClick={() => updQty(p.id, qty - 1)}
                              style={{ width:'24px', height:'24px', borderRadius:'50%', border:`1px solid ${G}`, background:'#fff', color:G, cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                            <span style={{ fontSize:'13px', fontWeight:'500', minWidth:'20px', textAlign:'center' }}>{qty}</span>
                            <button onClick={() => updQty(p.id, qty + 1)}
                              style={{ width:'24px', height:'24px', borderRadius:'50%', border:'none', background:G, color:'#fff', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                          </div>
                          <span style={{ fontSize:'13px', fontWeight:'600', color:G, minWidth:'70px', textAlign:'right' }}>{fmt(p.price * qty)}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ paddingTop:'10px', marginTop:'4px' }}>
                      {[['Subtotal', fmt(sub)], ['GST', fmt(tax)]].map(([l, v]) => (
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#666', marginBottom:'4px' }}>
                          <span>{l}</span><span>{v}</span>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#666', marginBottom:'4px' }}>
                        <span>Discount (₹)</span>
                        <input type="number" min="0" value={billForm.discount}
                          onChange={e => setBF({ ...billForm, discount: e.target.value })}
                          style={{ width:'75px', textAlign:'right', padding:'3px 6px', borderRadius:'4px', border:'1px solid #ddd', fontSize:'12px' }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'16px', fontWeight:'700', color:G, paddingTop:'8px', borderTop:'1px solid #eee' }}>
                        <span>Total</span><span>{fmt(total)}</span>
                      </div>
                    </div>
                    <button onClick={genBill}
                      style={{ width:'100%', marginTop:'12px', padding:'11px', background:G, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
                      Generate Bill →
                    </button>
                    <button onClick={() => setCart([])}
                      style={{ width:'100%', marginTop:'6px', padding:'8px', background:'transparent', color:'#999', border:'0.5px solid #ddd', borderRadius:'8px', cursor:'pointer', fontSize:'12px' }}>
                      Clear Cart
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {!viewBill && tab === 'products' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
              <div style={{ fontSize:'16px', fontWeight:'600', color:'#333' }}>Products ({products.length})</div>
              <button onClick={() => setShowAddP(!showAddP)}
                style={{ padding:'8px 16px', background: showAddP ? '#fff' : G, color: showAddP ? '#666' : '#fff', border:`1px solid ${showAddP?'#ddd':G}`, borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>
                {showAddP ? 'Cancel' : '+ Add Product'}
              </button>
            </div>

            {showAddP && (
              <div style={{ background:'#fff', border:`1px solid ${G}`, borderRadius:'10px', padding:'1.25rem', marginBottom:'1rem' }}>
                <div style={{ fontSize:'13px', fontWeight:'600', color:G, marginBottom:'10px' }}>New Product</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'8px', marginBottom:'10px' }}>
                  {[
                    ['Product Name *', 'text', prodForm.name, v => setPF({ ...prodForm, name: v }), 'e.g. Paddy Seeds'],
                    ['Price (₹) *', 'number', prodForm.price, v => setPF({ ...prodForm, price: v }), '0.00'],
                    ['HSN Code', 'text', prodForm.hsn, v => setPF({ ...prodForm, hsn: v }), 'e.g. 1006'],
                    ['Stock Qty', 'number', prodForm.stock, v => setPF({ ...prodForm, stock: v }), '0'],
                  ].map(([label, type, val, cb, ph]) => (
                    <div key={label}>
                      <label style={{ fontSize:'10px', color:'#666', display:'block', marginBottom:'3px' }}>{label}</label>
                      <input type={type} placeholder={ph} value={val} onChange={e => cb(e.target.value)}
                        style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'12px' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:'10px', color:'#666', display:'block', marginBottom:'3px' }}>Category</label>
                    <select value={prodForm.category} onChange={e => setPF({ ...prodForm, category: e.target.value })}
                      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'12px' }}>
                      {CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'10px', color:'#666', display:'block', marginBottom:'3px' }}>Unit</label>
                    <select value={prodForm.unit} onChange={e => setPF({ ...prodForm, unit: e.target.value })}
                      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'12px' }}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:'10px', color:'#666', display:'block', marginBottom:'3px' }}>GST %</label>
                    <select value={prodForm.gst} onChange={e => setPF({ ...prodForm, gst: e.target.value })}
                      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:'6px', border:'1px solid #ddd', fontSize:'12px' }}>
                      {[0, 5, 12, 18].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addProd} disabled={!prodForm.name || !prodForm.price}
                  style={{ padding:'8px 18px', background: prodForm.name && prodForm.price ? G : '#ccc', color:'#fff', border:'none', borderRadius:'8px', cursor: prodForm.name && prodForm.price ? 'pointer' : 'default', fontSize:'13px', fontWeight:'500' }}>
                  Add Product
                </button>
              </div>
            )}

            <div style={{ display:'flex', gap:'8px', marginBottom:'10px', flexWrap:'wrap' }}>
              <input placeholder="Search products…" value={prodSrch} onChange={e => setProdSrch(e.target.value)}
                style={{ flex:1, minWidth:'140px', padding:'9px 12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'13px' }} />
              <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                {['All', ...CATS].map(c => (
                  <button key={c} onClick={() => setProdFilt(c)}
                    style={{ padding:'4px 10px', border:'0.5px solid #ddd', borderRadius:'20px', background: prodFilt===c ? G : '#fff', color: prodFilt===c ? '#fff' : '#888', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'8px' }}>
              {filtProds.map(p => (
                <div key={p.id} style={{ background:'#fff', border:'0.5px solid #e0e0e0', borderRadius:'10px', padding:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                    <div style={{ padding:'2px 8px', background:GL, color:G, borderRadius:'20px', fontSize:'10px', fontWeight:'500' }}>{p.category}</div>
                    <button onClick={() => delProd(p.id)} style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', fontSize:'18px', padding:'0 2px', lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ fontSize:'13px', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'2px' }}>{p.name}</div>
                  {p.hsn && <div style={{ fontSize:'10px', color:'#aaa' }}>HSN: {p.hsn}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:'8px' }}>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'600', color:G }}>{fmt(p.price)}<span style={{ fontSize:'10px', color:'#999', fontWeight:'400' }}>/{p.unit}</span></div>
                      <div style={{ fontSize:'10px', color:'#888' }}>GST {p.gst}% · Stock: {p.stock}</div>
                    </div>
                    <button onClick={() => { addToCart(p); setTab('billing'); }}
                      style={{ padding:'5px 10px', background:G, color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontWeight:'500' }}>
                      Bill
                    </button>
                  </div>
                </div>
              ))}
              {filtProds.length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem', color:'#aaa', fontSize:'13px' }}>No products found</div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {!viewBill && tab === 'history' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div style={{ fontSize:'16px', fontWeight:'600', color:'#333' }}>Bill History ({bills.length})</div>
              <div style={{ fontSize:'12px', color:'#888' }}>Total: <strong style={{ color:G }}>{fmt(totalRev)}</strong></div>
            </div>
            {bills.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'#aaa', fontSize:'13px' }}>
                No bills yet. <span style={{ color:G, cursor:'pointer' }} onClick={() => setTab('billing')}>Generate a bill →</span>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {bills.map(b => (
                  <div key={b.id || b.bill_number} onClick={() => setViewBill(b)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', background:'#fff', border:'0.5px solid #e0e0e0', borderRadius:'10px', cursor:'pointer' }}>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:GL, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>🧾</div>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'500' }}>{b.id || b.bill_number} · {b.customer?.name || b.customer_name}</div>
                        <div style={{ fontSize:'11px', color:'#888' }}>{b.items?.length || 0} item(s) · {b.date || b.bill_date} {b.time || b.bill_time}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'15px', fontWeight:'600', color:G }}>{fmt(b.total)}</div>
                      <div style={{ fontSize:'10px', color:'#bbb' }}>View →</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
