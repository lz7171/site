
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Product, Order, OrderItem, Category, PaymentMethod, BusinessConfig, OrderStatus, Activity } from './types';
import { INITIAL_PRODUCTS } from './constants';

const App: React.FC = () => {
  // --- CONSTANTES DE PERSISTÊNCIA ---
  const DB_KEYS = {
    CONFIG: 'MEME_LANCHE_CONFIG_V2',
    PRODUCTS: 'MEME_LANCHE_PRODUCTS_V2',
    ORDERS: 'MEME_LANCHE_ORDERS_V2',
    LOGS: 'MEME_LANCHE_LOGS_V2',
    LAST_EMAIL: 'MEME_LANCHE_LAST_EMAIL',
    DEVICE_ID: 'MEME_LANCHE_DEVICE_ID'
  };

  // --- IDENTIFICAÇÃO ÚNICA (DEVICE/IP SIMULADO) ---
  const [deviceId] = useState(() => {
    let id = localStorage.getItem(DB_KEYS.DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem(DB_KEYS.DEVICE_ID, id);
    }
    return id;
  });

  // --- UTILITÁRIO DE FORMATAÇÃO ---
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // --- ESTADOS DA APLICAÇÃO ---
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | 'Todos'>('Todos');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [adminTab, setAdminTab] = useState<'resumo' | 'pedidos' | 'cardapio' | 'ajustes' | 'logs'>('resumo');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'alert'} | null>(null);
  const [searchSales, setSearchSales] = useState('');
  
  // Estados de Formulário
  const [phoneInput, setPhoneInput] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', price: 0, description: '', category: 'Hambúrgueres', image: '', stock: 100
  });

  const prevOrdersCount = useRef(0);
  const [lastOrderEmail, setLastOrderEmail] = useState(localStorage.getItem(DB_KEYS.LAST_EMAIL) || '');

  // --- CARREGAMENTO INICIAL COM TRATAMENTO DE ERRO ---
  const [config, setConfig] = useState<BusinessConfig>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : {
        isOpen: true, adminKey: '777', storeName: 'MEME LANCHE',
        deliveryFee: 7.00, whatsappNumber: '5522988443453', formspreeId: ''
      };
    } catch { return { isOpen: true, adminKey: '777', storeName: 'MEME LANCHE', deliveryFee: 7.00, whatsappNumber: '5522988443453', formspreeId: '' }; }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.PRODUCTS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch { return INITIAL_PRODUCTS; }
  });

  useEffect(() => {
    try {
      const savedOrders = JSON.parse(localStorage.getItem(DB_KEYS.ORDERS) || '[]');
      const savedLogs = JSON.parse(localStorage.getItem(DB_KEYS.LOGS) || '[]');
      setOrders(savedOrders);
      setActivities(savedLogs);
      prevOrdersCount.current = savedOrders.length;
    } catch (e) { console.error("Erro ao carregar banco de dados local", e); }
  }, []);

  // --- SINCRONIZAÇÃO PERSISTENTE ---
  useEffect(() => {
    if (orders.length > prevOrdersCount.current) {
      if (isAdminMode) playNotificationSound();
      prevOrdersCount.current = orders.length;
    }
    localStorage.setItem(DB_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders, isAdminMode]);

  useEffect(() => { localStorage.setItem(DB_KEYS.CONFIG, JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(activities)); }, [activities]);

  // --- MEMOIZAÇÕES DE PERFORMANCE ---
  const filteredProducts = useMemo(() => 
    products.filter(p => activeCategory === 'Todos' || p.category === activeCategory),
    [products, activeCategory]
  );

  const filteredOrders = useMemo(() => 
    orders.filter(o => 
      o.customerName.toLowerCase().includes(searchSales.toLowerCase()) || 
      o.id.toLowerCase().includes(searchSales.toLowerCase())
    ),
    [orders, searchSales]
  );

  // Histórico específico do usuário atual (Baseado no DeviceID)
  const myOrders = useMemo(() => 
    orders.filter(o => o.deviceId === deviceId).sort((a, b) => b.createdAt - a.createdAt),
    [orders, deviceId]
  );

  const dailyRevenue = useMemo(() => 
    orders
      .filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString() && o.status !== 'Cancelado')
      .reduce((a, c) => a + c.total, 0),
    [orders]
  );

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + (i.product.price * i.quantity), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  // --- CALLBACKS OTIMIZADOS ---
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'alert' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const addActivity = useCallback((type: Activity['type'], message: string) => {
    const newAct: Activity = { id: Date.now().toString(), type, message, timestamp: Date.now() };
    setActivities(prev => [newAct, ...prev].slice(0, 50));
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    let formatted = value;
    if (value.length > 2) formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    if (value.length > 7) formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    setPhoneInput(formatted);
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isProcessingOrder) return;
    if (!config.isOpen) return showToast("Loja fechada no momento", "error");

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const phoneRaw = phoneInput.replace(/\D/g, '');
    if (phoneRaw.length < 10) return showToast("WhatsApp inválido!", "error");

    setIsProcessingOrder(true);
    const orderId = `#ML-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const email = (formData.get('email') as string).toLowerCase();
    const total = cartTotal + config.deliveryFee;

    const rua = formData.get('rua') as string;
    const numero = formData.get('numero') as string;
    const bairro = formData.get('bairro') as string;
    const referencia = formData.get('referencia') as string;
    const fullAddress = `${rua}, ${numero} - ${bairro}${referencia ? ` (Ref: ${referencia})` : ''}`;

    const newOrder: Order = {
      id: orderId,
      deviceId,
      customerName: formData.get('name') as string,
      customerPhone: phoneInput,
      address: fullAddress,
      items: [...cart],
      subtotal: cartTotal,
      discount: 0,
      total,
      status: 'Pendente',
      paymentMethod: formData.get('payment') as PaymentMethod,
      createdAt: Date.now(),
      customerEmail: email
    };

    const itemsList = cart.map(i => `• ${i.quantity}x ${i.product.name} (${formatCurrency(i.product.price * i.quantity)})`).join('%0A');
    
    // MENSAGEM WHATSAPP OTIMIZADA COM "PEDIDO FEITO" E NOME EM DESTAQUE
    const waMsg = `*✅ Pedido feito por: ${newOrder.customerName}* %0A%0A` +
      `*🆔 ID COMPRA:* ${orderId}%0A` +
      `----------------------------%0A` +
      `*📦 DETALHES DO PEDIDO*%0A${itemsList}%0A%0A` +
      `*💰 FINANCEIRO*%0A` +
      `Subtotal: ${formatCurrency(cartTotal)}%0A` +
      `Entrega: ${formatCurrency(config.deliveryFee)}%0A` +
      `*TOTAL: ${formatCurrency(total)}*%0A%0A` +
      `*💳 PAGAMENTO*%0A${newOrder.paymentMethod}%0A%0A` +
      `*📍 ENDEREÇO DE ENTREGA*%0A${fullAddress}%0A%0A` +
      `_Enviado pelo dispositivo: ${deviceId.slice(-6).toUpperCase()}_`;

    try {
      localStorage.setItem(DB_KEYS.LAST_EMAIL, email);
      setLastOrderEmail(email);
      setOrders(prev => [newOrder, ...prev]);
      addActivity('ORDER', `Novo pedido: ${orderId} (Device: ${deviceId.slice(-6)})`);
      setCart([]);
      setPhoneInput('');
      setShowCartDrawer(false);
      
      // Abrir WhatsApp com a mensagem estruturada
      window.open(`https://wa.me/${config.whatsappNumber}?text=${waMsg}`, '_blank');
      showToast(`Pedido de ${newOrder.customerName} Gerado!`);
    } catch { 
      showToast("Erro ao processar pedido", "error"); 
    } finally { 
      setIsProcessingOrder(false); 
    }
  };

  const updateOrderStatus = useCallback((id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? {...o, status} : o));
    addActivity('STATUS', `Pedido ${id} -> ${status}`);
    showToast(`Status: ${status}`);
  }, [addActivity, showToast]);

  const handleSaveProduct = useCallback(() => {
    if(!newProduct.name || !newProduct.price) return showToast("Campos obrigatórios vazios", "error");
    if(isEditing) {
      setProducts(p => p.map(it => it.id === isEditing ? {...newProduct as Product, id: isEditing} : it));
      addActivity('INVENTORY', `Editado: ${newProduct.name}`);
      setIsEditing(null);
    } else {
      const id = `p-${Date.now()}`;
      setProducts(p => [...p, {...newProduct as Product, id}]);
      addActivity('INVENTORY', `Criado: ${newProduct.name}`);
    }
    setNewProduct({name:'', price:0, description:'', category: 'Hambúrgueres', image:'', stock:100});
    showToast("Cardápio atualizado");
  }, [newProduct, isEditing, addActivity, showToast]);

  return (
    <div className="min-h-screen text-white/90 selection:bg-[#c4a661] selection:text-black">
      {/* MESH BACKGROUND UTILITY */}
      <div className="fixed inset-0 -z-10 bg-[#030303] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_50%_50%,#c4a661_0%,transparent_50%)]" />
      </div>

      {/* TOAST SYSTEM */}
      {toast && (
        <div className={`fixed top-10 right-6 z-[600] px-8 py-5 rounded-2xl shadow-2xl border backdrop-blur-3xl animate-fade-up flex items-center gap-4 ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
          toast.type === 'alert' ? 'bg-[#c4a661]/20 border-[#c4a661]/40 text-[#c4a661]' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'alert' ? 'bg-[#c4a661]' : 'bg-red-500'} animate-pulse`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{toast.msg}</span>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="sticky top-0 z-[100] h-20 px-6 md:px-12 flex justify-between items-center bg-[#030303]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
          <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-black text-xl">M</div>
          <div className="hidden sm:block">
            <h1 className="font-bebas text-2xl tracking-widest text-white leading-none">{config.storeName}</h1>
            <p className="text-[8px] uppercase font-bold tracking-[0.3em] text-[#c4a661]">Miracema • RJ</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8">
          {!isAdminMode ? (
            <>
              <button onClick={() => setShowHistoryModal(true)} className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Histórico</button>
              <button onClick={() => setShowAdminPinModal(true)} className="px-5 py-2 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-[#c4a661] hover:border-[#c4a661] transition-all">Gestão</button>
              <button onClick={() => setShowCartDrawer(true)} className="flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-lg shadow-white/5">
                <span className="text-[9px] font-black uppercase tracking-widest">Sacola</span>
                <span className="bg-black text-white px-2 py-0.5 rounded-md text-[9px] font-black">{cartCount}</span>
              </button>
            </>
          ) : (
            <button onClick={() => setIsAdminMode(false)} className="bg-red-600 px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-red-500 transition-colors">Sair do Painel</button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20">
        {!isAdminMode ? (
          <div className="space-y-24 animate-fade-up">
            <header className="space-y-6">
              <h2 className="text-6xl md:text-9xl font-bebas leading-[0.9] tracking-tighter">O SABOR DE <br/><span className="text-[#c4a661] italic">MIRACEMA.</span></h2>
              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-12">
                <p className="text-white/40 font-medium max-w-md uppercase tracking-[0.2em] text-[10px] leading-relaxed">Ingredientes selecionados, preparo imediato e a tradição dos melhores lanches da região.</p>
                {!config.isOpen && <div className="bg-red-600/20 border border-red-600/30 px-6 py-2 rounded-full text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Cozinha Fechada Agora</div>}
              </div>
            </header>

            {/* FILTROS */}
            <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar sticky top-20 z-50 bg-[#030303]/80 backdrop-blur-md pt-4">
              {['Todos', 'Hambúrgueres', 'Especial', 'Acompanhamentos', 'Bebidas'].map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat as any)} 
                  className={`px-8 py-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                    activeCategory === cat ? 'bg-[#c4a661] border-[#c4a661] text-black shadow-lg shadow-[#c4a661]/10' : 'bg-white/5 border-white/5 text-white/30 hover:border-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* GRID DE PRODUTOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map(p => (
                <div key={p.id} className="premium-card group rounded-[2.5rem] p-8 md:p-10 flex flex-col justify-between min-h-[340px] hover:scale-[1.02]">
                  <div className="cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#c4a661] border-b border-[#c4a661]/20 pb-1">{p.category}</span>
                      <span className="text-3xl font-bebas text-[#c4a661] tracking-widest">{formatCurrency(p.price)}</span>
                    </div>
                    <h3 className="text-3xl font-bold uppercase tracking-tight text-white mb-6 group-hover:text-[#c4a661] transition-colors">{p.name}</h3>
                    <div className="space-y-2">
                       <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">Composição:</p>
                       <p className="text-sm text-white/60 leading-relaxed uppercase font-medium">{p.description}</p>
                    </div>
                  </div>
                  <div className="mt-8">
                    <button 
                      onClick={() => {
                        if(!config.isOpen) return showToast("Estamos fechados", "error");
                        setCart(prev => {
                          const ex = prev.find(i => i.product.id === p.id);
                          if(ex) return prev.map(i => i.product.id === p.id ? {...i, quantity: i.quantity+1} : i);
                          return [...prev, {product: p, quantity: 1}];
                        });
                        showToast(`${p.name} adicionado`);
                      }} 
                      className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                    >
                      Adicionar à Sacola
                    </button>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-32 text-center opacity-20 uppercase font-black text-sm tracking-[0.5em]">Nenhum item nesta categoria</div>
              )}
            </div>
          </div>
        ) : (
          /* PAINEL ADMIN */
          <div className="space-y-16 animate-fade-up">
            <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-10">
              <div className="space-y-2">
                <h2 className="text-7xl font-bebas leading-none tracking-tighter italic">GESTOR <span className="text-[#c4a661] not-italic">CENTRAL</span></h2>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Monitoramento Ativo • Miracema</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/5">
                {[
                  { id: 'resumo', label: 'Dashboard' },
                  { id: 'pedidos', label: 'Vendas' },
                  { id: 'cardapio', label: 'Menu' },
                  { id: 'ajustes', label: 'Ajustes' },
                  { id: 'logs', label: 'Logs' }
                ].map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setAdminTab(tab.id as any)} 
                    className={`px-6 md:px-8 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      adminTab === tab.id ? 'bg-[#c4a661] text-black shadow-lg shadow-[#c4a661]/10' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </header>

            <div className="premium-card rounded-[3rem] p-8 md:p-12 min-h-[500px]">
              {adminTab === 'resumo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                   <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Vendas de Hoje</p>
                      <p className="text-5xl font-bebas text-[#c4a661] mt-4 italic">{formatCurrency(dailyRevenue)}</p>
                   </div>
                   <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Pendentes</p>
                      <p className="text-5xl font-bebas text-white mt-4 italic">{orders.filter(o => o.status === 'Pendente').length}</p>
                   </div>
                   <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Itens Menu</p>
                      <p className="text-5xl font-bebas text-white/50 mt-4 italic">{products.length}</p>
                   </div>
                   <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Status Loja</p>
                      <button 
                        onClick={() => setConfig({...config, isOpen: !config.isOpen})}
                        className={`mt-6 px-5 py-2 rounded-full text-[9px] font-black uppercase border tracking-widest transition-all ${
                          config.isOpen ? 'border-green-500 text-green-500 hover:bg-green-500/10' : 'border-red-500 text-red-500 hover:bg-red-500/10'
                        }`}
                      >
                        {config.isOpen ? 'ONLINE' : 'OFFLINE'}
                      </button>
                   </div>
                </div>
              )}

              {adminTab === 'pedidos' && (
                <div className="space-y-10">
                  <div className="relative">
                    <input 
                      value={searchSales} 
                      onChange={e => setSearchSales(e.target.value)} 
                      placeholder="PROCURAR POR NOME, ID OU DISPOSITIVO..." 
                      className="w-full bg-black/40 px-10 py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5" 
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20 text-xl font-light">🔍</span>
                  </div>
                  <div className="space-y-6">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-20 opacity-20 uppercase font-black text-[10px] tracking-[0.3em]">Sem registros correspondentes</div>
                    ) : (
                      filteredOrders.map(o => (
                        <div key={o.id} className={`p-8 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-center gap-8 transition-all ${o.status === 'Pendente' ? 'bg-[#c4a661]/5 border-[#c4a661]/20' : 'bg-white/[0.02] border-white/5'}`}>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-4">
                              <span className="text-[#c4a661] font-black text-lg italic tracking-widest">{o.id}</span>
                              <span className="text-[8px] text-white/20 uppercase font-black tracking-widest">{new Date(o.createdAt).toLocaleString('pt-BR')}</span>
                              <span className="text-[7px] text-white/10 uppercase font-black">ID DISP: {o.deviceId.slice(-6)}</span>
                            </div>
                            <h4 className="text-3xl font-bold uppercase truncate max-w-[300px]">{o.customerName}</h4>
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">{o.customerPhone}</p>
                          </div>
                          <div className="flex flex-col md:items-end gap-6 min-w-[300px]">
                            <select 
                              value={o.status} 
                              onChange={e => updateOrderStatus(o.id, e.target.value as OrderStatus)} 
                              className="w-full bg-black border border-white/10 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none"
                            >
                              {['Pendente', 'Preparando', 'Pronto', 'Enviado', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="flex items-center justify-between w-full">
                              <button onClick={() => setViewingOrder(o)} className="text-[9px] font-black uppercase text-[#c4a661] hover:underline">Detalhes</button>
                              <p className="text-4xl font-bebas text-[#c4a661] italic">{formatCurrency(o.total)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'cardapio' && (
                <div className="space-y-16">
                  <div className="bg-white/[0.02] p-8 md:p-12 rounded-[3rem] border border-[#c4a661]/10 space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#c4a661]">{isEditing ? 'EDITANDO PRODUTO' : 'ADICIONAR NOVO ITEM'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="NOME DO LANCHE" className="bg-black/60 px-8 py-5 rounded-xl text-[10px] font-black uppercase border border-white/5" />
                       <input type="number" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} placeholder="PREÇO (R$)" className="bg-black/60 px-8 py-5 rounded-xl text-[10px] font-black uppercase border border-white/5" />
                       <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value as Category})} className="bg-black/60 px-8 py-5 rounded-xl text-[10px] font-black uppercase border border-white/5">
                         {['Hambúrgueres', 'Especial', 'Acompanhamentos', 'Bebidas', 'Sobremesas'].map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <textarea value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="DESCREVA OS INGREDIENTES..." className="w-full bg-black/60 px-8 py-6 rounded-xl text-[10px] font-black uppercase h-28 border border-white/5 resize-none" />
                    <div className="flex gap-4">
                      <button onClick={handleSaveProduct} className="flex-1 md:flex-none bg-[#c4a661] text-black px-12 py-5 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">{isEditing ? 'Salvar Alterações' : 'Confirmar Cadastro'}</button>
                      {isEditing && <button onClick={() => {setIsEditing(null); setNewProduct({name:'', price:0, description:'', category: 'Hambúrgueres', image:'', stock:100});}} className="px-8 py-5 text-[9px] font-black uppercase text-white/30 hover:text-white">Cancelar</button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {products.map(p => (
                      <div key={p.id} className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] group hover:border-[#c4a661]/20 transition-all flex justify-between items-center">
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-xl font-bold uppercase truncate">{p.name}</h4>
                          <p className="text-2xl font-bebas text-[#c4a661] italic mt-1">{formatCurrency(p.price)}</p>
                        </div>
                        <div className="flex gap-3 ml-6">
                           <button onClick={() => {setIsEditing(p.id); setNewProduct(p); window.scrollTo({top: 0, behavior: 'smooth'});}} className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center text-sm hover:rotate-12 transition-transform shadow-lg shadow-white/5">✎</button>
                           <button onClick={() => {if(confirm(`Excluir ${p.name}?`)) { setProducts(ps => ps.filter(it => it.id !== p.id)); addActivity('INVENTORY', `Excluído: ${p.name}`); }}} className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center text-lg font-black hover:scale-110 transition-transform shadow-lg shadow-red-600/10">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'ajustes' && (
                <div className="max-w-2xl space-y-12">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                     <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-white/20 tracking-widest ml-4">Taxa de Entrega</label>
                       <input type="number" value={config.deliveryFee} onChange={e => setConfig({...config, deliveryFee: Number(e.target.value)})} className="w-full bg-black/40 px-8 py-5 rounded-xl text-lg font-black italic border border-white/5" />
                     </div>
                     <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-white/20 tracking-widest ml-4">PIN Gestor</label>
                       <input value={config.adminKey} onChange={e => setConfig({...config, adminKey: e.target.value})} className="w-full bg-black/40 px-8 py-5 rounded-xl text-lg font-black italic text-center border border-white/5" />
                     </div>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[9px] font-black uppercase text-white/20 tracking-widest ml-4">WhatsApp de Recebimento</label>
                      <input value={config.whatsappNumber} onChange={e => setConfig({...config, whatsappNumber: e.target.value})} className="w-full bg-black/40 px-8 py-5 rounded-xl text-lg font-black italic border border-white/5" />
                   </div>
                   <div className="p-8 bg-[#c4a661]/5 border border-[#c4a661]/10 rounded-3xl">
                      <p className="text-[9px] font-black uppercase text-[#c4a661] tracking-widest mb-4">Informação de Segurança</p>
                      <p className="text-xs text-white/40 leading-relaxed uppercase font-medium">O identificador deste terminal é: <span className="text-white font-black">{deviceId.slice(-6).toUpperCase()}</span>. Os dados são persistidos localmente no navegador.</p>
                   </div>
                </div>
              )}

              {adminTab === 'logs' && (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4 no-scrollbar">
                  {activities.map(act => (
                    <div key={act.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex justify-between items-center hover:bg-white/[0.04] transition-colors">
                       <p className="text-[10px] font-bold uppercase text-white/70">{act.message}</p>
                       <span className="text-[8px] text-white/20 font-black uppercase italic">{new Date(act.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DETALHES PEDIDO */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-xl px-4 md:px-6">
           <div className="max-w-3xl w-full bg-[#050505] border border-white/10 rounded-[3.5rem] p-10 md:p-16 animate-fade-up relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
              <button onClick={() => setViewingOrder(null)} className="absolute top-10 right-10 text-white/30 text-4xl font-light hover:text-white transition-colors">×</button>
              <div className="space-y-12">
                 <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-white/5 pb-10 gap-6">
                    <div>
                      <span className="text-[#c4a661] font-black italic text-sm tracking-[0.4em] uppercase">ID COMPRA: {viewingOrder.id}</span>
                      <h2 className="text-5xl font-bebas text-white uppercase mt-2">{viewingOrder.customerName}</h2>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{viewingOrder.customerPhone}</p>
                    </div>
                    <div className="text-left sm:text-right">
                       <p className="text-6xl font-bebas text-[#c4a661] leading-none italic tracking-widest">{formatCurrency(viewingOrder.total)}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-[10px] font-medium uppercase text-white/60 tracking-wider">
                    <div className="space-y-6">
                       <h3 className="text-[#c4a661] font-black tracking-[0.4em] text-[9px]">RESUMO DOS ITENS</h3>
                       <div className="space-y-4">
                        {viewingOrder.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between border-b border-white/5 pb-3">
                            <span>{i.quantity}x {i.product.name}</span>
                            <span className="text-white font-black">{formatCurrency(i.product.price * i.quantity)}</span>
                          </div>
                        ))}
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h3 className="text-[#c4a661] font-black tracking-[0.4em] text-[9px]">LOGÍSTICA E PAGAMENTO</h3>
                       <div className="space-y-4">
                         <div className="bg-white/5 p-4 rounded-xl">
                           <p className="text-white/20 block mb-1 uppercase text-[8px]">Endereço:</p> 
                           <p className="text-white/80">{viewingOrder.address}</p>
                         </div>
                         <div className="flex justify-between">
                            <span className="text-white/20">Pagamento:</span>
                            <span className="text-white">{viewingOrder.paymentMethod}</span>
                         </div>
                         <div className="flex justify-between">
                            <span className="text-white/20">Dispositivo Identificado:</span>
                            <span className="text-white font-black">{viewingOrder.deviceId.slice(-8).toUpperCase()}</span>
                         </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL PRODUTO DETALHE */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl px-4">
           <div className="max-w-2xl w-full bg-[#050505] border border-white/10 rounded-[3.5rem] p-10 md:p-16 flex flex-col space-y-10 animate-fade-up relative shadow-2xl">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-8 right-8 w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-3xl font-light hover:bg-white hover:text-black transition-all">×</button>
              <div className="space-y-6">
                <span className="text-[#c4a661] font-black text-[10px] uppercase tracking-[0.4em] italic">{selectedProduct.category}</span>
                <h2 className="text-6xl md:text-8xl font-bebas leading-none tracking-tight">{selectedProduct.name}</h2>
                <div className="pt-6 border-t border-white/10">
                   <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mb-4">Composição:</p>
                   <p className="text-white/70 text-xl md:text-2xl leading-relaxed uppercase font-medium">{selectedProduct.description}</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-end justify-between border-t border-white/10 pt-10 gap-8">
                <p className="text-7xl font-bebas text-[#c4a661] italic leading-none">{formatCurrency(selectedProduct.price)}</p>
                <button 
                  onClick={() => {
                   if(!config.isOpen) return showToast("Cozinha indisponível", "error");
                   setCart(prev => {
                     const ex = prev.find(i => i.product.id === selectedProduct.id);
                     if(ex) return prev.map(i => i.product.id === selectedProduct.id ? {...i, quantity: i.quantity+1} : i);
                     return [...prev, {product: selectedProduct, quantity: 1}];
                   });
                   showToast("Adicionado!");
                   setSelectedProduct(null);
                  }} 
                  className="bg-white text-black px-12 py-6 rounded-full font-black text-[11px] uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all tracking-widest"
                >
                  Confirmar e Pedir
                </button>
              </div>
           </div>
        </div>
      )}

      {/* DRAWER SACOLA */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-[300] flex justify-end">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCartDrawer(false)} />
           <div className="relative w-full max-w-xl bg-[#050505] border-l border-white/10 p-8 md:p-12 flex flex-col animate-slide-left h-screen overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center mb-10">
                <h3 className="font-bebas text-5xl tracking-widest text-[#c4a661]">MINHA <span className="text-white">SACOLA</span></h3>
                <button onClick={() => setShowCartDrawer(false)} className="text-white/30 hover:text-white text-4xl font-light">×</button>
              </div>
              
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10 space-y-6">
                  <span className="text-8xl">🧺</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Sua sacola está vazia</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-6">
                    {cart.map(i => (
                      <div key={i.product.id} className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 flex gap-6 items-center">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold uppercase truncate">{i.product.name}</h4>
                          <p className="text-[#c4a661] font-bold text-xs italic">{formatCurrency(i.product.price * i.quantity)}</p>
                        </div>
                        <div className="flex items-center gap-4 bg-black/60 p-2 rounded-xl border border-white/5">
                          <button onClick={() => setCart(prev => prev.map(it => it.product.id === i.product.id ? {...it, quantity: Math.max(0, it.quantity-1)} : it).filter(it => it.quantity > 0))} className="w-8 h-8 rounded-lg border border-white/10 text-white hover:bg-white hover:text-black transition-all">-</button>
                          <span className="text-sm font-black w-4 text-center">{i.quantity}</span>
                          <button onClick={() => setCart(prev => prev.map(it => it.product.id === i.product.id ? {...it, quantity: it.quantity+1} : it))} className="w-8 h-8 rounded-lg border border-white/10 text-white hover:bg-white hover:text-black transition-all">+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleCheckout} className="mt-10 space-y-4 border-t border-white/10 pt-8">
                    <div className="flex justify-between items-end mb-6">
                       <span className="text-[10px] font-black uppercase text-white/30 tracking-widest italic">Total Final</span>
                       <span className="text-6xl font-bebas text-[#c4a661] leading-none italic">{formatCurrency(cartTotal + config.deliveryFee)}</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input required name="name" placeholder="NOME" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                        <input required name="phone" value={phoneInput} onChange={handlePhoneChange} placeholder="WHATSAPP" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <input required name="rua" placeholder="RUA / LOGRADOURO" className="col-span-3 px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                        <input required name="numero" placeholder="Nº" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input required name="bairro" placeholder="BAIRRO" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                        <input name="referencia" placeholder="REFERÊNCIA" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input required type="email" name="email" defaultValue={lastOrderEmail} placeholder="EMAIL" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black/40 border border-white/5" />
                        <select name="payment" className="px-6 py-4 rounded-xl text-[10px] font-black uppercase bg-black border border-white/5 appearance-none">
                          <option value="PIX (na Entrega)">PIX NA ENTREGA</option>
                          <option value="Cartão (Máquina)">CARTÃO (MÁQUINA)</option>
                          <option value="Dinheiro">DINHEIRO</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[8px] text-white/20 uppercase text-center mt-2 tracking-widest">Identificação segura ativa via dispositivo: {deviceId.slice(-6).toUpperCase()}</p>

                    <button disabled={isProcessingOrder} className="w-full bg-[#c4a661] text-black py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                      {isProcessingOrder ? 'GERANDO PEDIDO...' : 'FINALIZAR NO WHATSAPP'}
                    </button>
                  </form>
                </>
              )}
           </div>
        </div>
      )}

      {/* LOGIN PIN MODAL */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/98 backdrop-blur-2xl px-6">
          <div className="max-w-xs w-full p-12 bg-[#0a0a0a] border border-white/10 rounded-[3rem] text-center shadow-2xl animate-fade-up">
            <h2 className="text-4xl font-bebas mb-10 tracking-widest text-[#c4a661]">ACESSO GESTOR</h2>
            <input 
              type="password" 
              autoFocus 
              className="w-full text-center text-6xl font-black py-8 bg-transparent border-b border-white/10 mb-12 outline-none focus:border-[#c4a661] tracking-[0.4em]" 
              value={adminPinInput} 
              onChange={e => setAdminPinInput(e.target.value)} 
              onKeyDown={e => {
                if(e.key === 'Enter') {
                  if(adminPinInput === config.adminKey) { setIsAdminMode(true); setShowAdminPinModal(false); setAdminPinInput(''); showToast("SISTEMA LIBERADO"); } 
                  else { showToast("PIN INVÁLIDO", "error"); }
                }
              }}
            />
            <div className="flex gap-4">
              <button onClick={() => { setShowAdminPinModal(false); setAdminPinInput(''); }} className="flex-1 py-4 text-[9px] font-black uppercase text-white/20 hover:text-white">Voltar</button>
              <button onClick={() => { 
                if(adminPinInput === config.adminKey) { setIsAdminMode(true); setShowAdminPinModal(false); setAdminPinInput(''); showToast("SISTEMA LIBERADO"); } 
                else { showToast("PIN INVÁLIDO", "error"); } 
              }} className="flex-1 py-4 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">Entrar</button>
            </div>
          </div>
        </div>
      )}

      {/* HISTÓRICO MODAL (Identificação automática) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl px-4">
           <div className="max-w-3xl w-full bg-[#0a0a0a] border border-white/10 rounded-[3.5rem] p-10 md:p-16 relative animate-fade-up max-h-[80vh] overflow-y-auto no-scrollbar shadow-2xl">
              <button onClick={() => setShowHistoryModal(false)} className="absolute top-10 right-10 text-white/30 text-4xl font-light hover:text-white transition-colors">×</button>
              <h2 className="text-6xl font-bebas mb-6 tracking-widest text-[#c4a661]">MEU <span className="text-white">HISTÓRICO</span></h2>
              <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mb-10 border-b border-white/5 pb-4 italic">Compras realizadas neste dispositivo ({deviceId.slice(-6).toUpperCase()})</p>
              
              <div className="space-y-6">
                {myOrders.length === 0 ? (
                  <div className="py-20 text-center opacity-10 flex flex-col items-center gap-6">
                    <span className="text-6xl">🗒️</span>
                    <p className="uppercase font-black text-[9px] tracking-widest">Nenhuma compra encontrada neste dispositivo</p>
                  </div>
                ) : (
                  myOrders.map(o => (
                    <div key={o.id} className="bg-white/[0.02] p-8 rounded-3xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-white/[0.04] transition-all gap-6">
                      <div className="space-y-2">
                        <span className="text-[#c4a661] font-black italic text-lg tracking-widest">ID COMPRA: {o.id}</span>
                        <p className="text-[8px] text-white/30 font-black uppercase tracking-widest">Realizada em: {new Date(o.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-left md:text-right w-full md:w-auto">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          o.status === 'Pronto' || o.status === 'Enviado' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-white/40'
                        }`}>
                          {o.status}
                        </span>
                        <p className="text-4xl font-bebas text-white mt-3 italic">{formatCurrency(o.total)}</p>
                        <button onClick={() => setViewingOrder(o)} className="text-[8px] font-black uppercase text-[#c4a661] mt-2 block w-full text-right underline opacity-40 hover:opacity-100 transition-opacity">Detalhes do Pedido</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
