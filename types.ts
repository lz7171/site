
export type Category = 'Hambúrgueres' | 'Acompanhamentos' | 'Bebidas' | 'Sobremesas' | 'Especial';
export type PaymentMethod = 'Cartão (Máquina)' | 'Dinheiro' | 'PIX (na Entrega)';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: Category;
  image: string;
  stock: number;
}

export type OrderStatus = 'Pendente' | 'Preparando' | 'Pronto' | 'Enviado' | 'Cancelado';

export interface OrderItem {
  product: Product;
  quantity: number;
  observation?: string;
}

export interface Order {
  id: string;
  deviceId: string; // Identificador único do dispositivo/navegador
  customerName: string;
  customerPhone: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: number;
  customerEmail: string;
}

export interface Activity {
  id: string;
  type: 'ORDER' | 'STATUS' | 'INVENTORY' | 'SYSTEM';
  message: string;
  timestamp: number;
}

export interface BusinessConfig {
  isOpen: boolean;
  adminKey: string;
  storeName: string;
  deliveryFee: number;
  whatsappNumber: string;
  formspreeId: string;
}
