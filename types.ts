
export type Category = 'Hambúrgueres' | 'Acompanhamentos' | 'Bebidas' | 'Sobremesas';
export type PaymentMethod = 'Cartão (Máquina)' | 'Dinheiro' | 'PIX (na Entrega)';

export interface User {
  name: string;
  email: string;
  password?: string; // Necessário para a simulação de banco de dados
  photo?: string;
}

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

export interface BusinessConfig {
  isOpen: boolean;
  adminKey: string;
  storeName: string;
  deliveryFee: number;
  whatsappNumber: string;
  formspreeId: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// Fix: Added missing Project interface required by ProjectCard.tsx component
export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  techStack: string[];
  url: string;
}
