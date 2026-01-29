
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Order, OrderItem, Category, PaymentMethod, BusinessConfig, User, OrderStatus } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { generateBusinessAdvice } from './services/geminiService';

const App: React.FC = () => {
  // --- CHAVES DO BANCO DE DADOS LOCAL ---
  const DB_USERS = 'MEME_LANCHE_USERS_DB';
  const DB_SESSION = 'MEME_LANCHE_SESSION';
  const DB_CONFIG = 'MEME_LANCHE_CONFIG';
  const DB_PRODUCTS = 'MEME_LANCHE_PRODUCTS';
  const DB_ORDERS = 'MEME_LANCHE_ORDERS';

  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // --- ESTADOS DE NEGÓCIO ---
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'Todos'>('Todos');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminTab, setAdminTab] = useState<'dashboard' | 'sales' | 'inventory' | 'settings'>('dashboard');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // --- ESTADOS DE IA ---
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // --- ESTADO DE NOVO PRODUTO ---
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', price: 0, description: '', category: 'Hambúrgueres', image: '', stock: 100
  });

  // --- PERSISTÊNCIA ---
  const [config, setConfig] = useState<BusinessConfig>(() => {
    const saved = localStorage.getItem(DB_CONFIG);
    return saved ? JSON.parse(saved) : {
      isOpen: true,
      adminKey: '777',
      storeName: 'MEME LANCHE',
      deliveryFee: 7.00,
      whatsappNumber: '5522998641962',
      formspreeId: 'xzzzbzoe'
    };
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(DB_PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  // --- INICIALIZAÇÃO E AUTO-LOGIN ---
  useEffect(() => {
    const init = () => {
      const activeEmail = localStorage.getItem(DB_SESSION);
      if (activeEmail) {
        const users = JSON.parse(localStorage.getItem(DB_USERS) || '[]');
        const found = users.find((u: User) => u.email === activeEmail);
        if (found) setUser(found);
      }
      const savedOrders = JSON.parse(localStorage.getItem(DB_ORDERS) || '[]');
      setOrders(savedOrders);
      setIsAuthLoading(false);
    };
    init();
  }, []);

  // Monitorar pedido ativo do usuário logado
  useEffect(() => {
    if (user) {
      const myRecent = orders.find(o => o.customerEmail === user.email && o.status !== 'Cancelado' && o.status !== 'Enviado');
      setActiveOrder(myRecent || null);
    }
  }, [orders, user]);

  // Sincronizar com LocalStorage
  useEffect(() => { localStorage.setItem(DB_CONFIG, JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem(DB_PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(DB_ORDERS, JSON.stringify(orders)); }, [orders]);

  // --- HELPERS ---
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem(DB_USERS) || '[]');
    if (isRegistering) {
      if (users.find((u: User) => u.email === authEmail)) return showToast("E-mail já cadastrado", "error");
      const newUser = { 
        name: authName, 
        email: authEmail, 
        password: authPass, 
        photo: `https://ui-avatars.com/api/?name=${authName}&background=c4a661&color=000` 
      };
      localStorage.setItem(DB_USERS, JSON.stringify([...users, newUser]));
      login(newUser);
    } else {
      const found = users.find((u: any) => u.email === authEmail && u.password === authPass);
      if (found) login(found);
      else showToast("E-mail ou senha incorretos", "error");
    }
  };

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem(DB_SESSION, u.email);
    showToast(`Bem-vindo ao ${config.storeName}`);
    setAuthPass('');
  };

  const handleLogout = () => {
    localStorage.removeItem(DB_SESSION);
    setUser(null);
    setIsAdminMode(false);
    setCart([]);
    showToast("Sessão encerrada");
  };

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + (i.product.price * i.quantity), 0), [cart]);

  // --- FINALIZAÇÃO DE PEDIDO ---
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cart.length === 0 || isProcessingOrder) return;
    setIsProcessingOrder(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const orderId = `#M${Date.now().toString().slice(-4)}`;
    const total = cartTotal + config.deliveryFee;

    const newOrder: Order = {
      id: orderId,
      customerName: user.name,
      customerPhone: formData.get('phone') as string,
      address: formData.get('address') as string,
      items: [...cart],
      subtotal: cartTotal,
      discount: 0,
      total,
      status: 'Pendente',
      paymentMethod: formData.get('payment') as PaymentMethod,
      createdAt: Date.now(),
      customerEmail: user.email
    };

    const waMsg = `*MEME LANCHE - PEDIDO ${orderId}*%0A%0A` + 
      cart.map(i => `• ${i.quantity}x ${i.product.name}`).join('%0A') + 
      `%0A%0ATOTAL: R$ ${total.toFixed(2)}%0A` +
      `PAGAMENTO: ${newOrder.paymentMethod}%0A` +
      `ENDEREÇO: ${newOrder.address}`;

    try {
      await fetch(`https://formspree.io/f/${config.formspreeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
      
      setOrders(prev => [newOrder, ...prev]);
      setCart([]);
      showToast("Pedido Processado!");
      window.open(`https://wa.me/${config.whatsappNumber}?text=${waMsg}`, '_blank');
    } catch (err) {
      showToast("Erro no servidor de e-mail", "error");
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // --- IA ADVISOR ---
  const handleAiAdvice = async () => {
    setIsLoadingAi(true);
    const history = JSON.stringify(orders.slice(0, 10));
    const advice = await generateBusinessAdvice(history);
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  if (isAuthLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#c4a661]/10 border-t-[#c4a661] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#c4a661] selection:text-black font-['Inter'] overflow-x-hidden">
      
      {/* TOAST SYSTEM */}
      {toast && (
        <div className={`fixed top-24 right-6 z-[200] px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-bounce-in flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#c4a661] text-black rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-[#c4a661]/20 group overflow-hidden">
              {user ? <img src={user.photo} className="w-full h-full object-cover" /> : 'M'}
            </div>
            <div>
              <h1 className="font-bebas text-2xl tracking-widest text-[#c4a661] leading-none uppercase">{config.storeName}</h1>
              {user && <p className="text-[8px] uppercase font-bold tracking-widest text-white/30 mt-1">{user.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {user && <button onClick={handleLogout} className="text-[9px] font-black text-white/20 hover:text-red-500 uppercase tracking-widest transition-colors">Sair</button>}
            {!isAdminMode && user && (
              <button onClick={() => setShowAdminPinModal(true)} className="px-5 py-2 border border-white/10 rounded-full text-[9px] font-black uppercase text-white/30 hover:text-[#c4a661] transition-all hover:border-[#c4a661]/50">Gestão</button>
            )}
            {isAdminMode && (
              <button onClick={() => setIsAdminMode(false)} className="px-5 py-2 bg-red-600 text-white rounded-full text-[9px] font-black uppercase shadow-lg shadow-red-600/20">Sair Admin</button>
            )}
          </div>
        </div>
      </nav>

      {!user ? (
        /* PORTAL DE ACESSO */
        <div className="min-h-[90vh] flex items-center justify-center p-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c4a661]/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-sm w-full bg-[#0a0a0a] border border-white/10 p-12 rounded-[4rem] space-y-10 animate-fade-in shadow-2xl relative z-10 glass">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-[#c4a661] text-black rounded-[2rem] flex items-center justify-center font-black text-4xl mx-auto shadow-2xl">M</div>
              <h2 className="text-4xl font-bebas tracking-widest leading-none">MEME <span className="text-[#c4a661]">LANCHE</span></h2>
              <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Elite Sales Terminal</p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegistering && (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[8px] font-black text-gray-500 ml-4 uppercase">Nome Completo</label>
                  <input required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="JOÃO ELITE" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[8px] font-black text-gray-500 ml-4 uppercase">E-mail</label>
                <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="EMAIL@EXEMPLO.COM" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-gray-500 ml-4 uppercase">Senha de Acesso</label>
                <input required type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="••••••••" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase" />
              </div>
              <button type="submit" className="w-full bg-[#c4a661] text-black py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-[#c4a661]/10 mt-4">
                {isRegistering ? 'CADASTRAR CONTA' : 'EFETUAR LOGIN'}
              </button>
            </form>
            <button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-[#c4a661] transition-colors">
              {isRegistering ? 'Já possui conta? Entrar' : 'Não tem conta? Criar Agora'}
            </button>
          </div>
        </div>
      ) : (
        /* ÁREA PRINCIPAL */
        <main className="max-w-7xl mx-auto px-6 py-12">
          {!isAdminMode ? (
            /* VIEW DO CLIENTE */
            <div className="space-y-16 animate-fade-in">
              {activeOrder && (
                <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-[#c4a661]/30 rounded-[3.5rem] p-10 md:p-14 space-y-12 relative overflow-hidden shadow-2xl glass">
                   <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-4xl font-bebas tracking-widest leading-none">RASTREAMENTO EM TEMPO REAL</h3>
                      <p className="text-[10px] font-black text-[#c4a661] uppercase tracking-[0.4em] mt-2">ORDEM {activeOrder.id} • {activeOrder.status}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="w-4 h-4 bg-[#c4a661] rounded-full animate-ping mb-1" />
                      <span className="text-[8px] font-black text-white/20 uppercase">Syncing...</span>
                    </div>
                   </div>
                   <div className="flex justify-between items-center relative px-4 md:px-12">
                    <div className="absolute h-[2px] bg-white/5 top-1/2 left-0 right-0 mx-20" />
                    {['Pendente', 'Preparando', 'Pronto', 'Enviado'].map((s, i) => {
                      const isDone = ['Pendente', 'Preparando', 'Pronto', 'Enviado'].indexOf(activeOrder.status) >= i;
                      const isActive = activeOrder.status === s;
                      return (
                        <div key={s} className="relative z-10 flex flex-col items-center gap-3">
                          <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center transition-all duration-700 ${isDone ? 'bg-[#c4a661] text-black shadow-2xl shadow-[#c4a661]/40 scale-110' : 'bg-black border border-white/10 text-gray-700'}`}>
                            <span className="text-sm font-black italic">{i+1}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-[#c4a661]' : isDone ? 'text-white/60' : 'text-gray-800'}`}>{s}</span>
                        </div>
                      );
                    })}
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-14">
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {['Todos', 'Hambúrgueres', 'Acompanhamentos', 'Bebidas', 'Sobremesas'].map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(cat as any)} className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-500 whitespace-nowrap ${activeCategory === cat ? 'bg-[#c4a661] border-[#c4a661] text-black shadow-lg shadow-[#c4a661]/20' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}>{cat}</button>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {products.filter(p => activeCategory === 'Todos' || p.category === activeCategory).map(p => (
                      <div key={p.id} className="group bg-[#0a0a0a] border border-white/5 rounded-[3.5rem] overflow-hidden hover:border-[#c4a661]/40 transition-all duration-700 shadow-xl relative glass">
                        <div className="h-72 relative overflow-hidden">
                          <img src={p.image} className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                          <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
                            <span className="text-[#c4a661] font-black text-xs tracking-widest italic">R$ {p.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="p-10 space-y-5">
                          <div>
                            <h3 className="text-2xl font-bold uppercase tracking-tight group-hover:text-[#c4a661] transition-colors">{p.name}</h3>
                            <p className="text-gray-500 text-[10px] leading-relaxed line-clamp-2 uppercase font-medium mt-2">{p.description}</p>
                          </div>
                          <button onClick={() => { 
                            if(!config.isOpen) return showToast("Operação Encerrada!", "error");
                            setCart(prev => {
                              const ex = prev.find(i => i.product.id === p.id);
                              if(ex) return prev.map(i => i.product.id === p.id ? {...i, quantity: i.quantity+1} : i);
                              return [...prev, {product: p, quantity: 1}];
                            });
                            showToast(`${p.name} ADICIONADO!`);
                          }} className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#c4a661] hover:text-black transition-all duration-500">ADICIONAR À SACOLA</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-4">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-[4rem] p-10 sticky top-32 shadow-2xl glass">
                    <h3 className="font-bebas text-5xl mb-10 tracking-widest text-[#c4a661] leading-none">MINHA <span className="text-white">SACOLA</span></h3>
                    {cart.length === 0 ? (
                      <div className="py-28 text-center flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                          <span className="text-4xl opacity-20">🛍️</span>
                        </div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sua sacola está vazia</p>
                      </div>
                    ) : (
                      <form onSubmit={handleCheckout} className="space-y-8">
                        <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                          {cart.map(i => (
                            <div key={i.product.id} className="flex justify-between items-center bg-white/[0.03] p-5 rounded-3xl border border-white/5 group transition-all hover:bg-white/[0.06]">
                              <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none">{i.product.name}</p>
                                <p className="text-[9px] text-[#c4a661] mt-2 font-bold tracking-widest italic">R$ {(i.product.price * i.quantity).toFixed(2)}</p>
                              </div>
                              <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                                <button type="button" onClick={() => setCart(prev => prev.map(it => it.product.id === i.product.id ? {...it, quantity: Math.max(0, it.quantity-1)} : it).filter(it => it.quantity > 0))} className="w-8 h-8 rounded-xl bg-black border border-white/5 flex items-center justify-center text-xs font-black transition-colors hover:text-red-500">-</button>
                                <span className="text-[11px] font-black min-w-[15px] text-center italic">{i.quantity}</span>
                                <button type="button" onClick={() => setCart(prev => prev.map(it => it.product.id === i.product.id ? {...it, quantity: it.quantity+1} : it))} className="w-8 h-8 rounded-xl bg-black border border-white/5 flex items-center justify-center text-xs font-black transition-colors hover:text-green-500">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-8 border-t border-white/10 space-y-2">
                           <div className="flex justify-between items-center opacity-40">
                             <span className="text-[9px] font-black uppercase">Taxa de Entrega</span>
                             <span className="text-[10px] font-black">R$ {config.deliveryFee.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-end pt-2">
                             <span className="text-[11px] font-black uppercase text-gray-600">Total Elite</span>
                             <span className="text-6xl font-bebas text-[#c4a661] leading-none tracking-tighter">R$ {(cartTotal + config.deliveryFee).toFixed(2)}</span>
                           </div>
                        </div>

                        <div className="space-y-4 pt-4">
                          <input required name="phone" placeholder="WHATSAPP (DDD)" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest" />
                          <textarea required name="address" placeholder="ENDEREÇO COMPLETO + REFERÊNCIA" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase h-28 resize-none tracking-widest" />
                          <select name="payment" className="w-full px-8 py-5 rounded-2xl text-[10px] font-black uppercase bg-[#050505] tracking-widest">
                            <option value="PIX (na Entrega)">PIX (NO RECEBIMENTO)</option>
                            <option value="Cartão (Máquina)">CARTÃO (MÁQUINA)</option>
                            <option value="Dinheiro">DINHEIRO ESPÉCIE</option>
                          </select>
                        </div>

                        <button disabled={isProcessingOrder} className="w-full bg-[#c4a661] text-black py-7 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-[#c4a661]/10 hover:scale-[1.03] transition-all disabled:opacity-50">
                          {isProcessingOrder ? 'PROCESSANDO...' : 'FINALIZAR NO WHATSAPP'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW DO ADMINISTRADOR (PIN 777) */
            <div className="space-y-12 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                <div>
                  <h2 className="text-8xl font-bebas tracking-widest leading-none">TERMINAL <span className="text-[#c4a661]">CORE</span></h2>
                  <p className="text-gray-500 text-[11px] font-black uppercase tracking-[0.6em] mt-3">Meme Lanche Operation Control</p>
                </div>
                <div className="flex gap-4 overflow-x-auto w-full md:w-auto pb-4 no-scrollbar">
                  {['dashboard', 'sales', 'inventory', 'settings'].map(tab => (
                    <button key={tab} onClick={() => setAdminTab(tab as any)} className={`px-10 py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] border transition-all whitespace-nowrap ${adminTab === tab ? 'bg-[#c4a661] border-[#c4a661] text-black shadow-xl shadow-[#c4a661]/20' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>{tab}</button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-white/5 rounded-[4.5rem] p-12 min-h-[650px] shadow-2xl relative overflow-hidden glass">
                
                {/* ADMIN DASHBOARD + CFO IA */}
                {adminTab === 'dashboard' && (
                  <div className="space-y-14">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="bg-white/5 p-14 rounded-[3.5rem] border border-white/5 flex flex-col justify-between">
                        <span className="text-gray-500 text-[11px] font-black uppercase tracking-[0.3em]">Revenue Pipeline</span>
                        <p className="text-8xl font-bebas text-[#c4a661] mt-6 leading-none tracking-tighter">R$ {orders.reduce((a,c) => a+c.total, 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/5 p-14 rounded-[3.5rem] border border-white/5 flex flex-col justify-between">
                        <span className="text-gray-500 text-[11px] font-black uppercase tracking-[0.3em]">Total Orders</span>
                        <p className="text-8xl font-bebas mt-6 leading-none italic">{orders.length}</p>
                      </div>
                      <div className="bg-white/5 p-14 rounded-[3.5rem] border border-[#c4a661]/30 flex flex-col justify-between items-start">
                        <span className="text-gray-500 text-[11px] font-black uppercase tracking-[0.3em]">IA Strategy Analyst</span>
                        <button onClick={handleAiAdvice} disabled={isLoadingAi} className="mt-10 w-full py-5 bg-[#c4a661] text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-xl shadow-[#c4a661]/20 disabled:opacity-50">
                          {isLoadingAi ? 'CALCULANDO...' : 'REQUISITAR INSIGHT CFO'}
                        </button>
                      </div>
                    </div>
                    
                    {aiAdvice && (
                      <div className="bg-[#c4a661]/5 border border-[#c4a661]/20 p-12 rounded-[3.5rem] animate-fade-in relative">
                        <div className="absolute top-8 right-8 text-[#c4a661]/20 text-6xl font-bebas italic">GEMINI 3 PRO</div>
                        <h4 className="text-[#c4a661] font-black text-xs uppercase tracking-[0.3em] mb-8 flex items-center gap-4">
                          <div className="w-3 h-3 rounded-full bg-[#c4a661] animate-pulse" />
                          Relatório Estratégico de Performance
                        </h4>
                        <div className="text-[13px] leading-loose text-gray-300 whitespace-pre-wrap font-medium max-w-4xl tracking-wide">{aiAdvice}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ADMIN VENDAS */}
                {adminTab === 'sales' && (
                  <div className="space-y-8">
                    {orders.sort((a,b) => b.createdAt - a.createdAt).map(o => (
                      <div key={o.id} className="bg-white/[0.03] p-12 rounded-[4rem] border border-white/5 flex flex-col md:flex-row justify-between gap-12 transition-all hover:bg-white/[0.05] hover:border-white/10 group">
                        <div className="space-y-6 flex-1">
                          <div className="flex gap-6 items-center">
                            <span className="text-[#c4a661] font-black text-sm tracking-[0.3em] italic">{o.id}</span>
                            <div className="px-6 py-2 rounded-full bg-white/5 border border-white/10">
                              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{new Date(o.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                          <h4 className="text-4xl font-bold uppercase tracking-tighter group-hover:text-[#c4a661] transition-colors">{o.customerName}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] font-medium tracking-wide">
                            <div className="space-y-2">
                              <p className="text-gray-600 font-black uppercase text-[9px] tracking-[0.3em]">Dados de Contato:</p>
                              <p>{o.customerPhone}</p>
                              <p>{o.customerEmail}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-gray-600 font-black uppercase text-[9px] tracking-[0.3em]">Local de Entrega:</p>
                              <p className="line-clamp-2 uppercase">{o.address}</p>
                            </div>
                          </div>
                          <div className="bg-black/80 p-8 rounded-[2rem] border border-white/5">
                             <p className="text-[9px] text-gray-600 uppercase font-black tracking-[0.3em] mb-5">Bill of Materials (BOM):</p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               {o.items.map(i => (
                                 <div key={i.product.id} className="flex justify-between items-center border-b border-white/5 pb-2">
                                   <span className="text-[11px] font-black uppercase tracking-tight">{i.quantity}x {i.product.name}</span>
                                   <span className="text-[9px] text-[#c4a661] italic font-bold">R$ {(i.product.price * i.quantity).toFixed(2)}</span>
                                 </div>
                               ))}
                             </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between min-w-[300px] gap-8">
                           <div className="w-full space-y-3">
                             <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-4">Current Status</label>
                             <select value={o.status} onChange={e => { setOrders(prev => prev.map(ord => ord.id === o.id ? {...ord, status: e.target.value as OrderStatus} : ord)); showToast(`Status ${o.id} Updated`); }} className="w-full bg-black border border-white/10 px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] outline-none focus:border-[#c4a661] transition-all cursor-pointer">
                                <option value="Pendente">Aguardando Aprovação</option>
                                <option value="Preparando">In Production (Cozinha)</option>
                                <option value="Pronto">Order Finished (Packaged)</option>
                                <option value="Enviado">En Route (Delivery)</option>
                                <option value="Cancelado">Terminated (Canceled)</option>
                             </select>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Final Invoice Total</p>
                             <p className="text-7xl font-bebas text-[#c4a661] leading-none tracking-tighter italic">R$ {o.total.toFixed(2)}</p>
                           </div>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && <div className="py-52 text-center opacity-10 text-[12px] font-black uppercase tracking-[0.8em]">Operational Database Empty</div>}
                  </div>
                )}

                {/* ADMIN INVENTÁRIO */}
                {adminTab === 'inventory' && (
                  <div className="space-y-16">
                     <div className="bg-white/[0.03] p-14 rounded-[4.5rem] border border-[#c4a661]/20 space-y-12">
                      <h3 className="text-xs font-black uppercase tracking-[0.5em] text-[#c4a661]">Master Inventory Creation</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase text-gray-600 ml-5 tracking-widest">Product Label</label>
                           <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="EX: MEME MONSTER BURGER" className="w-full px-10 py-6 rounded-3xl text-[11px] font-black uppercase tracking-wider" />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase text-gray-600 ml-5 tracking-widest">Unit Price (BRL)</label>
                           <input type="number" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} placeholder="EX: 55.00" className="w-full px-10 py-6 rounded-3xl text-[11px] font-black uppercase tracking-wider" />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black uppercase text-gray-600 ml-5 tracking-widest">Category Cluster</label>
                           <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})} className="w-full px-10 py-6 rounded-3xl text-[11px] font-black uppercase bg-[#050505] tracking-widest cursor-pointer">
                            <option value="Hambúrgueres">HAMBÚRGUERES</option>
                            <option value="Acompanhamentos">ACOMPANHAMENTOS</option>
                            <option value="Bebidas">BEBIDAS</option>
                            <option value="Sobremesas">SOBREMESAS</option>
                           </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase text-gray-600 ml-5 tracking-widest">Media Source (Direct URL)</label>
                         <input value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} placeholder="HTTPS://IMAGES.UNSPLASH.COM/..." className="w-full px-10 py-6 rounded-3xl text-[11px] font-black uppercase tracking-wider" />
                      </div>
                      <button onClick={() => { 
                        if(!newProduct.name || !newProduct.price || !newProduct.image) return showToast("Faltam dados obrigatórios!", "error"); 
                        setProducts(prev => [...prev, {...newProduct as Product, id: `p-${Date.now()}`}]); 
                        setNewProduct({name:'', price:0, description:'', category:'Hambúrgueres', image:'', stock:100}); 
                        showToast("PRODUTO INTEGRADO AO DATABASE!"); 
                      }} className="px-16 py-6 bg-[#c4a661] text-black rounded-3xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-[#c4a661]/20 hover:scale-[1.05] transition-transform">
                        DEPLOY TO MASTER MENU
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {products.map(p => (
                        <div key={p.id} className="bg-white/[0.03] p-8 rounded-[3.5rem] flex gap-8 items-center group relative border border-white/5 hover:border-red-600/40 transition-all duration-500">
                           <button onClick={() => { if(confirm("Confirmar deleção do item?")) setProducts(prev => prev.filter(it => it.id !== p.id)); }} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all font-black text-xl">×</button>
                           <div className="w-28 h-28 rounded-[2rem] overflow-hidden flex-shrink-0 shadow-xl">
                            <img src={p.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                           </div>
                           <div className="flex-1 space-y-2">
                             <h4 className="text-xl font-bold uppercase tracking-tight group-hover:text-[#c4a661] transition-colors">{p.name}</h4>
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{p.category}</p>
                             <p className="text-2xl font-bebas text-white italic">R$ {p.price.toFixed(2)}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ADMIN CONFIGURAÇÕES */}
                {adminTab === 'settings' && (
                  <div className="max-w-3xl space-y-14">
                     <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase text-[#c4a661] ml-6 tracking-[0.3em]">Operational Status Control</label>
                       <button onClick={() => setConfig({...config, isOpen: !config.isOpen})} className={`w-full py-12 rounded-[3.5rem] font-black text-sm uppercase tracking-[0.6em] border transition-all duration-700 ${config.isOpen ? 'border-green-600/30 text-green-500 bg-green-600/[0.05] shadow-lg shadow-green-600/10' : 'border-red-600/30 text-red-500 bg-red-600/[0.05] shadow-lg shadow-red-600/10'}`}>
                        {config.isOpen ? 'LOJA ONLINE (PROCESSANDO VENDAS)' : 'LOJA OFFLINE (SISTEMA BLOQUEADO)'}
                      </button>
                     </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase text-[#c4a661] ml-6 tracking-[0.3em]">Delivery Fee Master</label>
                        <input type="number" value={config.deliveryFee} onChange={e => setConfig({...config, deliveryFee: Number(e.target.value)})} className="w-full px-10 py-7 rounded-[2rem] bg-white/5 border border-white/10 text-sm font-black italic" />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase text-[#c4a661] ml-6 tracking-[0.3em]">Central WhatsApp Hub</label>
                        <input value={config.whatsappNumber} onChange={e => setConfig({...config, whatsappNumber: e.target.value})} className="w-full px-10 py-7 rounded-[2rem] bg-white/5 border border-white/10 text-sm font-black italic" />
                      </div>
                    </div>

                    <div className="space-y-4 pt-6">
                        <label className="text-[11px] font-black uppercase text-[#c4a661] ml-6 tracking-[0.3em]">Formspree Key (Protocol: HTTPS)</label>
                        <div className="relative">
                          <input value={config.formspreeId} onChange={e => setConfig({...config, formspreeId: e.target.value})} className="w-full px-10 py-7 rounded-[2rem] bg-white/5 border border-white/10 text-sm font-black italic" />
                          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
                            <span className="text-[10px] font-black text-white/20 uppercase">Secure Gateway</span>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          </div>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* MODAL PIN GESTOR */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-[100px] px-6">
          <div className="max-w-md w-full p-20 bg-[#0a0a0a] border border-white/10 rounded-[5rem] text-center shadow-2xl relative glass">
            <h2 className="text-6xl font-bebas mb-14 tracking-widest leading-none text-[#c4a661]">CORE <span className="text-white">ACCESS</span></h2>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em] mb-12">Insira o PIN de Autenticação Nível 3</p>
            <input type="password" autoFocus className="w-full text-center text-8xl font-black py-10 bg-transparent border-b-2 border-white/10 mb-16 outline-none focus:border-[#c4a661] tracking-[0.6em] transition-all italic" value={adminPinInput} onChange={e => setAdminPinInput(e.target.value)} />
            <div className="flex gap-6">
              <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); }} className="flex-1 py-7 text-[11px] font-black uppercase text-gray-700 hover:text-white transition-colors tracking-widest">Abortar</button>
              <button onClick={() => { if(adminPinInput === config.adminKey) { setIsAdminMode(true); setShowAdminPinModal(false); setAdminPinInput(''); showToast("CORE UNLOCKED"); } else { showToast("PIN DENIED", "error"); } }} className="flex-1 py-7 bg-[#c4a661] text-black rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-[#c4a661]/20 hover:scale-105 transition-transform">AUTENTICAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
